import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Location } from "../lib/types";
import { uz } from "../lib/uz";
import { Skeleton } from "./ui/Skeleton";
import { MapPin, Phone, ChevronRight, Building, ExternalLink, Navigation, Sparkles, ArrowLeft } from "lucide-react";

interface Props {
  onSelect: (location: Location) => void;
  selectedLocation?: Location | null;
}

export function StepLocation({ onSelect, selectedLocation: initialSelected }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeLoc, setActiveLoc] = useState<Location | null>(initialSelected ?? null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (!error && data) {
        const locs = data as Location[];
        setLocations(locs);
        if (!activeLoc && locs.length > 0) {
          if (locs.length === 1) {
            setActiveLoc(locs[0]!);
          }
        }
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
            <Skeleton key={i} className="w-full h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Selected Location Detail View ──
  if (activeLoc) {
    // Extract up to 3 photos
    const photosList: string[] = [];
    if (activeLoc.photos && Array.isArray(activeLoc.photos)) {
      activeLoc.photos.forEach((p: string) => {
        if (p && typeof p === "string" && p.trim()) photosList.push(p.trim());
      });
    }
    if (photosList.length === 0 && activeLoc.photo_url) {
      photosList.push(activeLoc.photo_url);
    }
    // Limit to max 3 photos
    const gallery = photosList.slice(0, 3);

    const lat = activeLoc.latitude ?? 41.31108;
    const lng = activeLoc.longitude ?? 69.24056;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const yandexMapsUrl = `https://yandex.com/maps/?pt=${lng},${lat}&z=16&l=map`;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    return (
      <div className="space-y-5 animate-fade-in">
        {locations.length > 1 && (
          <button
            onClick={() => setActiveLoc(null)}
            className="flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-hover transition-colors py-1"
          >
            <ArrowLeft size={16} />
            <span>Barcha filiallar ro'yxatiga qaytish</span>
          </button>
        )}

        {/* ── 1. Barbershop Gallery (Up to 3 Photos) ── */}
        <div className="space-y-2">
          <div className="relative w-full h-56 md:h-64 rounded-3xl overflow-hidden border border-white/10 shadow-lg bg-card group">
            {gallery.length > 0 ? (
              <img
                src={gallery[activePhotoIdx] || gallery[0]}
                alt={activeLoc.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-accent/10 text-accent gap-2">
                <Building size={48} />
                <span className="text-xs font-bold">{activeLoc.name}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            <div className="absolute bottom-4 left-4 right-4 text-white space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-accent text-white uppercase tracking-wider shadow-sm">
                  Filial
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/80 backdrop-blur-xs text-white">
                  Ochiq • 09:00 - 20:00
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight">{activeLoc.name}</h2>
            </div>
          </div>

          {/* Gallery Thumbnails (Up to 3) */}
          {gallery.length > 1 && (
            <div className="flex items-center gap-2 justify-center pt-1">
              {gallery.map((imgUrl, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhotoIdx(i)}
                  className={`relative w-16 h-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    activePhotoIdx === i
                      ? "border-accent scale-105 shadow-md shadow-accent/25"
                      : "border-white/10 opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={imgUrl} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 2. Location Info Details ── */}
        <div className="bg-card rounded-2xl border border-white/10 p-5 space-y-3.5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-text font-bold text-sm">
                <MapPin size={16} className="text-accent shrink-0" />
                <span>{activeLoc.address}</span>
              </div>
              {activeLoc.phone && (
                <div className="flex items-center gap-2 text-text-secondary text-xs">
                  <Phone size={14} className="shrink-0" />
                  <a href={`tel:${activeLoc.phone}`} className="hover:text-accent transition-colors font-medium">
                    {activeLoc.phone}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 3. Interactive Map Preview ── */}
        <div className="bg-card rounded-2xl border border-white/10 overflow-hidden shadow-sm space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-text-secondary">
              <MapPin size={16} className="text-accent" />
              <span>Xaritadagi joylashuv</span>
            </div>
            <span className="text-[10px] text-accent font-mono font-bold bg-accent/10 px-2 py-0.5 rounded-md border border-accent/20">
              {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
            </span>
          </div>

          {/* Embedded OpenStreetMap Preview Iframe */}
          <div className="relative w-full h-48 rounded-xl overflow-hidden border border-white/10 bg-bg group">
            <iframe
              title="Location Map"
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              marginHeight={0}
              marginWidth={0}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005}%2C${lat - 0.003}%2C${lng + 0.005}%2C${lat + 0.003}&layer=mapnik&marker=${lat}%2C${lng}`}
              className="w-full h-full filter contrast-[1.05] brightness-95"
            />
            {/* Custom Marker Pin Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="flex flex-col items-center animate-bounce-short">
                <div className="w-9 h-9 rounded-full bg-accent text-white border-2 border-white flex items-center justify-center shadow-lg shadow-accent/40">
                  <Building size={18} />
                </div>
                <div className="w-2 h-2 rounded-full bg-black/40 mt-0.5 blur-xs" />
              </div>
            </div>
          </div>

          {/* Navigation External Buttons */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-text text-[11px] font-bold transition-all active:scale-95 text-center"
            >
              <ExternalLink size={12} className="text-accent" />
              <span>Google Maps</span>
            </a>
            <a
              href={yandexMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-text text-[11px] font-bold transition-all active:scale-95 text-center"
            >
              <ExternalLink size={12} className="text-red-400" />
              <span>Yandex Maps</span>
            </a>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-accent/10 border border-accent/25 hover:bg-accent/20 text-accent text-[11px] font-bold transition-all active:scale-95 text-center"
            >
              <Navigation size={12} />
              <span>Yo'nalish</span>
            </a>
          </div>
        </div>

        {/* ── 4. Main Action Button: Choose Service ── */}
        <button
          onClick={() => onSelect(activeLoc)}
          className="w-full py-4 rounded-2xl bg-accent hover:bg-accent-hover text-white font-extrabold text-sm shadow-lg shadow-accent/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles size={18} />
          <span>Xizmatlarni ko'rish va tanlash</span>
          <ChevronRight size={18} />
        </button>
      </div>
    );
  }

  // ── Multiple Locations List View ──
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
            onClick={() => setActiveLoc(loc)}
            style={{ animationDelay: `${idx * 50}ms` }}
            className="w-full flex items-center justify-between p-4 rounded-2xl border border-border/60 bg-card hover:border-accent/40 hover:bg-surface/50 transition-all ios-press shadow-sm text-left animate-slide-up group cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
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
                Ma'lumot & Xaritalar
              </span>
              <ChevronRight className="w-4 h-4 text-muted/40 group-hover:text-accent transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
