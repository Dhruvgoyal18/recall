import { ApiError, saveItem } from "./api-client";
import { getQueue, getSettings, setQueue } from "./storage";
import type { QueuedSave, SaveRequestPayload } from "./types";

const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

function backoffFor(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
}

export async function enqueue(payload: SaveRequestPayload & { domain: string }): Promise<QueuedSave> {
  const queue = await getQueue();
  const entry: QueuedSave = {
    ...payload,
    queueId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: Date.now(),
  };
  queue.push(entry);
  await setQueue(queue);
  return entry;
}

export async function flushQueue(): Promise<{ flushed: number; remaining: number }> {
  const settings = await getSettings();
  const queue = await getQueue();

  if (!settings.apiBaseUrl || !settings.authToken || queue.length === 0) {
    return { flushed: 0, remaining: queue.length };
  }

  const now = Date.now();
  let flushed = 0;
  const stillQueued: QueuedSave[] = [];

  for (const entry of queue) {
    if (entry.nextAttemptAt > now) {
      stillQueued.push(entry);
      continue;
    }
    try {
      await saveItem(settings, {
        captureType: entry.captureType,
        url: entry.url,
        title: entry.title,
        content: entry.content,
      });
      flushed += 1;
    } catch (err) {
      const attempts = entry.attempts + 1;
      const isClientRejection =
        err instanceof ApiError && err.status !== undefined && err.status >= 400 && err.status < 500 && err.status !== 429;
      stillQueued.push({
        ...entry,
        attempts,
        // Client-side rejections (bad payload, bad auth) back off further —
        // no point hammering an endpoint that will keep saying no.
        nextAttemptAt: now + (isClientRejection ? MAX_BACKOFF_MS : backoffFor(attempts)),
      });
    }
  }

  await setQueue(stillQueued);
  return { flushed, remaining: stillQueued.length };
}
