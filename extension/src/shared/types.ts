export type CaptureType = "selection" | "full_page";

export interface SaveRequestPayload {
  captureType: CaptureType;
  url: string;
  title: string;
  content: string;
}

export interface QueuedSave extends SaveRequestPayload {
  queueId: string;
  domain: string;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
}

export interface CapturedItem extends SaveRequestPayload {
  id: string;
  domain: string;
  savedAt: string;
  dateKey: string;
}

export interface RecallSettings {
  /** Base URL of the Next.js dashboard, e.g. https://recall-dashboard.vercel.app */
  apiBaseUrl: string;
  /** Personal JWT obtained via sign-in/sign-up, not a shared secret. */
  authToken: string;
  /** Signed-in user's email, shown in the Options page. */
  email: string;
}
