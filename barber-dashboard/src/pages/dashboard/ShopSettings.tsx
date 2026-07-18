import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ShopSettings() {
  const navigate = useNavigate();
  const [barber, setBarber] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"services" | "locations" | "barbers">("services");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Services state
  const [services, setServices] = useState<any[]>([]);
  const [newService, setNewService] = useState({
    name: "",
    category: "",
    duration_minutes: 30,
    price: 25,
  });

  // Locations state
  const [locations, setLocations] = useState<any[]>([]);
  const [newLocation, setNewLocation] = useState({
    name: "",
    address: "",
    phone: "",
    photo_url: "",
  });

  // Barbers state
  const [barbers, setBarbers] = useState<any[]>([]);

  useEffect(() => {
    const barberData = JSON.parse(localStorage.getItem("barber") || "{}");
    
    if (barberData.role !== "admin") {
      navigate("/dashboard");
      return;
    }
    
    setBarber(barberData);
    fetchServices();
    fetchLocations();
    fetchBarbers(barberData.location_id);
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetch("/api/services");
      const data = await response.json();
      setServices(data);
    } catch (err) {
      console.error("Failed to fetch services:", err);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations");
      const data = await response.json();
      setLocations(data);
    } catch (err) {
      console.error("Failed to fetch locations:", err);
    }
  };

  const fetchBarbers = async (locationId: string | null) => {
    if (!locationId) return;
    try {
      const response = await fetch(`/api/barbers?location_id=${locationId}`);
      const data = await response.json();
      setBarbers(data);
    } catch (err) {
      console.error("Failed to fetch barbers:", err);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newService),
      });

      if (!response.ok) {
        throw new Error("Failed to add service");
      }

      await fetchServices();
      setNewService({ name: "", category: "", duration_minutes: 30, price: 25 });
      setSuccess("Service added successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add service");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleService = async (serviceId: string, isActive: boolean) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: serviceId, is_active: isActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to update service");
      }

      await fetchServices();
      setSuccess("Service updated successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update service");
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLocation),
      });

      if (!response.ok) {
        throw new Error("Failed to add location");
      }

      await fetchLocations();
      setNewLocation({ name: "", address: "", phone: "", photo_url: "" });
      setSuccess("Location added successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add location");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBarber = async (barberId: string, isActive: boolean) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/barbers/${barberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to update barber");
      }

      await fetchBarbers(barber.location_id);
      setSuccess("Barber updated successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update barber");
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="text-xl font-semibold text-slate-900">Shop Settings</h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("services")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "services"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Services
          </button>
          <button
            onClick={() => setActiveTab("locations")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "locations"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Locations
          </button>
          <button
            onClick={() => setActiveTab("barbers")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "barbers"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Barbers
          </button>
        </div>

        {/* Services Tab */}
        {activeTab === "services" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Add New Service</h2>
              <form onSubmit={handleAddService} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  placeholder="Service name"
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
                <input
                  type="text"
                  value={newService.category}
                  onChange={(e) => setNewService({ ...newService, category: e.target.value })}
                  placeholder="Category"
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <input
                  type="number"
                  value={newService.duration_minutes}
                  onChange={(e) => setNewService({ ...newService, duration_minutes: parseInt(e.target.value) })}
                  placeholder="Duration (min)"
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
                <input
                  type="number"
                  value={newService.price}
                  onChange={(e) => setNewService({ ...newService, price: parseFloat(e.target.value) })}
                  placeholder="Price ($)"
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="md:col-span-4 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Add Service
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">All Services</h2>
              <div className="space-y-3">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <h3 className="font-medium text-slate-900">{service.name}</h3>
                      <p className="text-sm text-slate-600">
                        {service.category} • {service.duration_minutes} min • ${service.price}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={service.is_active}
                        onChange={(e) => handleToggleService(service.id, e.target.checked)}
                        disabled={loading}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Locations Tab */}
        {activeTab === "locations" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Add New Location</h2>
              <form onSubmit={handleAddLocation} className="space-y-4">
                <input
                  type="text"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                  placeholder="Location name"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
                <input
                  type="text"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                  placeholder="Address"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
                <input
                  type="tel"
                  value={newLocation.phone}
                  onChange={(e) => setNewLocation({ ...newLocation, phone: e.target.value })}
                  placeholder="Phone"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <input
                  type="url"
                  value={newLocation.photo_url}
                  onChange={(e) => setNewLocation({ ...newLocation, photo_url: e.target.value })}
                  placeholder="Photo URL"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Add Location
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">All Locations</h2>
              <div className="space-y-3">
                {locations.map((location) => (
                  <div
                    key={location.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <h3 className="font-medium text-slate-900">{location.name}</h3>
                      <p className="text-sm text-slate-600">{location.address}</p>
                      {location.phone && <p className="text-sm text-slate-600">{location.phone}</p>}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        location.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {location.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Barbers Tab */}
        {activeTab === "barbers" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Shop Barbers</h2>
              <button
                onClick={() => navigate("/dashboard/invite")}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Invite Barber
              </button>
            </div>
            <div className="space-y-3">
              {barbers.map((barberItem) => (
                <div
                  key={barberItem.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {barberItem.photo_url && (
                      <img
                        src={barberItem.photo_url}
                        alt={barberItem.full_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <h3 className="font-medium text-slate-900">{barberItem.full_name}</h3>
                      <p className="text-sm text-slate-600">{barberItem.phone}</p>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          barberItem.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {barberItem.role}
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={barberItem.is_active}
                      onChange={(e) => handleToggleBarber(barberItem.id, e.target.checked)}
                      disabled={loading}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                  </label>
                </div>
              ))}
              {barbers.length === 0 && (
                <p className="text-center text-slate-600 py-8">No barbers found. Invite your first barber!</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
