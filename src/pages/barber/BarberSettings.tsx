import React, { useState, useEffect } from "react";
import { useBarberAuth } from "../../context/BarberAuthContext";
import { supabase } from "../../lib/supabase";
import { User, Phone, AlignLeft, Image, Save, Sparkles, Upload } from "lucide-react";

export const BarberSettings: React.FC = () => {
  const { barber, refreshBarber } = useBarberAuth();

  const [fullname, setFullname] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize fields with current barber values
  useEffect(() => {
    if (barber) {
      setFullname(barber.full_name || "");
      setPhone(barber.phone || "");
      setBio(barber.bio || "");
      setPhotoUrl(barber.photo_url || "");
    }
  }, [barber]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullname.trim()) {
      setError("Ism-sharifingizni kiriting.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Siz tizimga kirmagansiz.");
      }

      const response = await fetch("/api/barber/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          full_name: fullname.trim(),
          phone: phone.trim(),
          bio: bio.trim(),
          photo_url: photoUrl.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Profilni yangilashda xatolik yuz berdi.");
      }

      await refreshBarber();
      setSuccess(true);
      
      // Auto-hide success alert after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Xatolik yuz berdi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="bg-card p-4 rounded-2xl border border-white/10 shadow-sm">
        <h2 className="text-xl font-extrabold text-text">Profil Sozlamalari</h2>
        <p className="text-xs text-text-secondary">Shaxsiy ma'lumotlaringizni tahrirlang</p>
      </div>

      <div className="bg-card rounded-2xl border border-white/10 p-6 shadow-sm">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                To'liq ism-sharif
              </label>
              <div className="flex items-center bg-bg rounded-xl px-3 border border-white/10 focus-within:border-accent">
                <User size={18} className="text-text-secondary shrink-0 mr-2" />
                <input
                  type="text"
                  required
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  placeholder="masalan: Aziz Rahimov"
                  className="w-full py-3 bg-transparent text-text outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                Telefon raqam
              </label>
              <div className="flex items-center bg-bg rounded-xl px-3 border border-white/10 focus-within:border-accent">
                <Phone size={18} className="text-text-secondary shrink-0 mr-2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="masalan: +998901234567"
                  className="w-full py-3 bg-transparent text-text outline-none text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">
                Profil Rasmi (Avatar)
              </label>
              <label className="flex items-center gap-1.5 px-3 py-1 bg-accent/15 border border-accent/30 text-accent font-bold text-xs rounded-xl cursor-pointer hover:bg-accent hover:text-white transition-all">
                <Upload size={13} />
                <span>Fayldan yuklash</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.readAsDataURL(file);
                      reader.onload = () => {
                        if (typeof reader.result === "string") setPhotoUrl(reader.result);
                      };
                    }
                  }}
                />
              </label>
            </div>
            <div className="flex items-center bg-bg rounded-xl px-3 border border-white/10 focus-within:border-accent">
              <Image size={18} className="text-text-secondary shrink-0 mr-2" />
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg yoki fayldan tanlang"
                className="w-full py-3 bg-transparent text-text outline-none text-sm"
              />
            </div>
            {photoUrl && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={photoUrl}
                  alt="Avatar Preview"
                  className="w-16 h-16 rounded-full object-cover border-2 border-accent/40 shadow-md shadow-accent/10"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setPhotoUrl("")}
                  className="text-xs font-bold text-red-400 hover:underline"
                >
                  Avatar-ni o'chirish
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
              O'zingiz haqingizda (Bio)
            </label>
            <div className="flex bg-bg rounded-xl px-3 py-2 border border-white/10 focus-within:border-accent">
              <AlignLeft size={18} className="text-text-secondary shrink-0 mr-2 mt-1" />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tajribangiz va ixtisosligingiz haqida yozing..."
                rows={4}
                className="w-full bg-transparent text-text outline-none text-sm resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-semibold">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-fade-in">
              <Sparkles size={14} /> Profil ma'lumotlari muvaffaqiyatli saqlandi!
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-accent text-white font-extrabold rounded-xl text-xs active:scale-[0.98] disabled:opacity-50 transition-all shadow-md shadow-accent/20 hover:opacity-90 cursor-pointer"
            >
              <Save size={14} />
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
