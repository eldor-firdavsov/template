import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Barber, Service } from "../lib/types";
import { createBooking, ensureClient } from "../lib/api";
import { uz } from "../lib/uz";
import { Check, Scissors, Clock, Calendar } from "lucide-react";

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
      note: localStorage.getItem("client_note") ?? "",
    };
  } catch {
    return { fullName: "", phone: "", note: "" };
  }
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("uz-UZ").format(price) + " " + uz.currency;
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  let formatted = digits;
  if (!formatted.startsWith("998") && formatted.length > 0) {
    formatted = "998" + formatted;
  }
  if (formatted.length === 0) return "";
  let res = "+998";
  if (formatted.length > 3) res += " " + formatted.substring(3, 5);
  if (formatted.length > 5) res += " " + formatted.substring(5, 8);
  if (formatted.length > 8) res += " " + formatted.substring(8, 10);
  if (formatted.length > 10) res += " " + formatted.substring(10, 12);
  return res;
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
  const [note, setNote] = useState(saved.note);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayBarber = assignedBarber ?? barber;
  const isReturningUser = Boolean(saved.fullName && saved.phone);

  const formatDate = (d: string) => {
    const dateObj = new Date(d + "T12:00:00Z");
    const weekday = uz.weekdays[dateObj.getUTCDay()] ?? "";
    const day = dateObj.getUTCDate();
    const month = uz.months[dateObj.getUTCMonth()] ?? "";
    return `${weekday}, ${day}-${month}`;
  };

  const handleConfirm = useCallback(async () => {
    setError(null);
    const nameTrimmed = fullName.trim();
    const phoneTrimmed = phone.trim();

    if (!nameTrimmed) {
      setError(uz.errors.nameRequired);
      return;
    }
    if (!phoneTrimmed || phoneTrimmed.replace(/\D/g, "").length !== 12) {
      setError(uz.errors.phoneRequired);
      return;
    }

    setBooking(true);
    try {
      // 1. Resolve or Create Client Profile (API with direct Supabase client fallback)
      let resolvedClientId = "";
      try {
        const clientResult = await ensureClient({
          full_name: nameTrimmed,
          phone: phoneTrimmed,
        });
        resolvedClientId = clientResult.client_id;
      } catch (apiErr) {
        console.warn("API ensureClient failed, using direct Supabase fallback:", apiErr);
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("phone", phoneTrimmed)
          .maybeSingle();

        if (existingClient) {
          resolvedClientId = existingClient.id;
          await supabase.from("clients").update({ full_name: nameTrimmed }).eq("id", resolvedClientId);
        } else {
          const synthId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 100000);
          const { data: newClient, error: cErr } = await supabase
            .from("clients")
            .insert({
              full_name: nameTrimmed,
              phone: phoneTrimmed,
              telegram_user_id: synthId,
            })
            .select("id")
            .single();

          if (cErr || !newClient) throw new Error(cErr?.message || "Mijoz profilini saqlashda xatolik");
          resolvedClientId = newClient.id;
        }
      }

      localStorage.setItem("client_id", resolvedClientId);
      localStorage.setItem("client_full_name", nameTrimmed);
      localStorage.setItem("client_phone", phoneTrimmed);
      localStorage.setItem("client_note", note);

      // 2. Create Booking (API with direct Supabase client fallback)
      let bookingSuccess = false;
      let finalBarber = displayBarber;

      try {
        const startsAt = new Date(`${date}T${time}:00Z`);
        const result = await createBooking({
          service_id: service.id,
          barber_id: displayBarber ? displayBarber.id : null,
          starts_at: startsAt.toISOString(),
          client_id: resolvedClientId,
          client_note: note.trim() || undefined,
        });
        if (result && result.booking_id) {
          bookingSuccess = true;
          if (result.barber) finalBarber = result.barber;
        }
      } catch (createErr) {
        console.warn("API createBooking failed, switching to direct Supabase fallback:", createErr);
      }

      if (!bookingSuccess) {
        if (!finalBarber) {
          const { data: firstBarber } = await supabase
            .from("barbers")
            .select("*")
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          if (firstBarber) finalBarber = firstBarber as Barber;
        }

        if (!finalBarber) {
          throw new Error("Hozirda faol sartarosh topilmadi. Qaytadan urinib ko'ring.");
        }

        const durationMinutes = service.duration_minutes || 30;
        const startsAtIso = new Date(`${date}T${time}:00Z`).toISOString();
        const endsAtIso = new Date(new Date(startsAtIso).getTime() + durationMinutes * 60 * 1000).toISOString();

        const { error: insErr } = await supabase
          .from("bookings")
          .insert({
            barber_id: finalBarber.id,
            service_id: service.id,
            client_id: resolvedClientId,
            starts_at: startsAtIso,
            ends_at: endsAtIso,
            status: "pending",
            price_at_booking: service.price || 0,
            notes: note.trim() || null,
          });

        if (insErr) {
          console.error("Direct booking insert failed:", insErr);
          throw new Error(insErr.message || "Buyurtmani saqlashda xatolik yuz berdi");
        }
      }

      onConfirm(finalBarber!);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : uz.errors.generic);
      setBooking(false);
    }
  }, [fullName, phone, note, displayBarber, service, date, time, onConfirm]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl hover:bg-surface active:scale-95 transition-all"
          aria-label={uz.actions.back}
          disabled={booking}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">{uz.steps.confirmBooking}</h2>
          {/* Reciprocity: tell them what they're getting */}
          <p className="text-xs text-muted mt-0.5">Shunchaki tekshirib tasdiqlang</p>
        </div>
      </div>

      {/* ── Reciprocity: Show their booking summary FIRST, contact form SECOND ── */}
      {/* IKEA Effect: This is "their" booking — ownership language throughout */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        {/* Booking header */}
        <div className="bg-accent/6 border-b border-accent/12 px-5 py-3">
          <div className="text-[10px] font-bold text-accent uppercase tracking-widest">
            Sizning bron
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Barber + service row */}
          <div className="flex items-center gap-3">
            {displayBarber?.photo_url ? (
              <img
                src={displayBarber.photo_url}
                alt={displayBarber.full_name}
                className="w-12 h-12 rounded-full object-cover shadow-sm"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold border border-accent/20">
                {displayBarber?.full_name ? displayBarber.full_name.charAt(0) : <Scissors size={18} />}
              </div>
            )}
            <div>
              <div className="font-bold text-sm text-primary">
                {displayBarber?.full_name ?? uz.summary.anyBarber}
              </div>
              <div className="text-xs text-muted">{service.name}</div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted flex items-center gap-1.5">
                <Calendar size={14} className="text-accent" />
                {uz.summary.date}
              </span>
              <span className="font-semibold">{formatDate(date)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted flex items-center gap-1.5">
                <Clock size={14} className="text-accent" />
                {uz.summary.time}
              </span>
              <span className="font-semibold">{time}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted flex items-center gap-1.5">
                <Clock size={14} />
                {uz.summary.duration}
              </span>
              <span className="font-semibold">{service.duration_minutes} daqiqa</span>
            </div>
          </div>

          <div className="h-px bg-border/50 my-3" />

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted">{uz.summary.price}</span>
            <span className="text-xl font-extrabold text-accent">
              {formatPrice(service.price)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold text-muted uppercase tracking-widest">
              {/* Smart Defaults: warm greeting for returning users */}
              {isReturningUser
                ? `Xush kelibsiz yana, ${saved.fullName.split(" ")[0]}!`
                : "Kim uchun bron?"}
            </div>
            {isReturningUser && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-success/10 text-success font-bold border border-success/20 flex items-center gap-1">
                Saqlangan <Check size={10} />
              </span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-danger/8 text-danger text-sm border border-danger/20 font-medium animate-slide-up">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5" htmlFor="confirm-name">
              {uz.contact.name}
            </label>
            <input
              id="confirm-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={uz.contact.namePlaceholder}
              className="w-full px-4 py-3 rounded-xl bg-bg border border-border text-sm font-medium focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all disabled:opacity-60"
              disabled={booking}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5" htmlFor="confirm-phone">
              {uz.contact.phone}
            </label>
            <input
              id="confirm-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
              placeholder="+998 XX XXX XX XX"
              className="w-full px-4 py-3 rounded-xl bg-bg border border-border text-sm font-medium focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all disabled:opacity-60"
              disabled={booking}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5" htmlFor="confirm-note">
              {uz.contact.note}
            </label>
            <textarea
              id="confirm-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={uz.contact.notePlaceholder}
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-bg border border-border text-sm font-medium focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all resize-none disabled:opacity-60"
              disabled={booking}
            />
          </div>
        </div>
      </div>

      {/* IKEA Effect: CTA says "Finalize YOUR booking" — ownership language */}
      <button
        onClick={handleConfirm}
        disabled={booking}
        className="w-full py-4 rounded-2xl bg-accent font-bold text-white text-sm
          hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-60
          flex items-center justify-center gap-2 shadow-lg shadow-accent/25"
      >
        {booking ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {uz.actions.confirming}
          </>
        ) : (
          <>
            Bronni yakunlash
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}
