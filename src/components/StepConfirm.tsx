import { useState, useCallback } from "react";
import type { Barber, Service } from "../lib/types";
import { createBooking, ensureClient } from "../lib/api";

interface Props {
  service: Service;
  barber: Barber | null;
  assignedBarber: Barber | null;
  date: string;
  time: string;
  onConfirm: (barber: Barber) => void;
  onBack: () => void;
}

function getSavedCredentials() {
  try {
    return {
      fullName: localStorage.getItem("client_full_name") ?? "",
      phone: localStorage.getItem("client_phone") ?? "",
    };
  } catch {
    return { fullName: "", phone: "" };
  }
}

export function StepConfirm({
  service,
  barber,
  assignedBarber,
  date,
  time,
  onConfirm,
  onBack,
}: Props) {
  const saved = getSavedCredentials();
  const [fullName, setFullName] = useState(saved.fullName);
  const [phone, setPhone] = useState(saved.phone);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayBarber = assignedBarber ?? barber;

  const formatDate = (d: string) => {
    const dateObj = new Date(d + "T12:00:00Z");
    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  const handleConfirm = useCallback(async () => {
    setError(null);
    const nameTrimmed = fullName.trim();
    const phoneTrimmed = phone.trim();

    if (!nameTrimmed) {
      setError("Please enter your full name.");
      return;
    }
    if (!phoneTrimmed) {
      setError("Please enter your phone number.");
      return;
    }

    setBooking(true);
    try {
      // Ensure/create client by phone
      const clientResult = await ensureClient({
        full_name: nameTrimmed,
        phone: phoneTrimmed,
      });

      // Persist locally for future visits
      localStorage.setItem("client_id", clientResult.client_id);
      localStorage.setItem("client_full_name", nameTrimmed);
      localStorage.setItem("client_phone", phoneTrimmed);

      // Create the booking
      const startsAt = new Date(`${date}T${time}:00Z`);
      const result = await createBooking({
        service_id: service.id,
        barber_id: displayBarber ? displayBarber.id : null,
        starts_at: startsAt.toISOString(),
        client_id: clientResult.client_id,
      });

      onConfirm(result.barber);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create booking. Please try again.",
      );
      setBooking(false);
    }
  }, [fullName, phone, displayBarber, service, date, time, onConfirm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-surface active:scale-95 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-semibold">Confirm Booking</h2>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger/10 text-danger text-sm">
          {error}
        </div>
      )}

      {/* Booking Summary */}
      <div className="bg-surface rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          {displayBarber?.photo_url ? (
            <img
              src={displayBarber.photo_url}
              alt={displayBarber.full_name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold">
              {displayBarber?.full_name.charAt(0) ?? "?"}
            </div>
          )}
          <div>
            <div className="font-medium">
              {displayBarber?.full_name ?? "Any Available Barber"}
            </div>
            <div className="text-sm text-muted">{service.name}</div>
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Date</span>
            <span className="font-medium">{formatDate(date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Time</span>
            <span className="font-medium">{time}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Duration</span>
            <span className="font-medium">{service.duration_minutes} min</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between">
            <span className="text-muted">Price</span>
            <span className="text-lg font-bold text-accent">${service.price}</span>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-surface rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-sm text-muted uppercase tracking-wider">
          Your Details
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="confirm-name">
              Full Name
            </label>
            <input
              id="confirm-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-sm focus:outline-none focus:border-accent transition-colors"
              disabled={booking}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="confirm-phone">
              Phone Number
            </label>
            <input
              id="confirm-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +1 555 000 0000"
              className="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-sm focus:outline-none focus:border-accent transition-colors"
              disabled={booking}
            />
          </div>
        </div>
      </div>

      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        disabled={booking}
        className="w-full py-3.5 rounded-2xl bg-accent text-white font-semibold text-sm
          hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {booking ? "Booking…" : "Confirm Booking"}
      </button>
    </div>
  );
}
