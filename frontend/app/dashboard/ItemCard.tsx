"use client";

import { useState } from "react";

import { formatTimestamp } from "@/lib/date";
import type { CapturedItem } from "@/lib/types";

export default function ItemCard({
  item,
  onDelete,
}: {
  item: CapturedItem;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const preview = item.content.length > 240 ? `${item.content.slice(0, 240)}…` : item.content;

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span title={item.captureType === "selection" ? "Selection" : "Full page"}>
            {item.captureType === "selection" ? "✂️" : "📄"}
          </span>
          <span>{item.domain}</span>
          <span>·</span>
          <span>{formatTimestamp(item.savedAt)}</span>
        </div>
        <button
          type="button"
          disabled={deleting}
          onClick={() => {
            setDeleting(true);
            onDelete(item.id);
          }}
          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>

      {item.title && <h3 className="font-medium">{item.title}</h3>}

      <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
        {expanded ? item.content : preview}
      </p>

      <div className="flex items-center gap-3 text-xs">
        {item.content.length > 240 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Open source
        </a>
      </div>
    </article>
  );
}
