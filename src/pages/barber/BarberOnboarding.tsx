import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBarberAuth } from "../../context/BarberAuthContext";
import { supabase } from "../../lib/supabase";
import {
  User,
  Store,
  Scissors,
  Check,
  ChevronLeft,
  Plus,
  X,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface StepType {
  key: string;
  icon: any;
  label: string;
}

const STEPS: StepType[] = [
  { key: "personal", icon: User, label: "Shaxsiy" },
  { key: "shop", icon: Store, label: "Salon" },
  { key: "hours", icon: Clock, label: "Ish Vaqti" },
  { key: "services", icon: Scissors, label: "Xizmatlar" },
  { key: "review", icon: Check, label: "Tasdiqlash" },
];

const SERVICE_DURATION_OPTIONS = [
  { value: "15", label: "15 daqiqa" },
  { value: "30", label: "30 daqiqa" },
  { value: "45", label: "45 daqiqa" },
  { value: "60", label: "1 soat" },
  { value: "90", label: "1.5 soat" },
  { value: "120", label: "2 soat" },
];

interface ExistingServiceOption {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  category?: string;
}

interface CustomService {
  name: string;
  category: string;
  duration: string;
  price: string;
}

export const BarberOnboarding: React.FC = () => {
  const { user, barber, refreshBarber, loading: authLoading } = useBarberAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated or already onboarded
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate("/barber/login");
      } else if (barber) {
        navigate("/barber/timetable");
      }
    }
  }, [user, barber, authLoading, navigate]);

  // Form states
  const [step, setStep] = useState(0);
  const [fullname, setFullname] = useState("");
  const [phone, setPhone] = useState("");

  // Shop states
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [latitude, setLatitude] = useState<number | null>(41.311081); // Default Tashkent coordinates
  const [longitude, setLongitude] = useState<number | null>(69.240562);

  // Hours states
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("20:00");

  // Services states
  const [existingServices, setExistingServices] = useState<ExistingServiceOption[]>([]);
  const [selectedExistingServiceIds, setSelectedExistingServiceIds] = useState<string[]>([]);
  const [customServices, setCustomServices] = useState<CustomService[]>([]);

  // Page level state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  // Fetch initial setup data
  useEffect(() => {
    async function loadData() {
      try {
        const svcRes = await supabase
          .from("services")
          .select("id, name, price, duration_minutes, category")
          .eq("is_active", true);

        if (svcRes.data) {
          setExistingServices(svcRes.data);
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    }
    loadData();
  }, []);

  // Phone validation
  const cleanPhone = (v: string) => v.replace(/\D/g, "");
  const isPhoneValid = cleanPhone(phone).length === 9;
  const formattedPhone = `+998${cleanPhone(phone)}`;

  const cleanShopPhone = (v: string) => v.replace(/\D/g, "");
  const isShopPhoneValid = shopPhone ? cleanShopPhone(shopPhone).length === 9 : true;
  const formattedShopPhone = shopPhone ? `+998${cleanShopPhone(shopPhone)}` : "";

  const handleAddCustomService = () => {
    setCustomServices([...customServices, { name: "", category: "Soch", duration: "30", price: "" }]);
  };

  const handleRemoveCustomService = (index: number) => {
    setCustomServices(customServices.filter((_, i) => i !== index));
  };

  const handleUpdateCustomService = (index: number, field: keyof CustomService, value: string) => {
    setCustomServices(
      customServices.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const toggleExistingService = (id: string) => {
    setSelectedExistingServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const canGoNext = () => {
    switch (step) {
      case 0:
        return fullname.trim() !== "" && isPhoneValid;
      case 1:
        return shopName.trim() !== "" && address.trim() !== "" && isShopPhoneValid;
      case 2:
        return startTime !== "" && endTime !== "";
      case 3:
        return (
          selectedExistingServiceIds.length > 0 ||
          customServices.some((s) => s.name.trim() !== "" && s.price.trim() !== "")
        );
      default:
        return true;
    }
  };

  const goNext = () => {
    if (!canGoNext()) return;
    setError(null);
    setDirection("next");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setDirection("prev");
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleFinish = async () => {
    setLoading(true);
    setError(null);

    try {
      const servicesPayload: Array<{ name: string; category: string; duration: number; price: number }> = [];

      // Add selected pre-seeded services
      selectedExistingServiceIds.forEach((id) => {
        const found = existingServices.find((s) => s.id === id);
        if (found) {
          servicesPayload.push({
            name: found.name,
            category: found.category || "Boshqa",
            duration: found.duration_minutes,
            price: found.price,
          });
        }
      });

      // Add custom services
      customServices.forEach((s) => {
        if (s.name.trim() && s.price.trim()) {
          servicesPayload.push({
            name: s.name.trim(),
            category: s.category.trim() || "Boshqa",
            duration: Number(s.duration) || 30,
            price: Number(s.price) || 0,
          });
        }
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Siz tizimga kirmagansiz. Iltimos, login qiling.");
      }

      let success = false;
      try {
        const response = await fetch("/api/barber/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: accessToken,
            fullname: fullname.trim(),
            phone: formattedPhone,
            shopName: shopName.trim(),
            address: address.trim(),
            shopPhone: formattedShopPhone,
            latitude,
            longitude,
            startTime,
            endTime,
            services: servicesPayload,
          }),
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const result = await response.json();
            if (result.success) {
              success = true;
            }
          }
        }
      } catch (apiErr) {
        console.warn("API onboarding call failed, switching to direct Supabase fallback:", apiErr);
      }

      if (!success) {
        // Direct Supabase Client Fallback if Vercel API fails or returns 500
        const authUser = sessionData?.session?.user;
        if (!authUser) throw new Error("Siz tizimga kirmagansiz. Iltimos, qayta login qiling.");

        // 1. Resolve or Insert Location
        let locId = "00000000-0000-0000-0000-000000000001";
        const { data: existingLoc } = await supabase.from("locations").select("id").limit(1).maybeSingle();
        if (existingLoc) {
          locId = existingLoc.id;
          await supabase.from("locations").update({
            name: shopName.trim(),
            address: address.trim(),
            phone: formattedShopPhone || null,
            latitude: latitude,
            longitude: longitude,
          }).eq("id", locId);
        } else {
          const { data: newLoc } = await supabase.from("locations").insert({
            name: shopName.trim(),
            address: address.trim(),
            phone: formattedShopPhone || null,
            latitude: latitude,
            longitude: longitude,
          }).select("id").single();
          if (newLoc) locId = newLoc.id;
        }

        // 2. Insert/Update Barber
        const { data: existingBarber } = await supabase.from("barbers").select("id").eq("auth_user_id", authUser.id).maybeSingle();
        let barberId: string;
        if (existingBarber) {
          barberId = existingBarber.id;
          await supabase.from("barbers").update({
            full_name: fullname.trim(),
            phone: formattedPhone,
            email: authUser.email,
            role: "admin",
            location_id: locId,
            is_active: true,
          }).eq("id", barberId);
        } else {
          const { data: newBarber, error: bErr } = await supabase.from("barbers").insert({
            full_name: fullname.trim(),
            phone: formattedPhone,
            email: authUser.email,
            auth_user_id: authUser.id,
            role: "admin",
            location_id: locId,
            is_active: true,
          }).select("id").single();
          if (bErr || !newBarber) throw new Error(bErr?.message || "Profil yaratishda xatolik yuz berdi");
          barberId = newBarber.id;
        }

        // 3. Save Working Hours
        const formatTime = (t: string) => (t.split(":").length === 2 ? `${t}:00` : t);
        const whs = [];
        for (let wd = 1; wd <= 6; wd++) {
          whs.push({
            barber_id: barberId,
            weekday: wd,
            start_time: formatTime(startTime || "09:00"),
            end_time: formatTime(endTime || "20:00"),
          });
        }
        await supabase.from("working_hours").delete().eq("barber_id", barberId);
        await supabase.from("working_hours").insert(whs);
      }

      await refreshBarber();
      navigate("/barber/timetable");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  };

  const slideClass =
    direction === "next" ? "animate-slide-in-right" : "animate-slide-in-left";

  return (
    <section className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card rounded-3xl border border-white/10 p-6 space-y-6 shadow-2xl relative">
        
        {/* Header navigation controls: Single Current Step Display */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button
                onClick={goBack}
                className="flex items-center gap-1 text-xs font-extrabold text-text-secondary hover:text-text transition-colors bg-surface/80 hover:bg-surface px-3 py-1.5 rounded-xl border border-border/50 active:scale-95"
              >
                <ChevronLeft size={16} /> Ortga
              </button>
            ) : (
              <div className="text-[11px] font-black uppercase tracking-wider text-accent bg-accent/10 px-3 py-1.5 rounded-xl border border-accent/20">
                Onboarding
              </div>
            )}

            {/* Current Step Pill */}
            <div className="flex items-center gap-1.5 text-xs font-black text-text bg-surface px-3 py-1.5 rounded-xl border border-border/40">
              <span className="text-accent">{step + 1}</span>
              <span className="text-muted">/</span>
              <span className="text-muted">{STEPS.length}</span>
            </div>
          </div>

          {/* Smooth Progress Bar */}
          <div className="w-full h-2 bg-surface rounded-full overflow-hidden p-0.5 border border-border/40">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          {/* ONLY Current Step Icon & Title (Clean, Ultra-Spacious, No Squeezing) */}
          {(() => {
            const currentStepItem = STEPS[step] || STEPS[0];
            const StepIcon = currentStepItem?.icon || User;
            const stepLabel = currentStepItem?.label || "";
            return (
              <div className="flex items-center gap-3 p-3 bg-surface/50 rounded-2xl border border-border/40 shadow-xs">
                <StepIcon size={20} className="text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-accent">
                    Bosqich {step + 1}
                  </p>
                  <h3 className="text-sm font-black text-primary truncate">
                    {stepLabel}
                  </h3>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Content Panels */}
        <div className={`${slideClass} space-y-6`}>
          
          {/* Step 0: Personal Info */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black text-text tracking-tight">Shaxsiy ma'lumotlar</h2>
                <p className="text-xs text-text-secondary">Ismingiz va bog'lanish telefon raqamingiz</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                    To'liq ismingiz
                  </label>
                  <input
                    type="text"
                    required
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                    placeholder="masalan: Alisher Karimov"
                    className="w-full bg-bg px-4 py-3.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                    Telefon raqam
                  </label>
                  <div className="flex items-center bg-bg rounded-xl px-4 border border-white/10 focus-within:border-accent">
                    <span className="text-text-secondary text-sm font-semibold mr-1.5">+998</span>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="90 123 45 67"
                      className="w-full py-3.5 bg-transparent text-text outline-none text-sm font-semibold"
                    />
                  </div>
                  {phone && !isPhoneValid && (
                    <p className="text-black/60 text-[10px] mt-1 font-bold">
                      Telefon raqami 9 ta raqamdan iborat bo'lishi kerak.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Shop Settings */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black text-text tracking-tight">Salon ma'lumotlari</h2>
                <p className="text-xs text-text-secondary">Salon nomi va manzili (Google Xaritaga mos)</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                    Salon nomi
                  </label>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="masalan: BarberShop Elite"
                    className="w-full bg-bg px-4 py-3.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                    Salon manzili
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="masalan: Chilonzor shoh ko'chasi, 25-uy"
                    className="w-full bg-bg px-4 py-3.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent text-sm transition-colors"
                  />
                </div>

                {/* Map Coordinates Picker */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">
                      Xaritadagi joylashuv (Geolokatsiya)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              setLatitude(Number(pos.coords.latitude.toFixed(6)));
                              setLongitude(Number(pos.coords.longitude.toFixed(6)));
                            },
                            (err) => {
                              console.warn("Geolokatsiya olinmadi:", err);
                            }
                          );
                        }
                      }}
                      className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      <Sparkles size={12} />
                      Mening joylashuvimni aniqlash
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-text-secondary font-medium block mb-1">Kenglik (Latitude)</span>
                      <input
                        type="number"
                        step="any"
                        value={latitude ?? ""}
                        onChange={(e) => setLatitude(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="41.311081"
                        className="w-full bg-bg px-3.5 py-2.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-text-secondary font-medium block mb-1">Uzunlik (Longitude)</span>
                      <input
                        type="number"
                        step="any"
                        value={longitude ?? ""}
                        onChange={(e) => setLongitude(e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="69.240562"
                        className="w-full bg-bg px-3.5 py-2.5 rounded-xl border border-white/10 text-text outline-none focus:border-accent text-xs font-mono"
                      />
                    </div>
                  </div>

                  {latitude && longitude && (
                    <div className="rounded-xl border border-white/10 overflow-hidden h-36 bg-surface relative flex items-center justify-center">
                      <iframe
                        title="Shop Location Map Preview"
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        scrolling="no"
                        src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`}
                        className="w-full h-full opacity-90 hover:opacity-100 transition-opacity"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                    Salon telefoni (ixtiyoriy)
                  </label>
                  <div className="flex items-center bg-bg rounded-xl px-4 border border-white/10 focus-within:border-accent">
                    <span className="text-text-secondary text-sm font-semibold mr-1.5">+998</span>
                    <input
                      type="tel"
                      value={shopPhone}
                      onChange={(e) => setShopPhone(e.target.value)}
                      placeholder="71 200 00 00"
                      className="w-full py-3.5 bg-transparent text-text outline-none text-sm font-semibold"
                    />
                  </div>
                  {shopPhone && !isShopPhoneValid && (
                    <p className="text-black/60 text-[10px] mt-1 font-bold">
                      Telefon raqami 9 ta raqamdan iborat bo'lishi kerak.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Hours Settings */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black text-text tracking-tight">Ish vaqti</h2>
                <p className="text-xs text-text-secondary">Faoliyat ko'rsatadigan shaxsiy ish vaqtingiz</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                      Ish boshlanishi
                    </label>
                    <div className="flex items-center bg-bg rounded-xl px-3 border border-white/10 focus-within:border-accent">
                      <Clock size={16} className="text-text-secondary mr-2 shrink-0" />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full py-3 bg-transparent text-text outline-none text-sm text-center font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                      Ish tugashi
                    </label>
                    <div className="flex items-center bg-bg rounded-xl px-3 border border-white/10 focus-within:border-accent">
                      <Clock size={16} className="text-text-secondary mr-2 shrink-0" />
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full py-3 bg-transparent text-text outline-none text-sm text-center font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Services Selection */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black text-text tracking-tight">Ko'rsatiladigan xizmatlar</h2>
                <p className="text-xs text-text-secondary">Salon taklif qiladigan xizmatlarni tanlang va yangilarini qo'shing</p>
              </div>

              <div className="space-y-4">
                {existingServices.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">
                      Mavjud xizmatlar
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-40 overflow-y-auto pr-1">
                      {existingServices.map((svc) => {
                        const selected = selectedExistingServiceIds.includes(svc.id);
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() => toggleExistingService(svc.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                              selected
                                ? "bg-accent/10 border-accent text-text"
                                : "bg-bg border-white/10 text-text-secondary hover:border-white/20"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-text truncate">{svc.name}</p>
                              <p className="text-[9px] text-text-secondary font-medium">
                                {svc.duration_minutes} daqiqa • {svc.price.toLocaleString()} so'm
                              </p>
                            </div>
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ml-2 ${
                                selected ? "bg-accent border-accent text-white" : "border-white/20"
                              }`}
                            >
                              {selected && <Check size={10} strokeWidth={3} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">
                    Yangi xizmat qo'shish
                  </label>
                  
                  <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
                    {customServices.map((svc, index) => (
                      <div
                        key={index}
                        className="flex gap-2 p-3 bg-bg rounded-xl border border-white/10 relative group"
                      >
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomService(index)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-all shadow-md"
                        >
                          <X size={10} />
                        </button>
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              required
                              value={svc.name}
                              onChange={(e) => handleUpdateCustomService(index, "name", e.target.value)}
                              placeholder="Xizmat nomi (masalan: Soch olish)"
                              className="w-1/2 bg-card px-3 py-2 rounded-lg border border-white/10 text-text outline-none text-xs"
                            />
                            <input
                              type="text"
                              required
                              value={svc.category}
                              onChange={(e) => handleUpdateCustomService(index, "category", e.target.value)}
                              placeholder="Kategoriya (masalan: Soch)"
                              className="w-1/2 bg-card px-3 py-2 rounded-lg border border-white/10 text-text outline-none text-xs"
                            />
                          </div>
                          <div className="flex gap-2">
                            <select
                              value={svc.duration}
                              onChange={(e) => handleUpdateCustomService(index, "duration", e.target.value)}
                              className="w-1/2 bg-card px-2 py-2 rounded-lg border border-white/10 text-text outline-none text-xs"
                            >
                              {SERVICE_DURATION_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              required
                              value={svc.price}
                              onChange={(e) => handleUpdateCustomService(index, "price", e.target.value)}
                              placeholder="Narxi (so'mda)"
                              className="w-1/2 bg-card px-3 py-2 rounded-lg border border-white/10 text-text outline-none text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCustomService}
                    className="w-full py-2 flex items-center justify-center gap-1.5 bg-bg text-text font-bold rounded-xl border border-dashed border-white/20 hover:bg-white/5 transition-all text-xs"
                  >
                    <Plus size={14} /> Yangi xizmat qo'shish
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black text-text tracking-tight">Ma'lumotlarni tekshiring</h2>
                <p className="text-xs text-text-secondary">Yakunlashdan oldin barcha ma'lumotlarni tekshirib oling</p>
              </div>

              <div className="space-y-3 p-4 rounded-2xl bg-bg border border-white/5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-text-secondary">Ega ismi:</span>
                  <span className="font-semibold text-text">{fullname}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-text-secondary">Telefon raqam:</span>
                  <span className="font-semibold text-text">{formattedPhone}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-text-secondary">Salon nomi:</span>
                  <span className="font-semibold text-text">{shopName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-text-secondary">Salon manzili:</span>
                  <span className="font-semibold text-text">{address}</span>
                </div>
                {shopPhone && (
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-text-secondary">Salon telefoni:</span>
                    <span className="font-semibold text-text">{formattedShopPhone}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-text-secondary">Ish vaqti:</span>
                  <span className="font-semibold text-text">
                    {startTime} - {endTime}
                  </span>
                </div>
                <div className="py-1.5">
                  <span className="text-text-secondary block mb-1">Tanlangan xizmatlar:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedExistingServiceIds.map((id) => {
                      const s = existingServices.find((item) => item.id === id);
                      return s ? (
                        <span key={id} className="text-[10px] font-bold bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-text">
                          {s.name}
                        </span>
                      ) : null;
                    })}
                    {customServices.map((s, idx) =>
                      s.name.trim() ? (
                        <span key={idx} className="text-[10px] font-bold bg-accent/10 border border-accent/25 px-2.5 py-1 rounded-lg text-accent">
                          {s.name} ({s.category})
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-semibold">
                  {error}
                </div>
              )}

              <button
                onClick={handleFinish}
                disabled={loading}
                className="w-full py-4 bg-accent hover:bg-accent/90 text-white font-extrabold rounded-xl transition-all shadow-lg shadow-accent/20 active:scale-[0.98] disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Yakunlanmoqda...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Profil va Salonni faollashtirish
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer Next Button (Steps 0-3) */}
        {step < 4 && (
          <div className="pt-4 border-t border-white/5 flex justify-end">
            <button
              onClick={goNext}
              disabled={!canGoNext()}
              className="flex items-center gap-1.5 px-6 py-3 bg-accent text-white font-bold rounded-xl text-xs active:scale-95 disabled:opacity-40 transition-all shadow-md shadow-accent/25 hover:opacity-95"
            >
              Davom etish <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
