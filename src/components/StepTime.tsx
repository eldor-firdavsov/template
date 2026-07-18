import { useEffect, useState, useRef, useCallback } from "react";
import type { Barber, Service } from "../lib/types";
import { fetchAvailableSlots } from "../lib/api";

interface Props {
  service: Service;
  barber: Barber | null;
  onSelect: (date: string, time: string) => void;
  onBack: () => void;
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getNext14Days(): Date[] {
  const days: Date[] = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function formatDayNum(d: Date): string {
  return d.getDate().toString();
}

function formatMonth(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short" });
}

export function StepTime({ service, barber, onSelect, onBack }: Props) {
  const days = getNext14Days();
  const [selectedDay, setSelectedDay] = useState(0);
  const [slots, setSlots] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const stripRef = useRef<HTMLDivElement>(null);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    const fromDate = formatDateStr(days[0]!);
    const toDate = formatDateStr(days[days.length - 1]!);

    try {
      const data = await fetchAvailableSlots(
        service.id,
        barber?.id ?? null,
        fromDate,
        toDate,
      );
      setSlots(data);
    } catch {
      console.error("Failed to load slots");
    }
    setLoading(false);
  }, [service.id, barber?.id, days]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const currentDay = days[selectedDay]!;
  const currentDateStr = formatDateStr(currentDay);
  const daySlots = slots[currentDateStr] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-surface active:scale-95 transition-all"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-semibold mb-1">Pick a Time</h2>
          <p className="text-sm text-muted">
            {service.name}
            {barber ? ` with ${barber.full_name}` : " — any barber"}
          </p>
        </div>
      </div>

      <div
        ref={stripRef}
        className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none"
      >
        {days.map((day, i) => {
          const ds = formatDateStr(day);
          const hasSlots = (slots[ds] ?? []).length > 0;
          return (
            <button
              key={ds}
              onClick={() => hasSlots && setSelectedDay(i)}
              disabled={!hasSlots}
              className={`flex-shrink-0 flex flex-col items-center w-14 py-3 rounded-xl transition-all ${i === selectedDay
                  ? "bg-accent text-white"
                  : hasSlots
                    ? "bg-surface hover:bg-accent/10"
                    : "bg-surface/50 text-muted/50 cursor-not-allowed"
                }`}
            >
              <span className="text-[10px] uppercase font-medium">
                {formatDayLabel(day)}
              </span>
              <span className="text-lg font-bold">{formatDayNum(day)}</span>
              <span className="text-[10px]">{formatMonth(day)}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="text-muted">Loading available times...</div>
        </div>
      ) : daySlots.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <div className="text-muted text-center">
            <div className="text-3xl mb-2">-</div>
            <div>No available slots on this day</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {daySlots.map((slot) => (
            <button
              key={slot}
              onClick={() => onSelect(currentDateStr, slot)}
              className="py-3 rounded-xl bg-surface hover:bg-accent/10 active:scale-95 transition-all font-medium"
            >
              {slot}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
