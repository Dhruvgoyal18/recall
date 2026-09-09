import { getQueue, getSettings } from "../shared/storage";

const statusEl = document.getElementById("status") as HTMLParagraphElement;
const queueEl = document.getElementById("queue-status") as HTMLParagraphElement;
const saveBtn = document.getElementById("save-full-page") as HTMLButtonElement;
const optionsLink = document.getElementById("open-options") as HTMLAnchorElement;

async function refreshStatus(): Promise<void> {
  const settings = await getSettings();
  statusEl.textContent = settings.apiBaseUrl && settings.authToken ? `Connected to ${settings.apiBaseUrl}` : "Not configured — open Options.";

  const queue = await getQueue();
  queueEl.textContent = queue.length > 0 ? `${queue.length} item(s) queued for retry` : "";
}

saveBtn.addEventListener("click", () => {
  void (async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      const response = (await chrome.runtime.sendMessage({ type: "recall/save-full-page" })) as
        | { ok: true }
        | { ok: false; error: string };
      statusEl.textContent = response.ok ? "Saved!" : `Couldn't save: ${response.error}`;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Full Page";
      await refreshStatus();
    }
  })();
});

optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

void refreshStatus();
