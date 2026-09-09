import { testConnection } from "../shared/api-client";
import { getQueue, getSettings, setSettings } from "../shared/storage";

const urlInput = document.getElementById("api-base-url") as HTMLInputElement;
const tokenInput = document.getElementById("auth-token") as HTMLInputElement;
const message = document.getElementById("message") as HTMLParagraphElement;
const queueInfo = document.getElementById("queue-info") as HTMLParagraphElement;

async function load(): Promise<void> {
  const settings = await getSettings();
  urlInput.value = settings.apiBaseUrl;
  tokenInput.value = settings.authToken;
  const queue = await getQueue();
  queueInfo.textContent = queue.length > 0 ? `${queue.length} item(s) waiting to sync.` : "Retry queue is empty.";
}

document.getElementById("save")?.addEventListener("click", () => {
  void (async () => {
    await setSettings({
      apiBaseUrl: urlInput.value.trim().replace(/\/$/, ""),
      authToken: tokenInput.value.trim(),
    });
    message.textContent = "Saved.";
  })();
});

document.getElementById("test-connection")?.addEventListener("click", () => {
  void (async () => {
    message.textContent = "Testing…";
    const settings = await getSettings();
    const ok = await testConnection(settings);
    message.textContent = ok ? "Connection OK." : "Could not reach the backend.";
  })();
});

document.getElementById("flush-queue")?.addEventListener("click", () => {
  void (async () => {
    message.textContent = "Flushing…";
    const result = (await chrome.runtime.sendMessage({ type: "recall/flush-queue-now" })) as {
      flushed: number;
      remaining: number;
    };
    message.textContent = `Flushed ${result.flushed}, ${result.remaining} remaining.`;
    await load();
  })();
});

void load();
