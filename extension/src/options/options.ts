import { ApiError, login, signup } from "../shared/api-client";
import { DEFAULT_API_BASE_URL } from "../shared/constants";
import { getQueue, getSettings, setSettings } from "../shared/storage";

const signedInSection = document.getElementById("signed-in-section") as HTMLElement;
const authSection = document.getElementById("auth-section") as HTMLElement;
const signedInEmail = document.getElementById("signed-in-email") as HTMLElement;
const emailInput = document.getElementById("email") as HTMLInputElement;
const passwordInput = document.getElementById("password") as HTMLInputElement;
const urlInput = document.getElementById("api-base-url") as HTMLInputElement;
const message = document.getElementById("message") as HTMLParagraphElement;
const queueInfo = document.getElementById("queue-info") as HTMLParagraphElement;

function currentApiBaseUrl(): string {
  return (urlInput.value.trim() || DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

async function refresh(): Promise<void> {
  const settings = await getSettings();
  urlInput.value = settings.apiBaseUrl || DEFAULT_API_BASE_URL;

  if (settings.authToken) {
    signedInSection.hidden = false;
    authSection.hidden = true;
    signedInEmail.textContent = settings.email || "your account";
    const queue = await getQueue();
    queueInfo.textContent = queue.length > 0 ? `${queue.length} item(s) waiting to sync.` : "Retry queue is empty.";
  } else {
    signedInSection.hidden = true;
    authSection.hidden = false;
  }
}

async function handleAuth(action: typeof login): Promise<void> {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    message.textContent = "Enter an email and password.";
    return;
  }
  message.textContent = "Working…";
  try {
    const apiBaseUrl = currentApiBaseUrl();
    const { token } = await action(apiBaseUrl, email, password);
    await setSettings({ apiBaseUrl, authToken: token, email });
    passwordInput.value = "";
    message.textContent = "";
    await refresh();
  } catch (err) {
    message.textContent = err instanceof ApiError ? err.message : "Something went wrong. Try again.";
  }
}

document.getElementById("sign-in")?.addEventListener("click", () => void handleAuth(login));
document.getElementById("sign-up")?.addEventListener("click", () => void handleAuth(signup));

document.getElementById("sign-out")?.addEventListener("click", () => {
  void (async () => {
    const settings = await getSettings();
    await setSettings({ ...settings, authToken: "", email: "" });
    message.textContent = "";
    await refresh();
  })();
});

document.getElementById("save-advanced")?.addEventListener("click", () => {
  void (async () => {
    const settings = await getSettings();
    await setSettings({ ...settings, apiBaseUrl: currentApiBaseUrl() });
    message.textContent = "Dashboard URL saved.";
  })();
});

document.getElementById("flush-queue")?.addEventListener("click", () => {
  void (async () => {
    queueInfo.textContent = "Flushing…";
    const result = (await chrome.runtime.sendMessage({ type: "recall/flush-queue-now" })) as {
      flushed: number;
      remaining: number;
    };
    queueInfo.textContent = `Flushed ${result.flushed}, ${result.remaining} remaining.`;
    await refresh();
  })();
});

void refresh();
