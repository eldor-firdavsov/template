import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ServicesSettings() {
  const navigate = useNavigate();
  const [barber, setBarber] = useState<any>(null);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [myServices, setMyServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const barberData = JSON.parse(localStorage.getItem("barber") || "{}");
    setBarber(barberData);

    fetchAllServices();
    fetchMyServices(barberData.id);
  }, []);

  const fetchAllServices = async () => {
    try {
      const response = await fetch("/api/services");
      const data = await response.json();
      setAllServices(data);
    } catch (err) {
      console.error("Failed to fetch services:", err);
    }
  };

  const fetchMyServices = async (barberId: string) => {
    try {
      const response = await fetch(`/api/barber-services?barber_id=${barberId}`);
      const data = await response.json();
      setMyServices(data);
    } catch (err) {
      console.error("Failed to fetch barber services:", err);
    }
  };

  const toggleService = async (serviceId: string, enabled: boolean) => {
    setLoading(true);
    setError("");

    try {
      if (enabled) {
        // Add service
        await fetch("/api/barber-services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barber_id: barber.id,
            service_id: serviceId,
          }),
        });
      } else {
        // Remove service
        await fetch("/api/barber-services", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barber_id: barber.id,
            service_id: serviceId,
          }),
        });
      }

      await fetchMyServices(barber.id);
      setSuccess("Services updated successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update services");
    } finally {
      setLoading(false);
    }
  };

  const myServiceIds = new Set(myServices.map((s) => s.service_id));

  if (!barber) {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-slate-600 hover:text-slate-900 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-xl font-semibold text-slate-900">My Services</h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
            {success}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Services You Offer
          </h2>
          <p className="text-slate-600 text-sm mb-6">
            Toggle the services you want to offer. Clients will only see enabled services when booking with you.
          </p>

          {allServices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600">No services available yet.</p>
              <p className="text-slate-500 text-sm mt-2">
                Contact your shop admin to add services.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allServices.map((service) => {
                const isEnabled = myServiceIds.has(service.id);
                const myService = myServices.find((s) => s.service_id === service.id);

                return (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-slate-900">{service.name}</h3>
                        {service.category && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {service.category}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {service.duration_minutes} min • ${service.price}
                      </p>
                      {isEnabled && myService?.custom_duration_minutes && (
                        <p className="text-xs text-slate-500 mt-1">
                          Custom duration: {myService.custom_duration_minutes} min
                        </p>
                      )}
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => toggleService(service.id, e.target.checked)}
                        disabled={loading}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          {myServices.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <h3 className="font-medium text-slate-900 mb-4">Custom Duration Overrides</h3>
              <p className="text-sm text-slate-600 mb-4">
                You can set custom durations for services if you take more or less time than the standard.
              </p>
              <div className="space-y-3">
                {myServices.map((barberService) => {
                  const service = allServices.find((s) => s.id === barberService.service_id);
                  if (!service) return null;

                  return (
                    <div key={barberService.service_id} className="flex items-center gap-4">
                      <span className="flex-1 text-sm font-medium">{service.name}</span>
                      <input
                        type="number"
                        defaultValue={barberService.custom_duration_minutes || service.duration_minutes}
                        className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        placeholder="Duration"
                      />
                      <span className="text-sm text-slate-600">min</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
