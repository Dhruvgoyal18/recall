"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatDateHeading, todayKey } from "@/lib/date";
import type { ActivityResponse, CapturedItem, ItemsResponse, SearchResponse } from "@/lib/types";

import ActivityHeatmap from "./ActivityHeatmap";
import ItemCard from "./ItemCard";

type LoadState = "idle" | "loading" | "error";

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [dayItems, setDayItems] = useState<CapturedItem[]>([]);
  const [dayState, setDayState] = useState<LoadState>("idle");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CapturedItem[] | null>(null);
  const [searchState, setSearchState] = useState<LoadState>("idle");

  const [activityCounts, setActivityCounts] = useState<Record<string, number>>({});
  const [backendDown, setBackendDown] = useState(false);

  const [captureTypeFilter, setCaptureTypeFilter] = useState<"" | "selection" | "full_page">("");
  const [domainFilter, setDomainFilter] = useState("");

  const loadDay = useCallback(async (date: string) => {
    setDayState("loading");
    try {
      const res = await fetch(`/api/v1/items?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ItemsResponse;
      setDayItems(data.items);
      setDayState("idle");
      setBackendDown(false);
    } catch {
      setDayState("error");
      setBackendDown(true);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/activity?days=30", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ActivityResponse;
      setActivityCounts(data.counts);
    } catch {
      // Heatmap is a nice-to-have; a failure here shouldn't block the day view.
    }
  }, []);

  useEffect(() => {
    void loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults(null);
      setSearchState("idle");
      return;
    }
    setSearchState("loading");
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as SearchResponse;
          setSearchResults(data.items);
          setSearchState("idle");
        } catch {
          setSearchState("error");
        }
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const activeList = searchResults !== null ? searchResults : dayItems;
  const activeState = searchResults !== null ? searchState : dayState;
  const isSearching = searchResults !== null;

  const domains = useMemo(() => {
    return Array.from(new Set(activeList.map((item) => item.domain))).sort();
  }, [activeList]);

  const filteredList = useMemo(() => {
    return activeList.filter((item) => {
      if (captureTypeFilter && item.captureType !== captureTypeFilter) return false;
      if (domainFilter && item.domain !== domainFilter) return false;
      return true;
    });
  }, [activeList, captureTypeFilter, domainFilter]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/v1/item/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setDayItems((prev) => prev.filter((item) => item.id !== id));
        setSearchResults((prev) => (prev ? prev.filter((item) => item.id !== id) : prev));
        void loadActivity();
      } catch {
        window.alert("Couldn't delete that item — check your connection and try again.");
      }
    },
    [loadActivity],
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      {backendDown && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Backend unreachable — showing the last data we have. Retrying automatically.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            max={todayKey()}
            onChange={(e) => {
              setSearchQuery("");
              setSelectedDate(e.target.value);
            }}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <span className="text-sm font-medium">{isSearching ? "Search results" : formatDateHeading(selectedDate)}</span>
        </div>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search all saved items…"
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm sm:w-64 dark:border-gray-700 dark:bg-gray-900"
        />
      </div>

      {!isSearching && (
        <ActivityHeatmap
          counts={activityCounts}
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSearchQuery("");
            setSelectedDate(date);
          }}
        />
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        <select
          value={captureTypeFilter}
          onChange={(e) => setCaptureTypeFilter(e.target.value as "" | "selection" | "full_page")}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="">All types</option>
          <option value="selection">Selection</option>
          <option value="full_page">Full page</option>
        </select>
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="">All domains</option>
          {domains.map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>
      </div>

      {activeState === "loading" && <p className="text-sm text-gray-500">Loading…</p>}
      {activeState === "error" && !backendDown && (
        <p className="text-sm text-red-600">Something went wrong loading items. Try again shortly.</p>
      )}
      {activeState !== "loading" && filteredList.length === 0 && (
        <p className="text-sm text-gray-500">
          {isSearching ? "No results found." : "No items saved on this day."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {filteredList.map((item) => (
          <ItemCard key={item.id} item={item} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}
