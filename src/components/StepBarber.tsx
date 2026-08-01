import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Barber, Service, Location } from "../lib/types";
import { uz } from "../lib/uz";
import { Skeleton } from "./ui/Skeleton";
import { Check } from "lucide-react";

interface Props {
  service: Service;
  selectedLocation?: Location | null;
  onSelect: (barber: Barber | null) => void;
  onBack: () => void;
}

export function StepBarber({ service, selectedLocation, onSelect, onBack }: Props) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: bsData } = await supabase
        .from("barber_services")
        .select("barber_id")
        .eq("service_id", service.id);

      let barberIds: string[] = [];
      if (bsData && bsData.length > 0) {
        barberIds = bsData.map((bs) => bs.barber_id);
      }

      let query = supabase.from("barbers").select("*").eq("is_active", true).order("sort_order");
      if (selectedLocation) {
        query = query.eq("location_id", selectedLocation.id);
      }
      if (barberIds.length > 0) {
        query = query.in("id", barberIds);
      }

      const { data: barberData } = await query;
      if (barberData) setBarbers(barberData as Barber[]);
      setLoading(false);
    }
    load();
  }, [service.id, selectedLocation]);

  // IKEA Effect: handle selection with a brief animation delay before navigating
  const handleSelect = (barber: Barber | null) => {
    const id = barber?.id ?? "any";
    setSelected(id);
    setTimeout(() => onSelect(barber), 180);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div>
            <Skeleton className="w-40 h-6 mb-1" />
            <Skeleton className="w-24 h-4" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="w-full h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

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
          {/* IKEA Effect: ownership language — "Ustangizni" = "Your barber" */}
          <h2 className="text-xl font-extrabold mb-0.5 tracking-tight">Ustangizni tanlang</h2>
          <p className="text-sm text-muted">{service.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* "Any barber" card — shown first as default recommendation */}
        <button
          onClick={() => handleSelect(null)}
          className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ios-press relative overflow-hidden ${
            selected === "any"
              ? "bg-accent text-white border-accent shadow-lg shadow-accent/20 scale-[0.97]"
              : "bg-accent/6 border-accent/25 hover:bg-accent/12 hover:border-accent/40 shadow-sm"
          }`}
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 shadow-sm ${
            selected === "any" ? "bg-white/20" : "bg-accent/15"
          }`}>
            <svg
              className={`w-8 h-8 ${selected === "any" ? "text-white" : "text-accent"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <span className={`text-sm font-bold text-center ${selected === "any" ? "text-white" : ""}`}>
            {uz.barber.anyBarber}
          </span>
          {/* Social proof tip */}
          <span className={`text-[10px] text-center mt-1 font-medium ${
            selected === "any" ? "text-white/80" : "text-muted"
          }`}>
            Tezroq band bo'ladi
          </span>
          {selected === "any" && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/25 flex items-center justify-center animate-scale-in">
              <Check size={12} className="text-white stroke-[3]" />
            </div>
          )}
        </button>

        {barbers.map((barber, idx) => (
          <button
            key={barber.id}
            onClick={() => handleSelect(barber)}
            style={{ animationDelay: `${idx * 60}ms` }}
            className={`flex flex-col items-center p-4 rounded-2xl border transition-all ios-press relative overflow-hidden animate-slide-up ${
              selected === barber.id
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[0.97]"
                : "bg-card border-border/60 hover:border-accent/40 hover:bg-surface/50 shadow-sm"
            }`}
          >
            {barber.photo_url ? (
              <img
                src={barber.photo_url}
                alt={barber.full_name}
                className="w-16 h-16 rounded-full object-cover mb-2 shadow-sm"
              />
            ) : (
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 text-xl font-bold shadow-sm ${
                selected === barber.id
                  ? "bg-white/20 text-white"
                  : "bg-accent/10 text-accent border border-accent/20"
              }`}>
                {barber.full_name.charAt(0)}
              </div>
            )}
            <span className={`text-sm font-bold text-center ${selected === barber.id ? "text-white" : "text-primary"}`}>
              {barber.full_name}
            </span>
            {barber.bio && (
              <span className={`text-[10px] text-center mt-1 line-clamp-2 font-medium ${
                selected === barber.id ? "text-white/70" : "text-muted"
              }`}>
                {barber.bio}
              </span>
            )}
            {/* IKEA Effect: check mark confirms their choice */}
            {selected === barber.id && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/25 flex items-center justify-center animate-scale-in">
                <Check size={12} className="text-white stroke-[3]" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
