import { useEffect, useState } from "react";
import { listBookings, cancelBooking, ensureClient, type ApiBooking } from "../lib/api";

interface Props {
  onBack: () => void;
  onBookAnother: () => void;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function canCancel(startsAt: string): boolean {
  const start = new Date(startsAt);
  const now = new Date();
  return start.getTime() - now.getTime() > 60 * 60 * 1000;
}

export function MyBookings({ onBack, onBookAnother }: Props) {
  const [clientId, setClientId] = useState<string | null>(
    () => localStorage.getItem("client_id"),
  );

  // Phone-lookup state (for users without a stored client_id)
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupName, setLookupName] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (clientId) loadBookings(clientId);
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
      setLookupError("Please enter both your name and phone number.");
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
      setLookupError("Could not find your account. Check your details and try again.");
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
      alert(err instanceof Error ? err.message : "Failed to cancel booking.");
    }
    setCancellingId(null);
  }

  function handleSignOut() {
    localStorage.removeItem("client_id");
    localStorage.removeItem("client_full_name");
    localStorage.removeItem("client_phone");
    setClientId(null);
    setBookings([]);
  }

  // ── Phone Lookup Screen ────────────────────────────────────────────────
  if (!clientId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-surface active:scale-95 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-semibold">My Bookings</h2>
        </div>

        <div className="bg-surface rounded-2xl p-6 space-y-4">
          <p className="text-sm text-muted text-center">
            Enter your details to view your bookings.
          </p>

          {lookupError && (
            <div className="p-3 rounded-xl bg-danger/10 text-danger text-sm">
              {lookupError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="lookup-name">
              Full Name
            </label>
            <input
              id="lookup-name"
              type="text"
              value={lookupName}
              onChange={(e) => setLookupName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-sm focus:outline-none focus:border-accent transition-colors"
              disabled={lookupLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="lookup-phone">
              Phone Number
            </label>
            <input
              id="lookup-phone"
              type="tel"
              value={lookupPhone}
              onChange={(e) => setLookupPhone(e.target.value)}
              placeholder="e.g. +1 555 000 0000"
              className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-sm focus:outline-none focus:border-accent transition-colors"
              disabled={lookupLoading}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            />
          </div>

          <button
            onClick={handleLookup}
            disabled={lookupLoading}
            className="w-full py-3 rounded-2xl bg-accent text-white font-semibold text-sm
              hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {lookupLoading ? "Looking up…" : "View My Bookings"}
          </button>
        </div>

        <div className="text-center">
          <button onClick={onBookAnother} className="text-sm text-accent underline">
            Book an Appointment
          </button>
        </div>
      </div>
    );
  }

  // ── Bookings List ──────────────────────────────────────────────────────
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && new Date(b.starts_at) >= new Date(),
  );
  const past = bookings.filter(
    (b) => b.status !== "confirmed" || new Date(b.starts_at) < new Date(),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-surface active:scale-95 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-semibold">My Bookings</h2>
        <button
          onClick={handleSignOut}
          className="ml-auto text-xs text-muted hover:text-danger transition-colors"
        >
          Sign Out
        </button>
      </div>

      {loadingBookings ? (
        <div className="flex items-center justify-center h-40">
          <div className="text-muted text-sm">Loading bookings…</div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted">No bookings yet.</p>
          <button
            onClick={onBookAnother}
            className="py-3 px-6 rounded-2xl bg-accent text-white font-semibold text-sm
              hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Book an Appointment
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider px-1">
                Upcoming
              </h3>
              {upcoming.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  cancelling={cancellingId === b.id}
                  onCancel={() => handleCancel(b.id)}
                />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider px-1">
                Past
              </h3>
              {past.map((b) => (
                <BookingCard key={b.id} booking={b} cancelling={false} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="text-center pt-2">
        <button onClick={onBookAnother} className="text-sm text-accent underline">
          Book Another Appointment
        </button>
      </div>
    </div>
  );
}

function BookingCard({
  booking,
  cancelling,
  onCancel,
}: {
  booking: ApiBooking;
  cancelling: boolean;
  onCancel?: () => void;
}) {
  const isUpcoming =
    booking.status === "confirmed" && new Date(booking.starts_at) >= new Date();

  const statusColor: Record<string, string> = {
    confirmed: "text-green-600 bg-green-100 dark:bg-green-900/30",
    cancelled: "text-red-500 bg-red-100 dark:bg-red-900/20",
    completed: "text-muted bg-surface",
    no_show: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20",
  };

  return (
    <div className="bg-surface rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-sm">{booking.barber_name}</div>
          <div className="text-xs text-muted">{booking.service_name}</div>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${statusColor[booking.status] ?? "text-muted"}`}
        >
          {booking.status}
        </span>
      </div>
      <div className="text-sm text-muted">{formatDateTime(booking.starts_at)}</div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-accent">
          ${booking.price_at_booking}
        </span>
        {isUpcoming && onCancel && canCancel(booking.starts_at) && (
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="text-xs text-danger border border-danger/30 px-3 py-1 rounded-lg
              hover:bg-danger/10 active:scale-95 transition-all disabled:opacity-50"
          >
            {cancelling ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>
    </div>
  );
}
