export type CaptureType = "selection" | "full_page";

export interface CapturedItem {
  id: string;
  captureType: CaptureType;
  url: string;
  domain: string;
  title: string;
  content: string;
  savedAt: string;
  dateKey: string;
  deleted?: boolean;
}

export interface ItemsResponse {
  date: string;
  items: CapturedItem[];
}

export interface SearchResponse {
  query: string;
  items: CapturedItem[];
}

export interface ActivityResponse {
  counts: Record<string, number>;
}
