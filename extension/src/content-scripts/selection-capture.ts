export function getSelectionPayload(): { content: string } | null {
  const text = window.getSelection?.()?.toString().trim() ?? "";
  if (!text) return null;
  return { content: text };
}
