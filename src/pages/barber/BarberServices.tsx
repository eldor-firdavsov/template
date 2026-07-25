import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useBarberAuth } from "../../context/BarberAuthContext";
import type { Service } from "../../lib/types";
import { Plus, Edit2, ShieldAlert, Scissors } from "lucide-react";
import { Skeleton } from "../../components/ui/Skeleton";

export const BarberServices: React.FC = () => {
  const { barber } = useBarberAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  // Form states for Create/Edit Service
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(25000);
  const [saving, setSaving] = useState(false);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const svcRes = await supabase.from("services").select("*").order("sort_order", { ascending: true });

      if (svcRes.error) throw svcRes.error;
      setServices(svcRes.data || []);
    } catch (err) {
      console.error("Error fetching services:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  if (barber?.role !== "admin") {
    return (
      <div className="bg-card p-8 rounded-2xl border border-white/10 text-center space-y-3 animate-fade-in shadow-sm">
        <ShieldAlert size={32} className="text-amber-400 mx-auto" />
        <h2 className="text-lg font-bold text-text">Admin Only Access</h2>
        <p className="text-xs text-text-secondary">
          Only shop administrators can manage services and pricing.
        </p>
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingService(null);
    setName("");
    setCategory("General");
    setDuration(30);
    setPrice(25000);
    setModalOpen(true);
  };

  const openEditModal = (svc: Service) => {
    setEditingService(svc);
    setName(svc.name);
    setCategory(svc.category || "General");
    setDuration(svc.duration_minutes);
    setPrice(svc.price);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    try {
      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update({
            name: name.trim(),
            category: category.trim(),
            duration_minutes: Number(duration),
            price: Number(price),
          })
          .eq("id", editingService.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert({
          name: name.trim(),
          category: category.trim(),
          duration_minutes: Number(duration),
          price: Number(price),
        });

        if (error) throw error;
      }

      setModalOpen(false);
      await fetchServices();
    } catch (err) {
      console.error("Failed to save service:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (svc: Service) => {
    try {
      const { error } = await supabase
        .from("services")
        .update({ is_active: !svc.is_active })
        .eq("id", svc.id);

      if (error) throw error;
      setServices((prev) =>
        prev.map((s) => (s.id === svc.id ? { ...s, is_active: !s.is_active } : s))
      );
    } catch (err) {
      console.error("Failed to toggle service active state:", err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-white/10 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-text">Service Catalog (Admin)</h2>
          <p className="text-xs text-text-secondary">Manage available services, prices, and durations</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white font-bold rounded-xl text-xs active:scale-95 transition-all shadow-md shadow-accent/20 hover:opacity-90"
        >
          <Plus size={16} /> Add New Service
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="w-full h-24 rounded-2xl bg-card border border-white/10" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="bg-card p-12 rounded-3xl border border-dashed border-white/20 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-bg border border-white/5 flex items-center justify-center mx-auto mb-2 text-text-secondary">
            <Scissors size={28} />
          </div>
          <div>
            <h3 className="font-bold text-text text-lg">No services configured</h3>
            <p className="text-sm text-text-secondary mt-1 max-w-xs mx-auto">
              Add your first service to allow clients to start booking appointments.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((svc) => (
            <div
              key={svc.id}
              className={`bg-card rounded-2xl border p-5 space-y-3 transition-colors shadow-sm ${
                !svc.is_active ? "opacity-60 border-white/5" : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-accent tracking-wider">
                    {svc.category || "General"}
                  </span>
                  <h3 className="font-extrabold text-base text-text mt-0.5">{svc.name}</h3>
                  <p className="text-xs font-semibold text-text-secondary mt-1">
                    {new Intl.NumberFormat("uz-UZ").format(svc.price)} so'm • {svc.duration_minutes} mins
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(svc)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-text transition-colors active:scale-95"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleActive(svc)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors active:scale-95 ${
                      svc.is_active
                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    }`}
                  >
                    {svc.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-slide-up">
            <h3 className="text-lg font-bold text-text">
              {editingService ? "Edit Service" : "Add New Service"}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Service Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Haircut & Beard Trim"
                  className="w-full bg-bg px-3 py-2.5 rounded-xl text-xs border border-white/10 text-text outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Haircuts, Shaving, Coloring"
                  className="w-full bg-bg px-3 py-2.5 rounded-xl text-xs border border-white/10 text-text outline-none focus:border-accent transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Price (so'm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-bg px-3 py-2.5 rounded-xl text-xs border border-white/10 text-text outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                    Duration (mins)
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    required
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full bg-bg px-3 py-2.5 rounded-xl text-xs border border-white/10 text-text outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
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
                  {saving ? "Saving..." : "Save Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
