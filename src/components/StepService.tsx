import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Service } from "../lib/types";

interface Props {
  onSelect: (service: Service) => void;
}

export function StepService({ onSelect }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (!error && data) {
        setServices(data as Service[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    const cat = s.category ?? "Services";
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(s);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Choose a Service</h2>
        <p className="text-sm text-muted">Select what you'd like today</p>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted mb-2">
            {category}
          </h3>
          <div className="space-y-2">
            {items.map((service) => (
              <button
                key={service.id}
                onClick={() => onSelect(service)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-surface hover:bg-accent/10 active:scale-[0.98] transition-all"
              >
                <div className="text-left">
                  <div className="font-medium">{service.name}</div>
                  <div className="text-sm text-muted">
                    {service.duration_minutes} min
                  </div>
                </div>
                <div className="text-lg font-semibold text-accent">
                  ${service.price}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
