import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Barber, Service } from "../lib/types";

interface Props {
  service: Service;
  onSelect: (barber: Barber | null) => void;
  onBack: () => void;
}

export function StepBarber({ service, onSelect, onBack }: Props) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: bsData } = await supabase
        .from("barber_services")
        .select("barber_id")
        .eq("service_id", service.id);

      if (!bsData || bsData.length === 0) {
        setLoading(false);
        return;
      }

      const barberIds = bsData.map((bs) => bs.barber_id);

      const { data: barberData } = await supabase
        .from("barbers")
        .select("*")
        .in("id", barberIds)
        .eq("is_active", true)
        .order("sort_order");

      if (barberData) {
        setBarbers(barberData as Barber[]);
      }
      setLoading(false);
    }
    load();
  }, [service.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Loading barbers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-surface active:scale-95 transition-all"
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
        <div>
          <h2 className="text-xl font-semibold mb-1">Choose a Barber</h2>
          <p className="text-sm text-muted">{service.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onSelect(null)}
          className="flex flex-col items-center justify-center p-4 rounded-xl bg-accent/10 border-2 border-accent hover:bg-accent/20 active:scale-[0.98] transition-all"
        >
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mb-2">
            <svg
              className="w-8 h-8 text-accent"
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
          <span className="text-sm font-medium">Any available barber</span>
        </button>

        {barbers.map((barber) => (
          <button
            key={barber.id}
            onClick={() => onSelect(barber)}
            className="flex flex-col items-center p-4 rounded-xl bg-surface hover:bg-accent/10 active:scale-[0.98] transition-all"
          >
            {barber.photo_url ? (
              <img
                src={barber.photo_url}
                alt={barber.full_name}
                className="w-16 h-16 rounded-full object-cover mb-2"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mb-2 text-lg font-semibold text-accent">
                {barber.full_name.charAt(0)}
              </div>
            )}
            <span className="text-sm font-medium">{barber.full_name}</span>
            {barber.bio && (
              <span className="text-xs text-muted text-center mt-1 line-clamp-2">
                {barber.bio}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
