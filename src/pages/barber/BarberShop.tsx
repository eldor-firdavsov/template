import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useBarberAuth } from "../../context/BarberAuthContext";
import type { Location, Barber } from "../../lib/types";
import { Building, MapPin, Phone, ShieldAlert, Plus } from "lucide-react";
import { Skeleton } from "../../components/ui/Skeleton";

export const BarberShop: React.FC = () => {
  const { barber } = useBarberAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [barbersList, setBarbersList] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);

  // New location form
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [mapsInput, setMapsInput] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [saving, setSaving] = useState(false);

  const parseCoordinates = (val: string) => {
    setMapsInput(val);
    const clean = val.trim();
    if (!clean) return;

    // 1. Check if it's a simple Lat, Lng pair (e.g. "41.31108, 69.24056")
    const simpleCoordsRegex = /^(-?\d+\.\d+)\s*[\s,]\s*(-?\d+\.\d+)$/;
    const simpleMatch = clean.match(simpleCoordsRegex);
    if (simpleMatch && simpleMatch[1] && simpleMatch[2]) {
      setLatitude(simpleMatch[1]);
      setLongitude(simpleMatch[2]);
      return;
    }

    // 2. Check for Google Maps URL coordinate format (e.g. .../@41.31108,69.24056,17z...)
    const urlAtCoordsRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const urlAtMatch = clean.match(urlAtCoordsRegex);
    if (urlAtMatch && urlAtMatch[1] && urlAtMatch[2]) {
      setLatitude(urlAtMatch[1]);
      setLongitude(urlAtMatch[2]);
      return;
    }

    // 3. Check for Google Maps URL query format (e.g. ?q=41.31108,69.24056 or query=41.31108,69.24056)
    const urlQueryRegex = /[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const urlQueryMatch = clean.match(urlQueryRegex);
    if (urlQueryMatch && urlQueryMatch[1] && urlQueryMatch[2]) {
      setLatitude(urlQueryMatch[1]);
      setLongitude(urlQueryMatch[2]);
      return;
    }
  };

  const fetchShopData = async () => {
    setLoading(true);
    try {
      const [locRes, barbRes] = await Promise.all([
        supabase.from("locations").select("*").order("created_at", { ascending: true }),
        supabase.from("barbers").select("*"),
      ]);

      if (locRes.error) throw locRes.error;
      if (barbRes.error) throw barbRes.error;

      setLocations(locRes.data || []);
      setBarbersList(barbRes.data || []);
    } catch (err) {
      console.error("Error loading shop data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShopData();
  }, []);

  if (barber?.role !== "admin") {
    return (
      <div className="bg-card p-8 rounded-2xl border border-white/10 text-center space-y-3 animate-fade-in shadow-sm">
        <ShieldAlert size={32} className="text-amber-400 mx-auto" />
        <h2 className="text-lg font-bold text-text">Admin Only Access</h2>
        <p className="text-xs text-text-secondary">
          Only shop administrators can manage shop locations and settings.
        </p>
      </div>
    );
  }

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;
    setSaving(true);

    try {
      const latVal = latitude.trim() ? parseFloat(latitude) : null;
      const lngVal = longitude.trim() ? parseFloat(longitude) : null;

      const { error } = await supabase.from("locations").insert({
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim() || null,
        latitude: latVal,
        longitude: lngVal,
      });

      if (error) throw error;
      setModalOpen(false);
      setName("");
      setAddress("");
      setPhone("");
      setMapsInput("");
      setLatitude("");
      setLongitude("");
      await fetchShopData();
    } catch (err) {
      console.error("Failed to add location:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-white/10 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-text">Shop Locations & Staff (Admin)</h2>
          <p className="text-xs text-text-secondary">Manage shop branches and staff members</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white font-bold rounded-xl text-xs active:scale-95 transition-all shadow-md shadow-accent/20 hover:opacity-90"
        >
          <Plus size={16} /> Add Location
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="w-full h-40 rounded-2xl bg-card border border-white/10" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Locations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {locations.length === 0 ? (
              <div className="col-span-full bg-card p-12 rounded-3xl border border-dashed border-white/20 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-bg border border-white/5 flex items-center justify-center mx-auto mb-2 text-text-secondary">
                  <Building size={28} />
                </div>
                <div>
                  <h3 className="font-bold text-text text-lg">No locations configured</h3>
                  <p className="text-sm text-text-secondary mt-1 max-w-xs mx-auto">
                    Add your first shop location to allow barbers to be assigned to it.
                  </p>
                </div>
              </div>
            ) : (
              locations.map((loc) => {
                const staff = barbersList.filter((b) => b.location_id === loc.id);

                return (
                  <div key={loc.id} className="bg-card rounded-2xl border border-white/10 p-5 space-y-4 shadow-sm hover:border-white/20 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-extrabold text-base text-text flex items-center gap-2">
                          <Building size={16} className="text-accent" /> {loc.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1">
                          <MapPin size={12} />
                          <span>{loc.address}</span>
                        </div>
                        {loc.latitude && loc.longitude && (
                          <div className="flex items-center gap-1.5 text-[11px] text-accent mt-1 font-bold">
                            <MapPin size={11} />
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline flex items-center gap-1 bg-accent/15 px-2 py-0.5 rounded-lg border border-accent/25"
                            >
                              Maps: {Number(loc.latitude).toFixed(5)}, {Number(loc.longitude).toFixed(5)}
                            </a>
                          </div>
                        )}
                        {loc.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1">
                            <Phone size={12} />
                            <span>{loc.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-3">
                      <h4 className="text-xs font-bold text-text mb-2">Staff at Location ({staff.length})</h4>
                      <div className="space-y-1.5">
                        {staff.length === 0 ? (
                          <p className="text-[11px] text-text-secondary italic">No barbers assigned</p>
                        ) : (
                          staff.map((b) => (
                            <div
                              key={b.id}
                              className="flex items-center justify-between bg-bg px-3 py-2 rounded-xl text-xs border border-white/5"
                            >
                              <span className="font-semibold text-text">{b.full_name}</span>
                              <span className="text-[10px] text-accent uppercase font-extrabold px-2 py-0.5 rounded bg-accent/10">
                                {b.role}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-slide-up">
            <h3 className="text-lg font-bold text-text">Add Shop Location</h3>

            <form onSubmit={handleAddLocation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Location Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Downtown Branch"
                  className="w-full bg-bg px-3 py-2.5 rounded-xl text-xs border border-white/10 text-text outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Address
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 123 Main St, Suite 400"
                  className="w-full bg-bg px-3 py-2.5 rounded-xl text-xs border border-white/10 text-text outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998901234567"
                  className="w-full bg-bg px-3 py-2.5 rounded-xl text-xs border border-white/10 text-text outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Google Maps Link / Coordinates
                </label>
                <input
                  type="text"
                  value={mapsInput}
                  onChange={(e) => parseCoordinates(e.target.value)}
                  placeholder="Paste Map link or Lat, Lng (e.g. 41.2995, 69.2401)"
                  className="w-full bg-bg px-3 py-2.5 rounded-xl text-xs border border-white/10 text-text outline-none focus:border-accent transition-colors"
                />
                <p className="text-[10px] text-text-secondary mt-1">
                  Tip: Copy-paste standard coordinates or a Google Maps URL, we will automatically extract them.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="Latitude"
                    className="w-full bg-bg px-3 py-2.5 rounded-xl text-xs border border-white/10 text-text outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="Longitude"
                    className="w-full bg-bg px-3 py-2.5 rounded-xl text-xs border border-white/10 text-text outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setName("");
                    setAddress("");
                    setPhone("");
                    setMapsInput("");
                    setLatitude("");
                    setLongitude("");
                  }}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-text font-bold rounded-xl text-xs transition-colors active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-accent text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors active:scale-95 disabled:opacity-70 shadow-lg shadow-accent/20"
                >
                  {saving && (
                    <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {saving ? "Saving..." : "Save Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
