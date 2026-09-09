import { Readability } from "@mozilla/readability";

export type FullPageExtraction = { title: string; content: string } | { error: string };

export function extractFullPage(): FullPageExtraction {
  try {
    // Parse a clone so Readability's DOM mutations never touch the live page.
    const clone = document.cloneNode(true) as Document;
    const article = new Readability(clone).parse();
    if (!article || !article.textContent?.trim()) {
      return { error: "Could not extract readable content from this page." };
    }
    return {
      title: article.title || document.title || "",
      content: article.textContent.trim(),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
