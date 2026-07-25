import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useBarberAuth } from "../../context/BarberAuthContext";
import type { WorkingHours, TimeOff } from "../../lib/types";
import { Clock, Plus, Trash2, Save } from "lucide-react";
import { Skeleton } from "../../components/ui/Skeleton";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const BarberSchedule: React.FC = () => {
  const { barber } = useBarberAuth();
  const [workingHours, setWorkingHours] = useState<Record<number, WorkingHours | null>>({});
  const [timeOffList, setTimeOffList] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);

  // Time off form
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [savingHours, setSavingHours] = useState(false);

  const fetchData = useCallback(async () => {
    if (!barber) return;
    setLoading(true);
    try {
      const [whRes, toRes] = await Promise.all([
        supabase.from("working_hours").select("*").eq("barber_id", barber.id),
        supabase.from("time_off").select("*").eq("barber_id", barber.id).order("date", { ascending: true }),
      ]);

      if (whRes.error) throw whRes.error;
      if (toRes.error) throw toRes.error;

      const whMap: Record<number, WorkingHours | null> = {};
      for (let i = 0; i < 7; i++) whMap[i] = null;
      (whRes.data || []).forEach((wh) => {
        whMap[wh.weekday] = wh;
      });

      setWorkingHours(whMap);
      setTimeOffList(toRes.data || []);
    } catch (err) {
      console.error("Error fetching schedule:", err);
    } finally {
      setLoading(false);
    }
  }, [barber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleHourChange = (weekday: number, field: "start_time" | "end_time", value: string) => {
    setWorkingHours((prev) => {
      const current = prev[weekday] || {
        id: "",
        barber_id: barber?.id || "",
        weekday,
        start_time: "09:00:00",
        end_time: "18:00:00",
      };
      return {
        ...prev,
        [weekday]: { ...current, [field]: value },
      };
    });
  };

  const handleToggleDay = (weekday: number) => {
    setWorkingHours((prev) => {
      const current = prev[weekday];
      if (current) {
        return { ...prev, [weekday]: null };
      } else {
        return {
          ...prev,
          [weekday]: {
            id: "",
            barber_id: barber?.id || "",
            weekday,
            start_time: "09:00",
            end_time: "18:00",
          },
        };
      }
    });
  };

  const handleSaveWorkingHours = async () => {
    if (!barber) return;
    setSavingHours(true);
    try {
      // Clear existing working hours for this barber
      await supabase.from("working_hours").delete().eq("barber_id", barber.id);

      // Re-insert enabled days
      const toInsert = Object.values(workingHours)
        .filter((wh): wh is WorkingHours => wh !== null)
        .map((wh) => ({
          barber_id: barber.id,
          weekday: wh.weekday,
          start_time: wh.start_time.length === 5 ? `${wh.start_time}:00` : wh.start_time,
          end_time: wh.end_time.length === 5 ? `${wh.end_time}:00` : wh.end_time,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from("working_hours").insert(toInsert);
        if (error) throw error;
      }
      await fetchData();
    } catch (err) {
      console.error("Failed to save working hours:", err);
    } finally {
      setSavingHours(false);
    }
  };

  const handleAddTimeOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barber || !newDate) return;
    try {
      const { error } = await supabase.from("time_off").insert({
        barber_id: barber.id,
        date: newDate,
        reason: newReason.trim() || "Day Off",
      });
      if (error) throw error;
      setNewDate("");
      setNewReason("");
      await fetchData();
    } catch (err) {
      console.error("Failed to add time off:", err);
    }
  };

  const handleDeleteTimeOff = async (id: string) => {
    try {
      const { error } = await supabase.from("time_off").delete().eq("id", id);
      if (error) throw error;
      setTimeOffList((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Failed to delete time off:", err);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-card p-4 rounded-2xl border border-white/10 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-text">Working Hours & Days Off</h2>
          <p className="text-xs text-text-secondary">Set your weekly schedule and vacation dates</p>
        </div>
        <button
          onClick={handleSaveWorkingHours}
          disabled={savingHours}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white font-bold rounded-xl active:scale-95 transition-all text-xs shadow-md shadow-accent/20 disabled:opacity-70 hover:opacity-90"
        >
          {savingHours ? (
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <Save size={16} />
          )}
          {savingHours ? "Saving..." : "Save Working Hours"}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="w-full h-96 rounded-2xl bg-card border border-white/10" />
          <Skeleton className="w-full h-96 rounded-2xl bg-card border border-white/10" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Schedule */}
          <div className="bg-card rounded-2xl border border-white/10 p-5 space-y-4 shadow-sm">
            <h3 className="font-extrabold text-base text-text flex items-center gap-2">
              <Clock size={18} className="text-accent" /> Weekly Schedule
            </h3>

            <div className="space-y-3">
              {WEEKDAYS.map((dayName, idx) => {
                const wh = workingHours[idx];
                const isOpen = wh !== null;

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-bg rounded-xl border border-white/5 gap-2 transition-colors hover:border-white/10"
                  >
                    <div className="flex items-center gap-3 min-w-[110px]">
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={() => handleToggleDay(idx)}
                        className="w-4 h-4 accent-accent rounded cursor-pointer"
                      />
                      <span className={`text-xs font-bold ${isOpen ? "text-text" : "text-text-secondary"}`}>
                        {dayName}
                      </span>
                    </div>

                    {isOpen ? (
                      <div className="flex items-center gap-2 text-xs">
                        <input
                          type="time"
                          value={wh!.start_time.slice(0, 5)}
                          onChange={(e) => handleHourChange(idx, "start_time", e.target.value)}
                          className="bg-card px-2 py-1.5 rounded border border-white/10 text-text font-semibold outline-none focus:border-accent transition-colors"
                        />
                        <span className="text-text-secondary">to</span>
                        <input
                          type="time"
                          value={wh!.end_time.slice(0, 5)}
                          onChange={(e) => handleHourChange(idx, "end_time", e.target.value)}
                          className="bg-card px-2 py-1.5 rounded border border-white/10 text-text font-semibold outline-none focus:border-accent transition-colors"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-text-secondary italic">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time Off / Vacations */}
          <div className="bg-card rounded-2xl border border-white/10 p-5 space-y-4 shadow-sm">
            <h3 className="font-extrabold text-base text-text">Time Off & Exceptions</h3>

            <form onSubmit={handleAddTimeOff} className="space-y-3 bg-bg p-4 rounded-xl border border-white/5">
              <div>
                <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                  Select Date
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-card px-3 py-2.5 rounded-xl text-xs border border-white/10 text-text outline-none font-semibold focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Personal day, holiday..."
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full bg-card px-3 py-2.5 rounded-xl text-xs border border-white/10 text-text outline-none focus:border-accent transition-colors"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-text text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1"
              >
                <Plus size={14} /> Add Time Off Date
              </button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {timeOffList.length === 0 ? (
                <p className="text-xs text-text-secondary text-center py-4">No upcoming time off set.</p>
              ) : (
                timeOffList.map((to) => (
                  <div
                    key={to.id}
                    className="flex items-center justify-between p-3 bg-bg rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-text">{new Date(to.date).toLocaleDateString()}</p>
                      <p className="text-[11px] text-text-secondary mt-0.5">{to.reason}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteTimeOff(to.id)}
                      className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors active:scale-95"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
