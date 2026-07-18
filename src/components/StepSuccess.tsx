import type { Barber, Service } from "../lib/types";

interface Props {
  service: Service;
  barber: Barber;
  date: string;
  time: string;
  onBookAnother: () => void;
  onMyBookings: () => void;
}

export function StepSuccess({
  service,
  barber,
  date,
  time,
  onBookAnother,
  onMyBookings,
}: Props) {
  const formatDate = (d: string) => {
    const dateObj = new Date(d + "T12:00:00Z");
    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  return (
    <div className="space-y-6 text-center">
      {/* Success Icon */}
      <div className="pt-8">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-10 h-10 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">You're Booked!</h2>
        <p className="text-muted mt-1">See you at the shop</p>
      </div>

      {/* Booking Summary */}
      <div className="bg-surface rounded-2xl p-5 text-left space-y-3">
        <div className="flex items-center gap-3">
          {barber.photo_url ? (
            <img
              src={barber.photo_url}
              alt={barber.full_name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold text-sm">
              {barber.full_name.charAt(0)}
            </div>
          )}
          <div>
            <div className="font-medium">{barber.full_name}</div>
            <div className="text-sm text-muted">{service.name}</div>
          </div>
        </div>
        <div className="h-px bg-border" />
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted">Date</span>
            <span>{formatDate(date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Time</span>
            <span>{time}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Price</span>
            <span className="font-semibold text-accent">${service.price}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={onBookAnother}
          className="w-full py-3.5 rounded-2xl bg-accent text-white font-semibold text-sm
            hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Book Another Appointment
        </button>
        <button
          onClick={onMyBookings}
          className="w-full py-3.5 rounded-2xl border border-border text-sm font-medium
            hover:bg-surface active:scale-[0.98] transition-all"
        >
          View My Bookings
        </button>
      </div>
    </div>
  );
}
