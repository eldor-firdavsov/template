import { useEffect, useState } from "react";

interface Props {
  serviceId: string;
  onClose: () => void;
}

export function ServiceDetailModal({ serviceId, onClose }: Props) {
  const [service, setService] = useState<{
    name: string;
    description: string | null;
    duration_minutes: number;
    price: number;
    photo_url: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          import.meta.env.VITE_SUPABASE_URL ?? "",
          import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
        );
        const { data } = await supabase
          .from("services")
          .select("name, description, duration_minutes, price, photo_url")
          .eq("id", serviceId)
          .single();
        if (data) setService(data as any);
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
  }, [serviceId]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-bg w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto animate-slide-up">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold">About this service</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-48 bg-surface rounded-xl animate-pulse" />
            <div className="h-4 bg-surface rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-surface rounded w-1/2 animate-pulse" />
          </div>
        ) : service ? (
          <div className="space-y-4">
            {service.photo_url ? (
              <img
                src={service.photo_url}
                alt={service.name}
                className="w-full h-48 object-cover rounded-xl"
              />
            ) : (
              <div className="w-full h-48 bg-surface rounded-xl flex items-center justify-center">
                <svg className="w-12 h-12 text-muted/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0 0L12 12m4.243 4.243L19 19" />
                </svg>
              </div>
            )}
            <div>
              <h4 className="font-semibold text-lg">{service.name}</h4>
              <p className="text-sm text-muted mt-1">
                {service.duration_minutes} minutes
              </p>
            </div>
            <p className="text-sm leading-relaxed">
              {service.description ?? "No description available."}
            </p>
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Price</span>
                <span className="text-xl font-bold text-accent">${service.price}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-muted text-sm">Service not found.</div>
        )}
      </div>
    </div>
  );
}
