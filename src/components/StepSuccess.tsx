import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Barber, Service } from "../lib/types";
import { uz } from "../lib/uz";
import { MapPin } from "lucide-react";

interface Props {
  service: Service;
  barber: Barber;
  date: string;
  time: string;
  onBookAnother: () => void;
  onMyBookings: () => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("uz-UZ").format(price) + " " + uz.currency;
}

export function StepSuccess({
  service,
  barber,
  date,
  time,
  onBookAnother,
  onMyBookings,
}: Props) {
  const [location, setLocation] = useState<{ name: string; address: string } | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Small delay so the celebration animation plays after the slide-in
    const t = setTimeout(() => setShown(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    async function fetchLocation() {
      const { data } = await supabase
        .from("locations")
        .select("name, address")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (data) setLocation(data);
    }
    fetchLocation();
  }, []);

  const formatDate = (d: string) => {
    const dateObj = new Date(d + "T12:00:00Z");
    const weekday = uz.weekdays[dateObj.getUTCDay()] ?? "";
    const day = dateObj.getUTCDate();
    const month = uz.months[dateObj.getUTCMonth()] ?? "";
    return `${weekday}, ${day}-${month}`;
  };

  // Add to calendar URL (Google Calendar)
  const calendarUrl = (() => {
    try {
      const start = new Date(`${date}T${time}:00Z`);
      const end = new Date(start.getTime() + service.duration_minutes * 60 * 1000);
      const fmt = (d: Date) =>
        d.toISOString().replace(/[-:]/g, "").replace(".000", "");
      const title = encodeURIComponent(`${service.name} — ${barber.full_name}`);
      const details = encodeURIComponent(
        `Salon: ${location?.name ?? ""}\n${location?.address ?? ""}`
      );
      return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}`;
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-5 text-center animate-fade-in">
      {/* ── IKEA Effect: Celebration — they BUILT this ── */}
      <div className="pt-6">
        {/* Animated checkmark circle */}
        <div
          className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center transition-all ${
            shown ? "animate-celebrate" : "opacity-0 scale-0"
          }`}
          style={{ background: "linear-gradient(135deg, #c9a227 0%, #e8b84b 100%)" }}
        >
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="100"
              className="animate-draw-check"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* IKEA Effect: celebrate what they built */}
        <h2
          className={`text-2xl font-extrabold tracking-tight transition-all duration-500 ${
            shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          So'rov yuborildi! 🎉
        </h2>
        <p
          className={`text-sm text-muted mt-2 max-w-xs mx-auto leading-relaxed transition-all duration-500 delay-100 ${
            shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          Sartarosh buyurtmangizni tasdiqlaganidan keyin u tasdiqlanadi.
        </p>
      </div>

      {/* ── Booking ticket card — premium collectible feel ── */}
      <div
        className={`rounded-2xl border-2 border-dashed border-accent/30 bg-card overflow-hidden transition-all duration-500 delay-150 ${
          shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* Ticket header */}
        <div className="bg-accent/8 border-b border-accent/15 px-5 py-2.5 flex items-center justify-between">
          <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Bron chipta</span>
          <span className="text-[10px] text-muted font-medium">{formatDate(date)} • {time}</span>
        </div>

        <div className="p-5 space-y-4 text-left">
          {/* Barber row */}
          <div className="flex items-center gap-3">
            {barber.photo_url ? (
              <img
                src={barber.photo_url}
                alt={barber.full_name}
                className="w-11 h-11 rounded-full object-cover shadow-sm"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm border border-accent/20">
                {barber.full_name.charAt(0)}
              </div>
            )}
            <div>
              <div className="font-bold text-sm text-primary">{barber.full_name}</div>
              <div className="text-xs text-muted">{service.name}</div>
            </div>
          </div>

          <div className="h-px bg-border/50" />

          <div className="text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted">{uz.summary.date}</span>
              <span className="font-semibold">{formatDate(date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{uz.summary.time}</span>
              <span className="font-semibold">{time}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-muted">{uz.summary.price}</span>
              <span className="font-extrabold text-accent text-base">
                {formatPrice(service.price)}
              </span>
            </div>
          </div>
        </div>

        {/* Ticket tear divider */}
        <div className="flex items-center px-4">
          <div className="w-5 h-5 rounded-full bg-bg -ml-7 shrink-0" />
          <div className="flex-1 border-t-2 border-dashed border-border/50 mx-2" />
          <div className="w-5 h-5 rounded-full bg-bg -mr-7 shrink-0" />
        </div>

        {/* Add to calendar — IKEA Effect: further investment */}
        {calendarUrl && (
          <div className="px-5 py-3">
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-accent/25 bg-accent/6 text-accent text-xs font-bold hover:bg-accent/12 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Taqvimga qo'shish
            </a>
          </div>
        )}
      </div>

      {/* Location card */}
      {location && (
        <div
          className={`bg-card rounded-2xl p-4 text-left space-y-2 border border-border/50 shadow-sm transition-all duration-500 delay-300 ${
            shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="text-[10px] font-bold text-accent uppercase tracking-widest">
            Salon Manzili
          </div>
          <div>
            <div className="font-semibold text-sm">{location.name}</div>
            <div className="text-xs text-muted mt-0.5">{location.address}</div>
          </div>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.name + ", " + location.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline pt-1"
          >
            <MapPin size={13} /> Google Xaritasidan yo'nalish olish
          </a>
        </div>
      )}

      {/* Action buttons */}
      <div
        className={`space-y-3 transition-all duration-500 delay-400 ${
          shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <button
          onClick={onBookAnother}
          className="w-full py-4 rounded-2xl bg-accent font-bold text-white text-sm
            hover:bg-accent-hover active:scale-[0.98] transition-all shadow-lg shadow-accent/25"
        >
          {uz.actions.bookAnother}
        </button>
        <button
          onClick={onMyBookings}
          className="w-full py-3.5 rounded-2xl border-2 border-border text-sm font-bold text-primary
            hover:bg-surface hover:border-primary/20 active:scale-[0.98] transition-all"
        >
          {uz.actions.viewMyBookings}
        </button>
      </div>
    </div>
  );
}
