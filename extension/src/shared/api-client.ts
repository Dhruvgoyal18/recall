import type { CapturedItem, RecallSettings, SaveRequestPayload } from "./types";

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

function assertConfigured(settings: RecallSettings): void {
  if (!settings.apiBaseUrl || !settings.authToken) {
    throw new ApiError("Recall is not configured — set the API URL and token in Options.");
  }
}

function baseUrl(settings: RecallSettings): string {
  return settings.apiBaseUrl.replace(/\/$/, "");
}

export async function saveItem(settings: RecallSettings, payload: SaveRequestPayload): Promise<CapturedItem> {
  assertConfigured(settings);
  const res = await fetch(`${baseUrl(settings)}/api/v1/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.authToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new ApiError(`Save failed (HTTP ${res.status})`, res.status);
  }
  const data = (await res.json()) as { item: CapturedItem };
  return data.item;
}

export async function deleteItem(settings: RecallSettings, id: string): Promise<void> {
  assertConfigured(settings);
  const res = await fetch(`${baseUrl(settings)}/api/v1/item/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${settings.authToken}` },
  });
  if (!res.ok) {
    throw new ApiError(`Delete failed (HTTP ${res.status})`, res.status);
  }
}

export async function testConnection(settings: RecallSettings): Promise<boolean> {
  if (!settings.apiBaseUrl) return false;
  try {
    const res = await fetch(`${baseUrl(settings)}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
