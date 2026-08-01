import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Location } from "../lib/types";
import { uz } from "../lib/uz";
import { Skeleton } from "./ui/Skeleton";
import { MapPin, Phone, ChevronRight, Building } from "lucide-react";

interface Props {
  onSelect: (location: Location) => void;
}

export function StepLocation({ onSelect }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setLocations(data as Location[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <div>
          <Skeleton className="w-48 h-8 mb-1" />
          <Skeleton className="w-56 h-4" />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="w-full h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-2xl font-extrabold mb-1 tracking-tight">{uz.steps.chooseLocation}</h2>
        <p className="text-sm text-muted">{uz.steps.chooseLocationSub}</p>
      </div>

      <div className="space-y-3">
        {locations.map((loc, idx) => (
          <button
            key={loc.id}
            onClick={() => onSelect(loc)}
            style={{ animationDelay: `${idx * 50}ms` }}
            className="w-full flex items-center justify-between p-4 rounded-2xl border border-border/60 bg-card hover:border-accent/40 hover:bg-surface/50 transition-all ios-press shadow-sm text-left animate-slide-up group"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 group-hover:scale-105 transition-transform">
                {loc.photo_url ? (
                  <img src={loc.photo_url} alt={loc.name} className="w-12 h-12 rounded-2xl object-cover" />
                ) : (
                  <Building size={22} />
                )}
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="font-bold text-base text-primary flex items-center gap-1.5">
                  <span className="truncate">{loc.name}</span>
                </div>
                <div className="text-xs text-muted flex items-center gap-1">
                  <MapPin size={12} className="text-accent shrink-0" />
                  <span className="truncate">{loc.address}</span>
                </div>
                {loc.phone && (
                  <div className="text-[11px] text-muted/80 flex items-center gap-1 pt-0.5">
                    <Phone size={10} className="shrink-0" />
                    <span>{loc.phone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="ml-3 shrink-0 flex items-center gap-2">
              <span className="text-xs font-bold text-accent bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-xl group-hover:bg-accent group-hover:text-white transition-all">
                Tanlash
              </span>
              <ChevronRight className="w-4 h-4 text-muted/40 group-hover:text-accent transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
