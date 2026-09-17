import { ApiError, deleteItem, saveItem } from "../shared/api-client";
import { enqueue, flushQueue } from "../shared/queue";
import { getQueue, getSettings, setSettings } from "../shared/storage";
import type { SaveRequestPayload } from "../shared/types";

const CONTEXT_MENU_ID = "recall-save-selection";
const FLUSH_ALARM = "recall-flush-queue";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Save selection to Recall",
    contexts: ["selection"],
  });
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 });
  void flushQueue();
});

chrome.runtime.onStartup.addListener(() => {
  void flushQueue();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) {
    void flushQueue();
  }
});

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function sendToContentScript<T>(tabId: number, message: unknown): Promise<T> {
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  } catch {
    // Tab was open before install/update, so the declared content script
    // never loaded there — inject it once, then retry.
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content-scripts/content.js"] });
    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  }
}

async function handleSave(tab: chrome.tabs.Tab, payload: SaveRequestPayload): Promise<void> {
  if (!tab.id) return;
  const domain = safeDomain(payload.url);
  const settings = await getSettings();

  if (!settings.apiBaseUrl || !settings.authToken) {
    await enqueue({ ...payload, domain });
    await sendToContentScript(tab.id, {
      type: "recall/show-toast",
      message: "Recall isn't configured yet — open Options. Saved to the retry queue for now.",
    });
    return;
  }

  try {
    const item = await saveItem(settings, payload);
    await sendToContentScript(tab.id, {
      type: "recall/show-toast",
      message: `Saved to Recall (${payload.captureType === "selection" ? "selection" : "full page"})`,
      undoItemId: item.id,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // A dead/expired token will never succeed on retry — clear it and
      // point the user at signing in again rather than queuing forever.
      await setSettings({ ...settings, authToken: "", email: "" });
      await sendToContentScript(tab.id, {
        type: "recall/show-toast",
        message: "Your Recall session expired — open Options to sign in again.",
      });
      return;
    }
    await enqueue({ ...payload, domain });
    const reason = err instanceof ApiError ? err.message : "network error";
    await sendToContentScript(tab.id, {
      type: "recall/show-toast",
      message: `Couldn't reach Recall (${reason}) — queued, will retry automatically.`,
    });
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab) return;
  const text = info.selectionText?.trim();
  if (!text) return;
  void handleSave(tab, {
    captureType: "selection",
    url: tab.url ?? info.pageUrl,
    title: tab.title ?? "",
    content: text,
  });
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "save-selection" || !tab?.id) return;
  const selection = await sendToContentScript<{ content: string } | null>(tab.id, {
    type: "recall/get-selection",
  });
  if (!selection?.content) return;
  await handleSave(tab, {
    captureType: "selection",
    url: tab.url ?? "",
    title: tab.title ?? "",
    content: selection.content,
  });
});

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "recall/save-full-page") {
    void (async () => {
      const tab = sender.tab ?? (await getActiveTab());
      if (!tab?.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }
      const extracted = await sendToContentScript<{ title: string; content: string } | { error: string }>(
        tab.id,
        { type: "recall/extract-full-page" },
      );
      if ("error" in extracted) {
        sendResponse({ ok: false, error: extracted.error });
        return;
      }
      await handleSave(tab, {
        captureType: "full_page",
        url: tab.url ?? "",
        title: extracted.title,
        content: extracted.content,
      });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "recall/undo-save") {
    void (async () => {
      const settings = await getSettings();
      try {
        await deleteItem(settings, message.itemId as string);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await setSettings({ ...settings, authToken: "", email: "" });
        }
        // otherwise best-effort undo; nothing else actionable if it fails silently
      }
    })();
    return false;
  }

  if (message?.type === "recall/flush-queue-now") {
    void flushQueue().then((result) => sendResponse(result));
    return true;
  }

  if (message?.type === "recall/get-queue-status") {
    void getQueue().then((queue) => sendResponse({ pending: queue.length }));
    return true;
  }

  return false;
});
