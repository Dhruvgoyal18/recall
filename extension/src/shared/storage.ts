import type { QueuedSave, RecallSettings } from "./types";

const SETTINGS_KEY = "recall.settings";
const QUEUE_KEY = "recall.queue";

const DEFAULT_SETTINGS: RecallSettings = {
  apiBaseUrl: "",
  authToken: "",
};

export async function getSettings(): Promise<RecallSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] as Partial<RecallSettings> | undefined) };
}

export async function setSettings(settings: RecallSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function getQueue(): Promise<QueuedSave[]> {
  const result = await chrome.storage.local.get(QUEUE_KEY);
  return (result[QUEUE_KEY] as QueuedSave[] | undefined) ?? [];
}

export async function setQueue(queue: QueuedSave[]): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}
