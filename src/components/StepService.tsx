import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Service, Location } from "../lib/types";
import { uz } from "../lib/uz";
import { Skeleton } from "./ui/Skeleton";
import { MapPin, Clock, ChevronRight, Sparkles, RefreshCw } from "lucide-react";

interface Props {
  selectedLocation?: Location | null;
  locationsCount?: number;
  onChangeLocation?: () => void;
  onSelect: (service: Service) => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("uz-UZ").format(price) + " " + uz.currency;
}

export function StepService({ selectedLocation, locationsCount = 1, onChangeLocation, onSelect }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopInfo, setShopInfo] = useState<{ name: string; address: string } | null>(null);

  useEffect(() => {
    async function load() {
      // 1. Get active barbers for the selected location if provided
      let barbersQuery = supabase
        .from("barbers")
        .select("id")
        .eq("is_active", true);

      if (selectedLocation) {
        barbersQuery = barbersQuery.eq("location_id", selectedLocation.id);
      }

      const { data: activeBarbers } = await barbersQuery;
      const activeBarberIds = (activeBarbers || []).map((b) => b.id);

      // 2. Get valid service IDs mapped to active barbers
      let validServiceIds: string[] = [];
      if (activeBarberIds.length > 0) {
        const { data: bsData } = await supabase
          .from("barber_services")
          .select("service_id")
          .in("barber_id", activeBarberIds);
        if (bsData && bsData.length > 0) {
          validServiceIds = Array.from(new Set(bsData.map((bs) => bs.service_id)));
        }
      }

      // 3. Build query for active services
      let query = supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      // Filter out unmapped template service cards if mappings exist
      if (validServiceIds.length > 0) {
        query = query.in("id", validServiceIds);
      }

      const [{ data, error }] = await Promise.all([query]);

      if (!error && data) setServices(data as Service[]);
      if (selectedLocation) {
        setShopInfo({ name: selectedLocation.name, address: selectedLocation.address });
      } else {
        const { data: loc } = await supabase
          .from("locations")
          .select("name, address")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (loc) setShopInfo(loc);
      }
      setLoading(false);
    }
    load();
  }, [selectedLocation]);

  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    const cat = s.category ?? "Boshqa";
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(s);
    return acc;
  }, {});

  // Smart Defaults: most popular = lowest sort_order
  const mostPopularId = services[0]?.id;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Reciprocity skeleton — shop info */}
        <div className="rounded-2xl bg-surface border border-border/50 p-4">
          <Skeleton className="w-32 h-3 mb-2" />
          <Skeleton className="w-48 h-4" />
        </div>
        <div>
          <Skeleton className="w-48 h-8 mb-1" />
          <Skeleton className="w-56 h-4" />
        </div>
        <div className="space-y-3">
          <Skeleton className="w-24 h-4 mb-3" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="w-full h-[76px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Reciprocity: Give value BEFORE asking for selection ── */}
      {shopInfo && (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-accent/6 border border-accent/15 animate-slide-up">
          <div className="w-8 h-8 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-accent uppercase tracking-wider">{shopInfo.name}</div>
            <div className="text-xs text-muted truncate mt-0.5">{shopInfo.address}</div>
          </div>
          {locationsCount > 1 && onChangeLocation ? (
            <button
              onClick={onChangeLocation}
              className="ml-auto shrink-0 flex items-center gap-1 text-[10px] font-bold text-accent bg-accent/10 border border-accent/20 px-2.5 py-1.5 rounded-xl hover:bg-accent hover:text-white transition-all active:scale-95"
            >
              <RefreshCw size={10} />
              O'zgartirish
            </button>
          ) : (
            <div className="ml-auto shrink-0 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
              <span className="text-[10px] font-semibold text-success">Ochiq</span>
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="text-2xl font-extrabold mb-1 tracking-tight">{uz.steps.chooseService}</h2>
        <p className="text-sm text-muted">{uz.steps.chooseServiceSub}</p>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mb-4">
          <h3 className="sticky top-[152px] z-10 bg-bg/95 backdrop-blur-sm text-[10px] font-bold uppercase tracking-widest text-muted/70 mb-3 px-1 py-2">
            {category}
          </h3>
          <div className="space-y-2">
            {items.map((service, idx) => {
              const isPopular = service.id === mostPopularId;
              return (
                <button
                  key={service.id}
                  onClick={() => onSelect(service)}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ios-press animate-slide-up ${
                    isPopular
                      ? "bg-accent/6 border-accent/25 hover:bg-accent/12 hover:border-accent/40 shadow-sm"
                      : "bg-card border-border/60 hover:border-accent/40 hover:bg-surface/50 shadow-sm"
                  }`}
                >
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-primary">{service.name}</span>
                      {/* Smart Defaults badge */}
                      {isPopular && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent text-white flex items-center gap-1">
                          <Sparkles size={10} />
                          Mashhur
                        </span>
                      )}
                    </div>
                    {/* Contrast Effect: duration provides context for the price */}
                    <div className="text-xs text-muted mt-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {service.duration_minutes} daqiqa
                    </div>
                  </div>
                  <div className="text-right ml-3 shrink-0 flex items-center gap-2">
                    <div className={`text-base font-extrabold ${isPopular ? "text-accent" : "text-primary"}`}>
                      {formatPrice(service.price)}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted/40" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
