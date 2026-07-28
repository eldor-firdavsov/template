import React, { useState, useEffect } from "react";
import { useBarberAuth } from "../../context/BarberAuthContext";
import { supabase } from "../../lib/supabase";
import {
  Users,
  Plus,
  Edit2,
  Lock,
  Power,
  X,
  Clock,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";

interface ServiceType {
  id: string;
  name: string;
  category: string;
}

interface BarberType {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  bio: string | null;
  photo_url: string | null;
  role: string;
  is_active: boolean;
  auth_user_id: string | null;
  services?: string[]; // IDs
  working_hours?: Array<{ weekday: number; start_time: string; end_time: string }>;
}

export const BarberTeam: React.FC = () => {
  const { barber: currentBarber } = useBarberAuth();
  const [barbers, setBarbers] = useState<BarberType[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<BarberType | null>(null);

  // Form states (Add/Edit)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullname, setFullname] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isStaffActive, setIsStaffActive] = useState(true);
  
  // Hours (default Monday to Saturday, 09:00 - 20:00)
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("20:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (currentBarber && currentBarber.role === "admin") {
      fetchTeamData();
    }
  }, [currentBarber]);

  const fetchTeamData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch all services
      const { data: svcData } = await supabase
        .from("services")
        .select("id, name, category")
        .eq("is_active", true);
      setServices(svcData || []);

      // 2. Fetch all barbers at same location
      const { data: barbersData, error: barbErr } = await supabase
        .from("barbers")
        .select("*")
        .eq("location_id", currentBarber?.location_id || "")
        .order("sort_order", { ascending: true });

      if (barbErr) throw barbErr;

      const loadedBarbers: BarberType[] = [];

      // 3. Load mappings for services and working hours
      for (const b of barbersData || []) {
        const [svcMappings, hoursMappings] = await Promise.all([
          supabase.from("barber_services").select("service_id").eq("barber_id", b.id),
          supabase.from("working_hours").select("weekday, start_time, end_time").eq("barber_id", b.id),
        ]);

        loadedBarbers.push({
          ...b,
          services: svcMappings.data?.map((m) => m.service_id) || [],
          working_hours: hoursMappings.data || [],
        });
      }

      setBarbers(loadedBarbers);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (target: BarberType) => {
    if (target.id === currentBarber?.id) {
      alert("O'z profilingizni faolsizlantira olmaysiz.");
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch("/api/barber/update-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          staffId: target.id,
          is_active: !target.is_active,
        }),
      });

      if (!response.ok) {
        let errMsg = "Deactivation failed";
        try {
          const result = await response.json();
          errMsg = result.error || errMsg;
        } catch {
          errMsg = `Server error (${response.status})`;
        }
        throw new Error(errMsg);
      }

      fetchTeamData();
    } catch (err: any) {
      alert(err.message || "Xatolik yuz berdi");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      // Construct working hours payload
      const hoursPayload = selectedDays.map((d) => ({
        weekday: d,
        start_time: startTime + ":00",
        end_time: endTime + ":00",
      }));

      const response = await fetch("/api/barber/create-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          email,
          password,
          fullname,
          phone: `+998${phone.replace(/\D/g, "")}`,
          bio,
          photo_url: photoUrl,
          services: selectedServices,
          workingHours: hoursPayload,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Registration failed");
      }

      setIsAddOpen(false);
      resetForms();
      fetchTeamData();
    } catch (err: any) {
      setFormError(err.message || "Xatolik yuz berdi");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBarber) return;
    setFormSubmitting(true);
    setFormError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const hoursPayload = selectedDays.map((d) => ({
        weekday: d,
        start_time: startTime.includes(":") && startTime.split(":").length === 2 ? startTime + ":00" : startTime,
        end_time: endTime.includes(":") && endTime.split(":").length === 2 ? endTime + ":00" : endTime,
      }));

      const response = await fetch("/api/barber/update-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          staffId: selectedBarber.id,
          fullname,
          phone: phone.startsWith("+") ? phone : `+998${phone.replace(/\D/g, "")}`,
          bio,
          photo_url: photoUrl,
          is_active: isStaffActive,
          services: selectedServices,
          workingHours: hoursPayload,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Update failed");
      }

      setIsEditOpen(false);
      resetForms();
      fetchTeamData();
    } catch (err: any) {
      setFormError(err.message || "Xatolik yuz berdi");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBarber) return;
    setFormSubmitting(true);
    setFormError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch("/api/barber/reset-staff-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          staffId: selectedBarber.id,
          password,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Password reset failed");
      }

      setIsResetOpen(false);
      resetForms();
    } catch (err: any) {
      setFormError(err.message || "Xatolik yuz berdi");
    } finally {
      setFormSubmitting(false);
    }
  };

  const openAdd = () => {
    resetForms();
    setIsAddOpen(true);
  };

  const openEdit = (b: BarberType) => {
    resetForms();
    setSelectedBarber(b);
    setFullname(b.full_name || "");
    setPhone(b.phone ? b.phone.replace("+998", "") : "");
    setBio(b.bio || "");
    setPhotoUrl(b.photo_url || "");
    setSelectedServices(b.services || []);
    setIsStaffActive(b.is_active);

    if (b.working_hours && b.working_hours.length > 0) {
      const days = b.working_hours.map((wh) => wh.weekday);
      setSelectedDays(days);
      const first = b.working_hours[0];
      if (first) {
        setStartTime(first.start_time.substring(0, 5));
        setEndTime(first.end_time.substring(0, 5));
      }
    }

    setIsEditOpen(true);
  };

  const openReset = (b: BarberType) => {
    resetForms();
    setSelectedBarber(b);
    setIsResetOpen(true);
  };

  const resetForms = () => {
    setEmail("");
    setPassword("");
    setFullname("");
    setPhone("");
    setBio("");
    setPhotoUrl("");
    setSelectedServices([]);
    setIsStaffActive(true);
    setStartTime("09:00");
    setEndTime("20:00");
    setSelectedDays([1, 2, 3, 4, 5, 6]);
    setFormError(null);
    setSelectedBarber(null);
  };

  const toggleServiceSelection = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleDaySelection = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort()
    );
  };

  if (currentBarber?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Users size={48} className="text-muted" />
        <h2 className="text-lg font-bold">Ruxsat berilmagan</h2>
        <p className="text-sm text-muted">Siz ushbu sahifaga kirish huquqiga ega emassiz.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 text-text">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Jamoa a'zolari</h2>
          <p className="text-xs text-text-secondary mt-1">Salon sartaroshlari tarkibini va sozlamalarini boshqaring</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold px-4 py-3 rounded-xl transition-all shadow-md shadow-accent/15"
        >
          <Plus size={16} /> Sartarosh qo'shish
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-surface rounded-2xl p-5 border border-border/50 animate-pulse space-y-3">
              <div className="w-12 h-12 rounded-full bg-border/40" />
              <div className="w-24 h-4 bg-border/40 rounded" />
              <div className="w-full h-8 bg-border/40 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-4 bg-black/5 border border-border rounded-xl text-center">
          <p className="text-sm font-semibold">{error}</p>
        </div>
      ) : barbers.length === 0 ? (
        <div className="text-center py-16 bg-surface/50 rounded-3xl border border-dashed border-border/80">
          <Users size={36} className="mx-auto text-muted mb-3" />
          <p className="text-sm text-muted">Jamoada sartaroshlar mavjud emas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {barbers.map((b) => (
            <div
              key={b.id}
              className={`bg-surface rounded-2xl p-5 border transition-all relative ${
                b.is_active ? "border-border/50 shadow-sm" : "border-border/20 opacity-60"
              }`}
            >
              {/* Inactive Banner */}
              {!b.is_active && (
                <span className="absolute top-4 right-4 bg-black text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                  Nofaol
                </span>
              )}

              <div className="flex items-start gap-3.5 mb-4">
                {b.photo_url ? (
                  <img
                    src={b.photo_url}
                    alt={b.full_name}
                    className="w-12 h-12 rounded-full object-cover border border-border/40 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-accent/5 border border-accent/15 flex items-center justify-center text-accent text-lg font-bold shrink-0">
                    {b.full_name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-bold text-sm truncate">{b.full_name}</h3>
                  <p className="text-xs text-text-secondary truncate mt-0.5">{b.email}</p>
                  <span className="inline-block text-[9px] font-bold uppercase tracking-wider bg-accent/5 text-accent border border-accent/15 px-2 py-0.5 rounded mt-1.5">
                    {b.role === "admin" ? "Salon Egasi (Admin)" : "Sartarosh"}
                  </span>
                </div>
              </div>

              {b.bio && <p className="text-xs text-text-secondary line-clamp-2 mb-4 italic">"{b.bio}"</p>}

              <div className="border-t border-border/40 pt-4 mt-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Telefon:</span>
                  <span className="font-semibold">{b.phone || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Xizmatlar:</span>
                  <span className="font-semibold">{b.services?.length || 0} ta</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Ish kunlari:</span>
                  <span className="font-semibold">{b.working_hours?.length || 0} kun</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border/30">
                <button
                  onClick={() => openReset(b)}
                  title="Parolni almashtirish"
                  className="p-2 text-text hover:bg-black/5 rounded-xl border border-border/50 active:scale-95 transition-all"
                >
                  <Lock size={14} />
                </button>
                <button
                  onClick={() => handleToggleActive(b)}
                  title={b.is_active ? "Faolsizlantirish" : "Faollashtirish"}
                  disabled={b.id === currentBarber?.id}
                  className={`p-2 rounded-xl border active:scale-95 transition-all ${
                    b.id === currentBarber?.id
                      ? "text-muted/40 border-border/20 cursor-not-allowed"
                      : "text-text hover:bg-black/5 border-border/50"
                  }`}
                >
                  <Power size={14} />
                </button>
                <button
                  onClick={() => openEdit(b)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-2 border border-border/50 rounded-xl hover:bg-black/5 active:scale-95 transition-all text-text"
                >
                  <Edit2 size={12} /> Tahrirlash
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit / Reset Password Modals */}
      {/* ---------------------------------------------------- */}

      {/* Add Barber Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-3xl border border-white/10 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] animate-fade-in text-xs">
            <div className="flex justify-between items-center border-b border-border/40 pb-3">
              <h3 className="text-base font-black tracking-tight">Yangi sartarosh qo'shish</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-text-secondary hover:text-text">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                    To'liq ismi
                  </label>
                  <input
                    type="text"
                    required
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                    placeholder="Alisher Karimov"
                    className="w-full bg-bg px-3 py-2.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                    Telefon raqam
                  </label>
                  <div className="flex items-center bg-bg rounded-xl px-3 border border-white/10 focus-within:border-accent">
                    <span className="text-text-secondary font-semibold mr-1">+998</span>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="90 123 45 67"
                      className="w-full py-2.5 bg-transparent text-text outline-none font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alisher@example.com"
                    className="w-full bg-bg px-3 py-2.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                    Password (Tizimga kirish uchun)
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Kamida 6 belgi"
                    className="w-full bg-bg px-3 py-2.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                  Bio (Tavsif)
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="masalan: Erkaklar sochni turmaklash ustasi, 5 yillik tajriba..."
                  rows={2}
                  className="w-full bg-bg px-3 py-2.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                  Rasm URL (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://image-link.com/avatar.jpg"
                  className="w-full bg-bg px-3 py-2.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent"
                />
              </div>

              {/* Services Offered checklist */}
              <div className="space-y-1.5">
                <label className="block font-bold text-text-secondary uppercase tracking-wider">
                  Sartarosh ko'rsatadigan xizmatlar
                </label>
                <div className="grid grid-cols-2 gap-2 border border-white/10 p-3 bg-bg rounded-2xl max-h-36 overflow-y-auto">
                  {services.map((s) => {
                    const active = selectedServices.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleServiceSelection(s.id)}
                        className="flex items-center gap-2 p-1.5 text-left hover:bg-white/5 rounded-lg text-text-secondary hover:text-text transition-colors"
                      >
                        {active ? (
                          <CheckSquare size={16} className="text-accent" />
                        ) : (
                          <Square size={16} />
                        )}
                        <span className="truncate">{s.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hours shift */}
              <div className="space-y-1.5">
                <label className="block font-bold text-text-secondary uppercase tracking-wider">
                  Ish kunlari va vaqtlari
                </label>
                <div className="border border-white/10 p-3 bg-bg rounded-2xl space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { num: 1, name: "Du" },
                      { num: 2, name: "Se" },
                      { num: 3, name: "Ch" },
                      { num: 4, name: "Pa" },
                      { num: 5, name: "Ju" },
                      { num: 6, name: "Sh" },
                      { num: 7, name: "Ya" },
                    ].map((d) => {
                      const selected = selectedDays.includes(d.num);
                      return (
                        <button
                          key={d.num}
                          type="button"
                          onClick={() => toggleDaySelection(d.num)}
                          className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center transition-all ${
                            selected
                              ? "bg-accent text-white"
                              : "bg-card border border-white/5 text-text-secondary hover:border-white/20"
                          }`}
                        >
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center bg-card rounded-xl px-2 border border-white/5">
                      <Clock size={14} className="text-text-secondary mr-1 shrink-0" />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full py-2 bg-transparent text-text outline-none text-center font-semibold"
                      />
                    </div>
                    <div className="flex items-center bg-card rounded-xl px-2 border border-white/5">
                      <Clock size={14} className="text-text-secondary mr-1 shrink-0" />
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full py-2 bg-transparent text-text outline-none text-center font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-semibold text-xs">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={formSubmitting}
                className="w-full py-3.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl transition-all shadow-md shadow-accent/15 flex items-center justify-center gap-1.5"
              >
                {formSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Kutilmoqda...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Sartaroshni ro'yxatdan o'tkazish
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Barber Modal */}
      {isEditOpen && selectedBarber && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-3xl border border-white/10 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] animate-fade-in text-xs">
            <div className="flex justify-between items-center border-b border-border/40 pb-3">
              <h3 className="text-base font-black tracking-tight">Sartarosh sozlamalarini tahrirlash</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-text-secondary hover:text-text">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                    To'liq ismi
                  </label>
                  <input
                    type="text"
                    required
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                    placeholder="Alisher Karimov"
                    className="w-full bg-bg px-3 py-2.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                    Telefon raqam
                  </label>
                  <div className="flex items-center bg-bg rounded-xl px-3 border border-white/10 focus-within:border-accent">
                    <span className="text-text-secondary font-semibold mr-1">+998</span>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="90 123 45 67"
                      className="w-full py-2.5 bg-transparent text-text outline-none font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                  Bio (Tavsif)
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="masalan: Erkaklar sochni turmaklash ustasi, 5 yillik tajriba..."
                  rows={2}
                  className="w-full bg-bg px-3 py-2.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                  Rasm URL
                </label>
                <input
                  type="text"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://image-link.com/avatar.jpg"
                  className="w-full bg-bg px-3 py-2.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent"
                />
              </div>

              {/* Status active */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsStaffActive(!isStaffActive)}
                  className="flex items-center gap-2 text-text-secondary hover:text-text font-bold uppercase tracking-wider"
                >
                  {isStaffActive ? (
                    <CheckSquare size={16} className="text-accent" />
                  ) : (
                    <Square size={16} />
                  )}
                  Faol status
                </button>
              </div>

              {/* Services Offered checklist */}
              <div className="space-y-1.5">
                <label className="block font-bold text-text-secondary uppercase tracking-wider">
                  Sartarosh ko'rsatadigan xizmatlar
                </label>
                <div className="grid grid-cols-2 gap-2 border border-white/10 p-3 bg-bg rounded-2xl max-h-36 overflow-y-auto">
                  {services.map((s) => {
                    const active = selectedServices.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleServiceSelection(s.id)}
                        className="flex items-center gap-2 p-1.5 text-left hover:bg-white/5 rounded-lg text-text-secondary hover:text-text transition-colors"
                      >
                        {active ? (
                          <CheckSquare size={16} className="text-accent" />
                        ) : (
                          <Square size={16} />
                        )}
                        <span className="truncate">{s.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hours shift */}
              <div className="space-y-1.5">
                <label className="block font-bold text-text-secondary uppercase tracking-wider">
                  Ish kunlari va vaqtlari
                </label>
                <div className="border border-white/10 p-3 bg-bg rounded-2xl space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { num: 1, name: "Du" },
                      { num: 2, name: "Se" },
                      { num: 3, name: "Ch" },
                      { num: 4, name: "Pa" },
                      { num: 5, name: "Ju" },
                      { num: 6, name: "Sh" },
                      { num: 7, name: "Ya" },
                    ].map((d) => {
                      const selected = selectedDays.includes(d.num);
                      return (
                        <button
                          key={d.num}
                          type="button"
                          onClick={() => toggleDaySelection(d.num)}
                          className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center transition-all ${
                            selected
                              ? "bg-accent text-white"
                              : "bg-card border border-white/5 text-text-secondary hover:border-white/20"
                          }`}
                        >
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center bg-card rounded-xl px-2 border border-white/5">
                      <Clock size={14} className="text-text-secondary mr-1 shrink-0" />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full py-2 bg-transparent text-text outline-none text-center font-semibold"
                      />
                    </div>
                    <div className="flex items-center bg-card rounded-xl px-2 border border-white/5">
                      <Clock size={14} className="text-text-secondary mr-1 shrink-0" />
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full py-2 bg-transparent text-text outline-none text-center font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-semibold text-xs">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={formSubmitting}
                className="w-full py-3.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl transition-all shadow-md shadow-accent/15 flex items-center justify-center gap-1.5"
              >
                {formSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Kutilmoqda...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Sartarosh ma'lumotlarini saqlash
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {isResetOpen && selectedBarber && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-3xl border border-white/10 p-6 space-y-4 shadow-2xl animate-fade-in text-xs">
            <div className="flex justify-between items-center border-b border-border/40 pb-3">
              <h3 className="text-base font-black tracking-tight">Parolni o'zgartirish</h3>
              <button onClick={() => setIsResetOpen(false)} className="text-text-secondary hover:text-text">
                <X size={18} />
              </button>
            </div>

            <p className="text-text-secondary text-[11px]">
              Sartarosh <strong>{selectedBarber.full_name}</strong> uchun yangi login parolini belgilang.
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block font-bold text-text-secondary uppercase tracking-wider mb-1.5">
                  Yangi parol
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kamida 6 belgi"
                  className="w-full bg-bg px-3 py-2.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent"
                />
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 font-semibold text-xs">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={formSubmitting}
                className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl transition-all shadow-md shadow-accent/15 flex items-center justify-center gap-1.5"
              >
                {formSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Kutilmoqda...
                  </>
                ) : (
                  <>
                    <Lock size={14} /> Parolni yangilash
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
