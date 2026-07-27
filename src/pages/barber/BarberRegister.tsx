import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Lock, Mail, ArrowLeft, Scissors, Check } from "lucide-react";

export const BarberRegister: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email va parolni kiriting.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Parollar mos emas.");
      return;
    }
    if (password.length < 6) {
      setError("Parol kamida 6 ta belgidan iborat bo'lishi kerak.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Try serverless backend registration first (auto-confirms email and bypasses client rate limits)
      const res = await fetch("/api/barber/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      if (res.ok) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (!signInError) {
          navigate("/barber/onboarding");
          return;
        }
      }
    } catch {
      // API call unavailable, fall back to direct Supabase client call
    }

    // Fallback direct Supabase client call
    const { error: signUpError, data: signUpData } = await supabase.auth.signUp({ email: cleanEmail, password });

    if (signUpError || (signUpData && signUpData.user && signUpData.user.identities && signUpData.user.identities.length === 0)) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!signInError) {
        navigate("/barber/onboarding");
        return;
      }

      let msg = signUpError?.message || "Ro'yxatdan o'tishda xatolik.";
      if (msg.includes("Load failed") || msg.includes("Failed to fetch") || msg.includes("Network") || msg.includes("network")) {
        msg = "Server bilan aloqa uzildi (Tarmoq xatosi). Iltimos, internet ulanishingizni tekshiring yoki sahifani yangilab qayta urinib ko'ring.";
      } else if (msg.includes("rate limit") || msg.includes("too many") || msg.includes("429")) {
        msg = "Juda ko'p urinish bo'ldi. Iltimos, 30 soniya kutib qayta urinib ko'ring.";
      } else if (msg.includes("User already registered") || msg.includes("already exists")) {
        msg = "Bu email manzil allaqachon ro'yxatdan o'tgan. Iltimos, parolingizni tekshiring yoki Login sahifasiga o'ting.";
      }
      setError(msg);
      setSubmitting(false);
    } else {
      navigate("/barber/onboarding");
    }
  };

  // Goal Gradient: show onboarding progress (they're on step 1 of 3)
  const steps = ["Hisob yaratish", "Sozlash", "Boshqaruv paneli"];
  const currentStep = 0;

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-center px-4 py-12 max-w-md mx-auto relative">
      <Link
        to="/barber/login"
        className="absolute top-6 left-4 flex items-center gap-1.5 text-xs font-bold text-muted hover:text-primary transition-colors"
      >
        <ArrowLeft size={14} /> Orqaga
      </Link>

      <div className="text-center mb-6 animate-fade-in">
        <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/30">
          <Scissors size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-primary tracking-tight">Ro'yxatdan o'tish</h1>
        <p className="text-sm text-muted mt-1">Saloningizni boshqarishni boshlang</p>
      </div>

      {/* ── Goal Gradient: onboarding 3-step progress — never at 0% ── */}
      <div className="mb-6 animate-slide-up">
        {/* Progress bar */}
        <div className="h-1.5 bg-surface rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-accent rounded-full animate-progress"
            style={{ width: `${Math.round(((currentStep + 1) / steps.length) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between">
          {steps.map((label, idx) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                idx === currentStep
                  ? "bg-accent border-accent text-white scale-110"
                  : idx < currentStep
                  ? "bg-accent/20 border-accent/30 text-accent"
                  : "bg-surface border-border text-muted/40"
              }`}>
                {idx < currentStep ? <Check size={10} className="stroke-[3]" /> : idx + 1}
              </div>
              <span className={`text-[9px] uppercase tracking-wider font-semibold ${
                idx === currentStep ? "text-accent" : "text-muted/50"
              }`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Register card */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-5 shadow-sm animate-slide-up">
        <div className="text-xs font-bold text-muted uppercase tracking-widest">1-qadam: Hisob</div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">Email manzil</label>
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
            <label className="block text-xs font-semibold text-muted mb-1.5">Parol</label>
            <div className="flex items-center bg-bg rounded-xl px-3.5 border border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 transition-all">
              <Lock size={16} className="text-muted shrink-0 mr-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kamida 6 ta belgi"
                className="w-full py-3 bg-transparent text-primary outline-none text-sm font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">Parolni tasdiqlash</label>
            <div className="flex items-center bg-bg rounded-xl px-3.5 border border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 transition-all">
              <Lock size={16} className="text-muted shrink-0 mr-2.5" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                Ro'yxatdan o'tilmoqda...
              </>
            ) : (
              "Davom etish →"
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-muted mt-5">
        Hisobingiz bormi?{" "}
        <Link to="/barber/login" className="text-accent font-bold hover:underline">
          Kirish
        </Link>
      </p>
    </div>
  );
};
