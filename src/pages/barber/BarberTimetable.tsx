import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useBarberAuth } from "../../context/BarberAuthContext";
import type { BookingWithDetails } from "../../lib/types";
import { Check, X, UserX, Clock, Phone, AlertCircle } from "lucide-react";
import { Skeleton } from "../../components/ui/Skeleton";

export const BarberTimetable: React.FC = () => {
  const { barber } = useBarberAuth();
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split("T")[0] || ""
  );
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());

  // Admin filter state: show all barbers' bookings vs only mine
  const [showAllBarbers, setShowAllBarbers] = useState(true);

  // Decision Modal state for pending bookings
  const [activeDecisionBooking, setActiveDecisionBooking] = useState<BookingWithDetails | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const fetchBookings = useCallback(async (isRealtimeUpdate = false) => {
    if (!barber) return;
    if (!isRealtimeUpdate) setLoading(true);

    try {
      const dayStart = `${selectedDate}T00:00:00.000Z`;
      const dayEnd = `${selectedDate}T23:59:59.999Z`;

      let query = supabase
        .from("bookings")
        .select(`
          *,
          service:services(*),
          client:clients(*),
          barber:barbers!barber_id(*)
        `)
        .gte("starts_at", dayStart)
        .lte("starts_at", dayEnd)
        .order("starts_at", { ascending: true });

      // If user is not admin, or if admin explicitly filters for "only mine"
      if (barber.role !== "admin" || !showAllBarbers) {
        query = query.eq("barber_id", barber.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const newBookings = data || [];
      
      if (isRealtimeUpdate) {
        setBookings(prev => {
          const prevIds = new Set(prev.map(b => b.id));
          const addedIds = newBookings.filter(b => !prevIds.has(b.id)).map(b => b.id);
          
          if (addedIds.length > 0) {
            setNewlyAddedIds(new Set(addedIds));
            setTimeout(() => {
              setNewlyAddedIds(new Set());
            }, 3000);
          }
          return newBookings;
        });
      } else {
        setBookings(newBookings);
      }
      
    } catch (err) {
      console.error("Error loading timetable bookings:", err);
    } finally {
      if (!isRealtimeUpdate) setLoading(false);
    }
  }, [barber, selectedDate, showAllBarbers]);

  useEffect(() => {
    fetchBookings();

    const channel = supabase
      .channel("timetable-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          fetchBookings(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBookings]);

  const handleUpdateStatus = async (
    bookingId: string,
    newStatus: "completed" | "no_show" | "cancelled",
    cancelledBy: "barber" | "admin" | null = null
  ) => {
    setActionInProgress(bookingId);
    try {
      const updates: any = { status: newStatus };
      if (newStatus === "cancelled") {
        updates.cancelled_at = new Date().toISOString();
        updates.cancelled_by = cancelledBy || barber?.role || "barber";
      }

      const { error } = await supabase
        .from("bookings")
        .update(updates)
        .eq("id", bookingId);

      if (error) throw error;
      await fetchBookings();
    } catch (err) {
      console.error("Failed to update booking status:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDecision = async (bookingId: string, decision: "confirmed" | "declined") => {
    if (!barber) return;
    setActionInProgress(bookingId);
    setDecisionError(null);

    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          status: decision,
          responded_at: new Date().toISOString(),
          responded_by: barber.id,
        })
        .eq("id", bookingId);

      if (error) throw error;
      
      setActiveDecisionBooking(null);
      await fetchBookings();
    } catch (err: any) {
      console.error("Failed to submit decision:", err);
      setDecisionError(err.message || "Xatolik yuz berdi");
    } finally {
      setActionInProgress(null);
    }
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  // Black and white minimal status coloring
  const statusColors: Record<string, string> = {
    pending: "bg-black/5 text-black border-black/15",
    confirmed: "bg-black text-white border-black/20",
    completed: "bg-black/5 text-black/60 border-black/10",
    no_show: "bg-black/5 text-black/50 border-black/10",
    cancelled: "bg-transparent text-black/40 border-black/10 line-through",
    declined: "bg-transparent text-black/40 border-black/10 line-through",
  };

  const statusBorderColors: Record<string, string> = {
    pending: "border-l-black/30",
    confirmed: "border-l-black",
    completed: "border-l-black/10",
    no_show: "border-l-black/10",
    cancelled: "border-l-black/10",
    declined: "border-l-black/10",
  };

  const statusLabels: Record<string, string> = {
    pending: "Kutilmoqda",
    confirmed: "Tasdiqlangan",
    completed: "Yakunlangan",
    no_show: "Kelmagan",
    cancelled: "Bekor qilingan",
    declined: "Rad etilgan",
  };

  return (
    <div className="space-y-6 animate-fade-in text-text">
      {/* Date Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-white/10 shadow-sm">
        <div>
          <h2 className="text-xl font-black tracking-tight">Buyurtmalar jadvali</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            {barber?.role === "admin" ? "Salon bo'yicha buyurtmalar boshqaruvi" : "Sizning shaxsiy ish jadvalingiz"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Admin Toggle */}
          {barber?.role === "admin" && (
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition-all">
              <input
                type="checkbox"
                checked={showAllBarbers}
                onChange={(e) => setShowAllBarbers(e.target.checked)}
                className="accent-black cursor-pointer"
              />
              Barcha sartaroshlar
            </label>
          )}

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-bg text-text px-3 py-2 rounded-xl text-sm border border-white/10 outline-none focus:border-accent font-semibold transition-colors"
          />
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split("T")[0] || "")}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-xl active:scale-95 transition-all"
          >
            Bugun
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
        <span>Status:</span>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-black/30"></div><span>Kutilmoqda</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-black"></div><span>Tasdiqlangan</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-black/10"></div><span>Yakunlangan</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded border border-black/10 line-through"></div><span>Bekor qilingan / Rad etilgan</span></div>
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="w-full h-32 rounded-2xl bg-card border border-white/10" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-card p-12 rounded-3xl border border-dashed border-white/20 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-bg border border-white/5 flex items-center justify-center mx-auto mb-2 text-text-secondary">
            <Clock size={28} />
          </div>
          <div>
            <h3 className="font-bold text-text text-lg">Buyurtmalar yo'q</h3>
            <p className="text-sm text-text-secondary mt-1 max-w-xs mx-auto">
              {selectedDate} sanasi uchun buyurtmalar scheduled qilinmagan.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const isPendingAction = actionInProgress === b.id;
            const isNew = newlyAddedIds.has(b.id);
            const startTimeStr = formatTime(b.starts_at);
            const endTimeStr = formatTime(b.ends_at);
            
            // Decider rules: can decide if pending AND assigned to this specific barber
            const canDecide = b.status === "pending" && b.barber_id === barber?.id;

            return (
              <div
                key={b.id}
                onClick={() => {
                  if (canDecide) {
                    setActiveDecisionBooking(b);
                  }
                }}
                className={`bg-card rounded-2xl border-y border-r border-white/10 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-sm border-l-4 ${
                  statusBorderColors[b.status] || "border-l-gray-500"
                } ${isNew ? "animate-pulse-highlight" : ""} ${
                  canDecide ? "cursor-pointer hover:bg-white/5 border-r-white/20" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-14 bg-bg rounded-xl border border-white/10 flex flex-col items-center justify-center shrink-0">
                    <span className="font-extrabold text-sm text-accent">{startTimeStr}</span>
                    <span className="text-[10px] text-text-secondary">{endTimeStr}</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text text-base">
                        {b.client?.full_name || "Mijoz"}
                      </span>
                      <span
                        className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-md border ${
                          statusColors[b.status] || "bg-gray-500/10 text-gray-400"
                        }`}
                      >
                        {statusLabels[b.status] || b.status}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-text-secondary">
                      {b.service?.name || "Sartaroshlik xizmati"} • {new Intl.NumberFormat("uz-UZ").format(b.price_at_booking)} so'm
                    </p>

                    {b.client?.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <Phone size={12} />
                        <a href={`tel:${b.client.phone}`} className="hover:text-accent transition-colors">
                          {b.client.phone}
                        </a>
                      </div>
                    )}

                    {barber?.role === "admin" && b.barber && (
                      <p className="text-[10px] text-accent font-bold pt-1">
                        Sartarosh: {b.barber.full_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Action Controls */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  {b.status === "pending" && (
                    <>
                      {b.barber_id === barber?.id ? (
                        <button
                          onClick={() => setActiveDecisionBooking(b)}
                          className="flex items-center gap-1 px-3 py-2 bg-black text-white hover:bg-black/90 text-xs font-bold rounded-xl border border-black/20 active:scale-95 transition-all"
                        >
                          <Clock size={14} />
                          Qaror qabul qilish
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-text-secondary bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl">
                          Sartarosh qarori kutilmoqda
                        </span>
                      )}
                    </>
                  )}

                  {b.status === "confirmed" && b.barber_id === barber?.id && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus(b.id, "completed");
                        }}
                        disabled={isPendingAction}
                        className="flex items-center gap-1 px-3 py-2 bg-black/5 hover:bg-black/10 text-text text-xs font-bold rounded-xl border border-border active:scale-95 transition-all disabled:opacity-50"
                      >
                        <Check size={14} />
                        Tugadi
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus(b.id, "no_show");
                        }}
                        disabled={isPendingAction}
                        className="flex items-center gap-1 px-3 py-2 bg-black/5 hover:bg-black/10 text-text/70 text-xs font-bold rounded-xl border border-border active:scale-95 transition-all disabled:opacity-50"
                      >
                        <UserX size={14} />
                        Kelmadi
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus(b.id, "cancelled", barber?.role);
                        }}
                        disabled={isPendingAction}
                        className="flex items-center gap-1 px-3 py-2 bg-transparent hover:bg-black/5 text-red-500 hover:text-red-600 text-xs font-bold rounded-xl border border-transparent active:scale-95 transition-all disabled:opacity-50"
                      >
                        <X size={14} />
                        Bekor qilish
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decision Accept / Reject Modal */}
      {activeDecisionBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-3xl border border-white/10 p-6 space-y-4 shadow-2xl animate-fade-in text-xs">
            <div className="flex justify-between items-center border-b border-border/40 pb-3">
              <h3 className="text-base font-black tracking-tight">Buyurtmani tasdiqlash</h3>
              <button onClick={() => setActiveDecisionBooking(null)} className="text-text-secondary hover:text-text">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 p-4 bg-bg rounded-2xl border border-white/5">
              <div className="flex justify-between">
                <span className="text-text-secondary">Mijoz:</span>
                <span className="font-semibold text-text">{activeDecisionBooking.client?.full_name || "Mijoz"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Telefon:</span>
                <span className="font-semibold text-text">{activeDecisionBooking.client?.phone || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Xizmat:</span>
                <span className="font-semibold text-text">{activeDecisionBooking.service?.name || "Xizmat"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Vaqti:</span>
                <span className="font-semibold text-text">
                  {new Date(activeDecisionBooking.starts_at).toLocaleDateString("uz-UZ")} • {formatTime(activeDecisionBooking.starts_at)}
                </span>
              </div>
              {(activeDecisionBooking.notes || activeDecisionBooking.client_note) && (
                <div className="border-t border-white/5 pt-2 mt-2">
                  <span className="text-text-secondary block mb-1">Mijoz izohi:</span>
                  <p className="text-[11px] text-text italic">"{activeDecisionBooking.notes || activeDecisionBooking.client_note}"</p>
                </div>
              )}
            </div>

            {decisionError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-semibold text-xs flex items-center gap-1.5">
                <AlertCircle size={14} />
                {decisionError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleDecision(activeDecisionBooking.id, "declined")}
                disabled={actionInProgress !== null}
                className="w-full py-3 border border-red-500/30 text-red-500 hover:bg-red-500/10 font-bold rounded-xl active:scale-95 transition-all text-xs flex items-center justify-center gap-1"
              >
                <X size={14} /> Rad etish
              </button>
              <button
                onClick={() => handleDecision(activeDecisionBooking.id, "confirmed")}
                disabled={actionInProgress !== null}
                className="w-full py-3 bg-black hover:bg-black/90 text-white font-bold rounded-xl active:scale-95 transition-all text-xs flex items-center justify-center gap-1"
              >
                <Check size={14} /> Tasdiqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
