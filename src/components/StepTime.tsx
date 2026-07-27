import { useEffect, useState, useRef, useCallback } from "react";
import type { Barber, Service } from "../lib/types";
import { fetchAvailableSlots } from "../lib/api";
import { uz } from "../lib/uz";
import { Skeleton } from "./ui/Skeleton";
import { Sun, SunMedium, Moon } from "lucide-react";

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
  return uz.weekdays[d.getDay()] ?? "";
}
function formatDayNum(d: Date): string {
  return d.getDate().toString();
}
function formatMonth(d: Date): string {
  return uz.monthsShort[d.getMonth()] ?? "";
}

// Loss Aversion: scarcity threshold
const SCARCITY_THRESHOLD = 3;

export function StepTime({ service, barber, onSelect, onBack }: Props) {
  const days = getNext14Days();
  const [selectedDay, setSelectedDay] = useState(0);
  const [slots, setSlots] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [autoSkippedToday, setAutoSkippedToday] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const selectedBtnRef = useRef<HTMLButtonElement>(null);

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

      // Smart Defaults: auto-select first available day, announce if we skipped today
      const firstAvailableIndex = days.findIndex(
        (d) => (data[formatDateStr(d)] ?? []).length > 0
      );
      if (firstAvailableIndex > 0) {
        setSelectedDay(firstAvailableIndex);
        setAutoSkippedToday(true);
      }
    } catch {
      console.error("Failed to load slots");
    }
    setLoading(false);
  }, [service.id, barber?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // Auto-scroll selected date into view
  useEffect(() => {
    if (selectedBtnRef.current && stripRef.current) {
      const container = stripRef.current;
      const btn = selectedBtnRef.current;
      const scrollLeft =
        btn.offsetLeft - container.offsetWidth / 2 + btn.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [selectedDay]);

  const currentDay = days[selectedDay]!;
  const currentDateStr = formatDateStr(currentDay);
  const daySlots = slots[currentDateStr] ?? [];

  // Loss Aversion: scarcity
  const isScarce = (dateStr: string) => {
    const s = slots[dateStr] ?? [];
    return s.length > 0 && s.length <= SCARCITY_THRESHOLD;
  };

  // Group slots by time of day
  const morningSlots = daySlots.filter((s) => parseInt(s.split(":")[0]!) < 12);
  const afternoonSlots = daySlots.filter((s) => {
    const h = parseInt(s.split(":")[0]!);
    return h >= 12 && h < 17;
  });
  const eveningSlots = daySlots.filter((s) => parseInt(s.split(":")[0]!) >= 17);

  const todayStr = formatDateStr(days[0]!);


  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl hover:bg-surface active:scale-95 transition-all"
          aria-label={uz.actions.back}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-extrabold mb-0.5 tracking-tight">{uz.steps.pickTime}</h2>
          <p className="text-sm text-muted">
            {service.name}
            {barber ? ` — ${barber.full_name}` : uz.time.anyBarberShort}
          </p>
        </div>
      </div>

      {/* Smart Defaults: notify when we auto-jumped past today */}
      {autoSkippedToday && !loading && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-warning/8 border border-warning/20 text-warning text-xs font-semibold animate-slide-up">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Bugun bo'sh vaqt yo'q — eng yaqin bo'sh kunga o'tdik
        </div>
      )}

      {/* Date strip */}
      <div
        ref={stripRef}
        className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none"
      >
        {days.map((day, i) => {
          const ds = formatDateStr(day);
          const hasSlots = (slots[ds] ?? []).length > 0;
          const scarce = isScarce(ds);
          const isSelected = i === selectedDay;
          const isTodayDate = ds === todayStr;

          return (
            <button
              key={ds}
              ref={isSelected ? selectedBtnRef : null}
              onClick={() => setSelectedDay(i)}
              className={`flex-shrink-0 flex flex-col items-center w-[60px] py-3 rounded-2xl transition-all relative ${
                isSelected
                  ? "bg-accent shadow-md shadow-accent/25"
                  : hasSlots || loading
                  ? "bg-surface border border-border/50 hover:border-accent/40 hover:bg-accent/4 active:scale-95 cursor-pointer"
                  : "bg-surface/50 border border-border/20 text-muted/60 hover:border-accent/30 hover:bg-surface cursor-pointer opacity-70"
              }`}
            >
              {/* "Bugun" label for today — Smart Default */}
              {isTodayDate && (
                <span className={`text-[8px] font-bold uppercase tracking-widest mb-0.5 ${
                  isSelected ? "text-white/80" : "text-accent"
                }`}>
                  Bugun
                </span>
              )}
              <span className={`text-[10px] uppercase font-semibold tracking-wider ${
                isSelected ? "text-white/90" : ""
              } ${!isTodayDate ? "mt-0" : ""}`}>
                {formatDayLabel(day)}
              </span>
              <span className={`text-xl font-extrabold mt-0.5 ${isSelected ? "text-white" : ""}`}>
                {formatDayNum(day)}
              </span>
              <span className={`text-[10px] mt-0.5 ${isSelected ? "text-white/90" : "text-muted"}`}>
                {formatMonth(day)}
              </span>

              {/* Loss Aversion: scarcity badge */}
              {scarce && !isSelected && !loading && (
                <span className="absolute -top-1.5 -right-1 text-[9px] font-bold bg-danger text-white px-1.5 py-0.5 rounded-full animate-urgency leading-none">
                  {(slots[ds] ?? []).length} ta
                </span>
              )}

              {!hasSlots && !loading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
                  <div className="w-10 h-[1px] bg-muted/25 rotate-45" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Loss Aversion: scarcity banner for selected day */}
      {!loading && isScarce(currentDateStr) && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-danger/8 border border-danger/20 animate-slide-up">
          <svg className="w-3.5 h-3.5 text-danger shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs font-bold text-danger">
            Faqat {daySlots.length} ta bo'sh vaqt qoldi — tez band bo'ladi!
          </span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="w-24 h-4 mb-2" />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="w-full h-11 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : daySlots.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 bg-surface/50 rounded-2xl border border-dashed border-border p-6 text-center">
          <svg className="w-8 h-8 text-muted/40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="font-semibold text-muted text-sm">{uz.time.noSlots}</div>
          <div className="text-xs text-muted/60 mt-1">Boshqa kunni tanlang</div>
        </div>
      ) : (
        <div className="space-y-5 animate-fade-in">
          {morningSlots.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-2.5 px-1 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-500" /> Tong
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {morningSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => onSelect(currentDateStr, slot)}
                    className="py-2.5 rounded-xl bg-surface border border-border/50 hover:border-accent hover:bg-accent/6 hover:shadow-sm active:bg-accent/10 active:scale-95 transition-all font-semibold text-sm"
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}
          {afternoonSlots.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-2.5 px-1 flex items-center gap-1.5">
                <SunMedium className="w-3.5 h-3.5 text-amber-400" /> Kunduz
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {afternoonSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => onSelect(currentDateStr, slot)}
                    className="py-2.5 rounded-xl bg-surface border border-border/50 hover:border-accent hover:bg-accent/6 hover:shadow-sm active:bg-accent/10 active:scale-95 transition-all font-semibold text-sm"
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}
          {eveningSlots.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-2.5 px-1 flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-indigo-400" /> Kechqurun
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {eveningSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => onSelect(currentDateStr, slot)}
                    className="py-2.5 rounded-xl bg-surface border border-border/50 hover:border-accent hover:bg-accent/6 hover:shadow-sm active:bg-accent/10 active:scale-95 transition-all font-semibold text-sm"
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
