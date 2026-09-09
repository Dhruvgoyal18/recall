"use client";

import { lastNDays, todayKey } from "@/lib/date";

function intensityClass(count: number): string {
  if (count <= 0) return "bg-gray-100 dark:bg-gray-800";
  if (count <= 2) return "bg-indigo-200 dark:bg-indigo-900";
  if (count <= 5) return "bg-indigo-400 dark:bg-indigo-700";
  return "bg-indigo-600 dark:bg-indigo-500";
}

export default function ActivityHeatmap({
  counts,
  selectedDate,
  onSelectDate,
}: {
  counts: Record<string, number>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const days = lastNDays(30).reverse();

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500 dark:text-gray-400">Last 30 days</span>
      <div className="flex flex-wrap gap-1">
        {days.map((day) => {
          const count = counts[day] ?? 0;
          const isSelected = day === selectedDate;
          const isToday = day === todayKey();
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDate(day)}
              title={`${day}: ${count} item${count === 1 ? "" : "s"}`}
              className={`h-4 w-4 rounded-sm ${intensityClass(count)} ${
                isSelected ? "ring-2 ring-indigo-500 ring-offset-1" : ""
              } ${isToday ? "outline outline-1 outline-gray-400" : ""}`}
            />
          );
        })}
      </div>
    </div>
  );
}
