import { useEffect, useState } from "react";
import { listBookings, cancelBooking, ensureClient, type ApiBooking } from "../lib/api";
import { uz } from "../lib/uz";
import { Skeleton } from "./ui/Skeleton";
import { supabase } from "../lib/supabase";
import { MapPin } from "lucide-react";

interface Props {
  onBack: () => void;
  onBookAnother: () => void;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const weekday = uz.weekdays[d.getUTCDay()] ?? "";
  const day = d.getUTCDate();
  const month = uz.monthsShort[d.getUTCMonth()] ?? "";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${weekday}, ${day}-${month} • ${hh}:${mm}`;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("uz-UZ").format(price) + " " + uz.currency;
}

function canCancel(startsAt: string): boolean {
  const start = new Date(startsAt);
  const now = new Date();
  return start.getTime() - now.getTime() > 60 * 60 * 1000;
}

const statusColor: Record<string, string> = {
  pending: "text-black bg-black/5 border border-black/15",
  confirmed: "text-white bg-black",
  declined: "text-black/40 bg-transparent border border-black/10 line-through",
  cancelled: "text-black/40 bg-transparent border border-black/10 line-through",
  completed: "text-black/60 bg-black/5",
  no_show: "text-black/40 bg-transparent border border-black/10",
};

const statusLabel: Record<string, string> = {
  pending: "Kutilmoqda",
  confirmed: "Tasdiqlangan",
  declined: "Rad etilgan",
  cancelled: "Bekor qilingan",
  completed: "Yakunlangan",
  no_show: "Kelmagan",
};

export function MyBookings({ onBack, onBookAnother }: Props) {
  const [location, setLocation] = useState<{ name: string; address: string; latitude?: number | null; longitude?: number | null } | null>(null);

  useEffect(() => {
    async function fetchLocation() {
      const { data } = await supabase
        .from("locations")
        .select("name, address, latitude, longitude")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (data) {
        setLocation(data);
      }
    }
    fetchLocation();
  }, []);

  const [clientId, setClientId] = useState<string | null>(
    () => localStorage.getItem("client_id"),
  );

  const [lookupPhone, setLookupPhone] = useState(
    () => localStorage.getItem("client_phone") ?? "",
  );
  const [lookupName, setLookupName] = useState(
    () => localStorage.getItem("client_full_name") ?? "",
  );
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    loadBookings(clientId);

    const channel = supabase
      .channel(`client-bookings-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          loadBookings(clientId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  async function loadBookings(id: string) {
    setLoadingBookings(true);
    try {
      const data = await listBookings(id);
      setBookings(data);
    } catch {
      console.error("Failed to load bookings");
    }
    setLoadingBookings(false);
  }

  async function handleLookup() {
    setLookupError(null);
    const nameTrimmed = lookupName.trim();
    const phoneTrimmed = lookupPhone.trim();

    if (!nameTrimmed || !phoneTrimmed) {
      setLookupError(uz.myBookings.lookupError);
      return;
    }

    setLookupLoading(true);
    try {
      const result = await ensureClient({ full_name: nameTrimmed, phone: phoneTrimmed });
      localStorage.setItem("client_id", result.client_id);
      localStorage.setItem("client_full_name", nameTrimmed);
      localStorage.setItem("client_phone", phoneTrimmed);
      setClientId(result.client_id);
    } catch {
      setLookupError(uz.myBookings.lookupError);
    }
    setLookupLoading(false);
  }

  async function handleCancel(bookingId: string) {
    if (!clientId) return;
    setCancellingId(bookingId);
    try {
      await cancelBooking(bookingId, clientId);
      await loadBookings(clientId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : uz.errors.generic);
    }
    setCancellingId(null);
  }

  function handleSignOut() {
    localStorage.removeItem("client_id");
    localStorage.removeItem("client_full_name");
    localStorage.removeItem("client_phone");
    localStorage.removeItem("client_note");
    setClientId(null);
    setBookings([]);
  }

  if (!clientId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-surface active:scale-95 transition-all"
            aria-label={uz.actions.back}
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
          <h2 className="text-xl font-bold">{uz.myBookings.title}</h2>
        </div>

        <div className="bg-surface rounded-2xl p-6 space-y-4 border border-border/50 shadow-sm">
          <p className="text-sm text-muted text-center">
            {uz.myBookings.lookupTitle}
          </p>

          {lookupError && (
            <div className="p-3 rounded-xl bg-danger/10 text-danger text-sm border border-danger/20">
              {lookupError}
            </div>
          )}

          <div>
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="lookup-name"
            >
              {uz.myBookings.lookupName}
            </label>
            <input
              id="lookup-name"
              type="text"
              value={lookupName}
              onChange={(e) => setLookupName(e.target.value)}
              placeholder={uz.contact.namePlaceholder}
              className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
              disabled={lookupLoading}
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="lookup-phone"
            >
              {uz.myBookings.lookupPhone}
            </label>
            <input
              id="lookup-phone"
              type="tel"
              value={lookupPhone}
              onChange={(e) => setLookupPhone(e.target.value)}
              placeholder={uz.contact.phonePlaceholder}
              className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
              disabled={lookupLoading}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            />
          </div>

          <button
            onClick={handleLookup}
            disabled={lookupLoading}
            className="w-full py-3 rounded-2xl bg-accent text-white font-semibold text-sm
              hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
          >
            {lookupLoading && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {lookupLoading ? uz.myBookings.lookingUp : uz.myBookings.lookupButton}
          </button>
        </div>

        <div className="text-center">
          <button onClick={onBookAnother} className="text-sm text-accent font-medium hover:underline">
            {uz.myBookings.bookAppointment}
          </button>
        </div>
      </div>
    );
  }

  // Upcoming = (confirmed or pending) AND in the future
  const upcoming = bookings.filter(
    (b) =>
      (b.status === "confirmed" || b.status === "pending") &&
      new Date(b.starts_at) >= new Date(),
  );
  const past = bookings.filter(
    (b) =>
      !(
        (b.status === "confirmed" || b.status === "pending") &&
        new Date(b.starts_at) >= new Date()
      ),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-surface active:scale-95 transition-all"
          aria-label={uz.actions.back}
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
        <h2 className="text-xl font-bold">{uz.myBookings.title}</h2>
        <button
          onClick={handleSignOut}
          className="ml-auto text-xs font-semibold text-muted hover:text-danger px-2 py-1 rounded-lg hover:bg-danger/10 transition-colors"
        >
          {uz.myBookings.signOut}
        </button>
      </div>

      {loadingBookings ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="w-24 h-4 mb-3" />
            <Skeleton className="w-full h-24 rounded-2xl" />
            <Skeleton className="w-full h-24 rounded-2xl" />
          </div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 space-y-4 bg-surface/50 rounded-3xl border border-dashed border-border/70">
          <div className="w-16 h-16 bg-bg rounded-full flex items-center justify-center mx-auto mb-2 text-muted">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-muted font-medium">{uz.myBookings.empty}</p>
          <button
            onClick={onBookAnother}
            className="py-3 px-6 rounded-2xl bg-accent text-white font-semibold text-sm
              hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-accent/20"
          >
            {uz.myBookings.bookAppointment}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <div className="space-y-3 relative">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                  {uz.myBookings.upcoming}
                </h3>
                <div className="flex-1 h-px bg-border/80" />
              </div>
              {upcoming.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  cancelling={cancellingId === b.id}
                  onCancel={() => handleCancel(b.id)}
                  location={location}
                />
              ))}
            </div>
          )}
          
          {past.length > 0 && (
            <div className="space-y-3 relative opacity-80">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                  {uz.myBookings.past}
                </h3>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              {past.map((b) => (
                <BookingCard key={b.id} booking={b} cancelling={false} location={location} />
              ))}
            </div>
          )}
        </div>
      )}

      {!loadingBookings && bookings.length > 0 && (
        <div className="text-center pt-4">
          <button onClick={onBookAnother} className="text-sm font-semibold text-accent hover:underline">
            {uz.actions.bookAnother}
          </button>
        </div>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  cancelling,
  onCancel,
  location,
}: {
  booking: ApiBooking;
  cancelling: boolean;
  onCancel?: () => void;
  location?: { name: string; address: string; latitude?: number | null; longitude?: number | null } | null;
}) {
  const isUpcoming =
    (booking.status === "confirmed" || booking.status === "pending") &&
    new Date(booking.starts_at) >= new Date();

  const isCancelable = canCancel(booking.starts_at);

  return (
    <div className="bg-surface rounded-2xl p-5 space-y-3 border border-border/50 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-[15px]">{booking.barber_name}</div>
          <div className="text-sm text-muted mt-0.5">{booking.service_name}</div>
        </div>
        <span
          className={`text-[11px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${statusColor[booking.status] ?? "text-muted bg-surface"}`}
        >
          {statusLabel[booking.status] ?? booking.status}
        </span>
      </div>
      <div className="h-px bg-border/40" />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] text-muted">{uz.summary.date}</div>
          <div className="font-semibold text-sm">{formatDateTime(booking.starts_at)}</div>
        </div>
        <div className="text-right">
          <div className="text-[13px] text-muted">{uz.summary.price}</div>
          <span className="text-sm font-bold text-accent">
            {formatPrice(booking.price_at_booking)}
          </span>
        </div>
      </div>
      
      {isUpcoming && location && (
        <div className="pt-2.5 border-t border-border/30 space-y-1 bg-surface">
          <div className="text-[9px] font-bold text-accent uppercase tracking-widest">
            Salon Manzili
          </div>
          <div>
            <div className="font-semibold text-xs text-text">{location.name}</div>
            <div className="text-[11px] text-muted mt-0.5">{location.address}</div>
          </div>
          <a
            href={
              location.latitude && location.longitude
                ? `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`
                : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.name + ", " + location.address)}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent hover:underline pt-1 cursor-pointer"
          >
            <MapPin size={11} /> Google Xaritasidan yo'nalish olish
          </a>
        </div>
      )}

      {isUpcoming && onCancel && (
        <div className="pt-3 flex flex-col items-end gap-1">
          <button
            onClick={onCancel}
            disabled={cancelling || !isCancelable}
            className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all w-full sm:w-auto
              ${isCancelable 
                ? "text-danger border border-danger/30 hover:bg-danger/10 active:scale-95 bg-bg" 
                : "text-muted/50 border border-border/50 bg-surface/50 cursor-not-allowed"}`}
          >
            {cancelling ? uz.actions.cancelling : uz.actions.cancel}
          </button>
          {!isCancelable && (
            <span className="text-[10px] text-muted/70 text-right w-full">
              Bekor qilish uchun vaqt o'tgan (kamida 1 soat oldin)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
