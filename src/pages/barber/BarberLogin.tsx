import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useBarberAuth } from "../../context/BarberAuthContext";
import { Lock, Mail, Scissors, Calendar, Users, TrendingUp } from "lucide-react";

export const BarberLogin: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { signIn } = useBarberAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    if (hash.includes("error=") || search.includes("error=")) {
      const params = new URLSearchParams(hash.replace("#", "") || search.replace("?", ""));
      const errCode = params.get("error_code") || params.get("error");
      const errDesc = params.get("error_description");
      if (errCode === "otp_expired" || (errDesc && errDesc.includes("expired"))) {
        setError("Email tasdiqlash havolasi eskirgan yoki avval ishlatilgan. Iltimos, pastdagi shakl orqali tizimga kirishga urinib ko'ring.");
      } else if (errDesc) {
        setError(`Tasdiqlash xatoligi: ${decodeURIComponent(errDesc.replace(/\+/g, " "))}`);
      } else {
        setError("Hisobni tasdiqlashda xatolik yuz berdi. Qayta urinib ko'ring.");
      }
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email va parolni kiriting.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: signInError } = await signIn(email.trim(), password);

    if (signInError) {
      let msg = signInError.message || "Email yoki parol noto'g'ri.";
      if (msg.includes("Load failed") || msg.includes("Failed to fetch") || msg.includes("Network") || msg.includes("network")) {
        msg = "Server bilan aloqa uzildi (Tarmoq xatosi). Iltimos, internet ulanishingizni tekshiring yoki sahifani yangilab qayta urinib ko'ring.";
      } else if (msg.includes("rate limit") || msg.includes("too many") || msg.includes("429")) {
        msg = "Juda ko'p urinish bo'ldi. Iltimos, bir oz kutib qayta urinib ko'ring.";
      } else if (msg.includes("Invalid login credentials") || msg.includes("invalid claim") || msg.includes("user not found")) {
        msg = "Email manzil yoki parol noto'g'ri kiritildi.";
      }
      setError(msg);
      setSubmitting(false);
    } else {
      navigate("/barber/timetable");
    }
  };

  const featureChips = [
    { label: "Jadval", icon: Calendar },
    { label: "Mijozlar", icon: Users },
    { label: "Statistika", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center px-4 py-12 max-w-md mx-auto">

      {/* ── Reciprocity: Show value BEFORE asking to log in ── */}
      <div className="text-center mb-8 animate-fade-in">
        <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-accent/30">
          <Scissors size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-primary tracking-tight">Barber Portal</h1>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          Barcha bronlaringiz, mijozlaringiz va<br />jadvalingiz — bir joyda.
        </p>

        {/* Value proposition chips */}
        <div className="flex justify-center gap-2 mt-4 flex-wrap">
          {featureChips.map((chip) => {
            const Icon = chip.icon;
            return (
              <span
                key={chip.label}
                className="text-[11px] font-semibold px-3 py-1 rounded-full bg-surface border border-border/50 text-muted flex items-center gap-1.5"
              >
                <Icon size={12} className="text-accent" />
                {chip.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Login card */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-5 shadow-sm animate-slide-up">
        <div className="text-xs font-bold text-muted uppercase tracking-widest">Kirish</div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">
              Email manzil
            </label>
            <div className="flex items-center bg-bg rounded-xl px-3.5 border border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 transition-all">
              <Mail size={16} className="text-muted shrink-0 mr-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="barber@salon.uz"
                className="w-full py-3 bg-transparent text-primary outline-none text-sm font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">
              Parol
            </label>
            <div className="flex items-center bg-bg rounded-xl px-3.5 border border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 transition-all">
              <Lock size={16} className="text-muted shrink-0 mr-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-3 bg-transparent text-primary outline-none text-sm font-medium"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-danger/8 border border-danger/20 rounded-xl text-danger text-xs font-semibold animate-slide-up">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl transition-all shadow-md shadow-accent/20 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Kirish...
              </>
            ) : (
              <>Kirish →</>
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-muted mt-5">
        Hisob yo'qmi?{" "}
        <Link to="/barber/register" className="text-accent font-bold hover:underline">
          Ro'yxatdan o'tish
        </Link>
      </p>
    </div>
  );
};
