import { useState } from "react";
import { useBookingFlow } from "../hooks/useBookingFlow";
import { StepService } from "./StepService";
import { StepBarber } from "./StepBarber";
import { StepTime } from "./StepTime";
import { StepConfirm } from "./StepConfirm";
import { StepSuccess } from "./StepSuccess";
import { MyBookings } from "./MyBookings";
import type { Barber, Service } from "../lib/types";
import { uz } from "../lib/uz";
import { supabase } from "../lib/supabase";

import { Scissors } from "lucide-react";

export function ClientBookingApp({ initialStep }: { initialStep?: "bookings" }) {
  const {
    state,
    selectService,
    selectBarber,
    selectTime,
    confirmBooking,
    goToStep,
    reset,
  } = useBookingFlow();
  const [assignedBarber, setAssignedBarber] = useState<Barber | null>(null);

  if (initialStep === "bookings" && state.step !== "bookings") {
    goToStep("bookings");
  }

  const handleSelectService = async (service: Service) => {
    const { data: mappings } = await supabase
      .from("barber_services")
      .select("barber_id")
      .eq("service_id", service.id);

    if (mappings && mappings.length > 0) {
      const barberIds = mappings.map((m) => m.barber_id);
      const { data: barbers } = await supabase
        .from("barbers")
        .select("*")
        .in("id", barberIds)
        .eq("is_active", true);

      if (barbers && barbers.length === 1) {
        selectService(service);
        selectBarber(barbers[0]);
        goToStep("time");
        return;
      }
    }

    selectService(service);
    goToStep("barber");
  };

  const handleBack = async () => {
    if (state.step === "time" && state.selectedService) {
      const { data: mappings } = await supabase
        .from("barber_services")
        .select("barber_id")
        .eq("service_id", state.selectedService.id);

      if (mappings && mappings.length > 0) {
        const barberIds = mappings.map((m) => m.barber_id);
        const { data: barbers } = await supabase
          .from("barbers")
          .select("id")
          .in("id", barberIds)
          .eq("is_active", true);

        if (barbers && barbers.length === 1) {
          goToStep("service");
          return;
        }
      }
    }

    const backMap: Record<string, string> = {
      barber: "service",
      time: "barber",
      confirm: "time",
    };
    const prev = backMap[state.step];
    if (prev) goToStep(prev as "service" | "barber" | "time");
  };

  const handleBookAnother = () => {
    reset();
    setAssignedBarber(null);
  };

  // ── Goal Gradient: treat "arrived at app" as step 1 completed ──
  // Visible steps: service(1) → barber(2) → time(3) → confirm(4) → success(5)
  // Start at 20% so user NEVER sees 0%.
  const stepOrder = ["service", "barber", "time", "confirm", "success"];
  const currentStepIndex = stepOrder.indexOf(state.step);

  // Progress: step 1 = 20%, step 2 = 40%, ... step 5 = 100%
  // Even before selecting anything, they've already "arrived" — that's progress.
  const progressPercent = Math.round(((currentStepIndex + 1) / stepOrder.length) * 100);

  const stepLabels = ["Xizmat", "Usta", "Vaqt", "Tasdiqlash", "Bajarildi"];
  const stepLabelFull = stepLabels[currentStepIndex] ?? "";

  const showProgress =
    state.step !== "success" &&
    state.step !== "bookings";

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-md md:max-w-5xl mx-auto px-4 py-4 md:py-8 pb-12">

        {/* Header */}
        {state.step !== "success" && (
          <header className="flex items-center justify-between mb-6 pt-1">
            <div className="flex items-center gap-3">
              {/* Scissors icon */}
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-md shadow-accent/20">
                <Scissors className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-base font-extrabold tracking-tight text-primary">
                  {uz.app.title}
                </div>
                <div className="text-[11px] text-muted hidden sm:block">Premial sartaroshxona xizmatlari</div>
              </div>
            </div>
            {state.step !== "bookings" && (
              <button
                onClick={() => goToStep("bookings")}
                className="text-xs font-bold text-accent hover:text-accent-hover transition-colors px-3.5 py-2 rounded-xl bg-accent/8 border border-accent/20 hover:bg-accent/15"
              >
                {uz.nav.myBookings}
              </button>
            )}
          </header>
        )}

        {/* ── Desktop & Mobile Split View Container ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
          
          {/* ── Left Sidebar (Desktop Only Summary & Progress) ── */}
          {showProgress && (
            <aside className="md:col-span-4 hidden md:block space-y-5 sticky top-6">
              {/* Progress Card */}
              <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted uppercase tracking-widest">
                    {stepLabelFull}
                  </span>
                  <span className="text-xs font-extrabold text-accent tabular-nums">
                    {progressPercent}%
                  </span>
                </div>

                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full animate-progress transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Step Navigation Dots */}
                <div className="space-y-2 pt-2">
                  {["Xizmat tanlash", "Ustani tanlash", "Vaqtni tanlash", "Bronni tasdiqlash"].map((label, idx) => {
                    const isActive = currentStepIndex === idx;
                    const isPast = currentStepIndex > idx;
                    const mappedStep = stepOrder[idx] as "service" | "barber" | "time";
                    return (
                      <button
                        key={label}
                        onClick={() => isPast && goToStep(mappedStep)}
                        disabled={!isPast}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                          isActive
                            ? "bg-accent text-white shadow-md shadow-accent/20"
                            : isPast
                            ? "bg-accent/8 text-primary hover:bg-accent/15 cursor-pointer"
                            : "text-muted/50 cursor-not-allowed"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                          isActive ? "bg-white text-accent" : isPast ? "bg-accent text-white" : "bg-surface border border-border"
                        }`}>
                          {isPast ? "✓" : idx + 1}
                        </span>
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selection Summary Ticket */}
              {(state.selectedService || state.selectedBarber || state.selectedTime) && (
                <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-sm space-y-3">
                  <div className="text-[10px] font-bold text-accent uppercase tracking-widest">
                    Sizning tanlovlar
                  </div>
                  
                  {state.selectedService && (
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-border/40">
                      <span className="text-muted">Xizmat</span>
                      <span className="font-bold text-primary">{state.selectedService.name}</span>
                    </div>
                  )}

                  {state.selectedBarber && (
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-border/40">
                      <span className="text-muted">Usta</span>
                      <span className="font-bold text-primary">
                        {state.selectedBarber.id === "any" ? "Har qanday usta" : state.selectedBarber.full_name}
                      </span>
                    </div>
                  )}

                  {state.selectedDate && state.selectedTime && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted">Vaqt</span>
                      <span className="font-bold text-primary">{state.selectedDate} • {state.selectedTime}</span>
                    </div>
                  )}

                  {state.selectedService && (
                    <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                      <span className="text-xs font-semibold text-muted">Jami:</span>
                      <span className="text-base font-extrabold text-accent">
                        {state.selectedService.price.toLocaleString()} so'm
                      </span>
                    </div>
                  )}
                </div>
              )}
            </aside>
          )}

          {/* ── Mobile Progress Bar ── */}
          {showProgress && (
            <div className="md:hidden col-span-1 mb-4 sticky top-3 z-10 bg-bg/95 backdrop-blur-md pb-3 border-b border-border/50">
              <div className="flex items-center justify-between mb-2 px-0.5">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-widest">
                  {stepLabelFull}
                </span>
                <span className="text-[11px] font-bold text-accent tabular-nums">
                  {progressPercent}%
                </span>
              </div>

              <div className="h-1.5 bg-surface rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-accent rounded-full animate-progress transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between px-1">
                {["Xizmat", "Usta", "Vaqt", "Tasdiqlash"].map((label, idx) => {
                  const isActive = currentStepIndex === idx;
                  const isPast = currentStepIndex > idx;
                  const mappedStep = stepOrder[idx] as "service" | "barber" | "time";
                  return (
                    <div key={label} className="flex flex-col items-center gap-1 flex-1">
                      <button
                        onClick={() => isPast && goToStep(mappedStep)}
                        disabled={!isPast}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                          isActive
                            ? "bg-accent text-white shadow-sm shadow-accent/30 scale-110"
                            : isPast
                            ? "bg-accent/20 text-accent cursor-pointer hover:bg-accent/30"
                            : "bg-surface border border-border text-muted/50"
                        }`}
                      >
                        {isPast ? "✓" : idx + 1}
                      </button>
                      <span className={`text-[9px] uppercase tracking-wider font-semibold ${
                        isActive ? "text-accent" : isPast ? "text-primary" : "text-muted/40"
                      }`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Selection summary pills (mobile) */}
              {(state.selectedService || state.selectedBarber || state.selectedTime) && (
                <div className="flex flex-wrap gap-1.5 text-xs mt-3">
                  {state.selectedService && (
                    <button
                      onClick={() => goToStep("service")}
                      className="px-2.5 py-1.5 rounded-lg bg-accent/8 border border-accent/20 flex items-center gap-1.5 hover:bg-accent/15 transition-colors animate-scale-in"
                    >
                      <span className="font-semibold text-primary">{state.selectedService.name}</span>
                      <span className="text-accent font-bold">• {state.selectedService.price.toLocaleString()} so'm</span>
                    </button>
                  )}
                  {state.selectedBarber && (
                    <button
                      onClick={() => goToStep("barber")}
                      className="px-2.5 py-1.5 rounded-lg bg-surface border border-border/50 flex items-center gap-1.5 hover:border-accent/30 transition-colors animate-scale-in"
                    >
                      <span className="font-medium text-primary">
                        {state.selectedBarber.id === "any" ? "Har qanday usta" : state.selectedBarber.full_name}
                      </span>
                    </button>
                  )}
                  {state.selectedDate && state.selectedTime && (
                    <button
                      onClick={() => goToStep("time")}
                      className="px-2.5 py-1.5 rounded-lg bg-surface border border-border/50 flex items-center gap-1.5 hover:border-accent/30 transition-colors animate-scale-in"
                    >
                      <span className="font-medium text-primary">{state.selectedDate} • {state.selectedTime}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Main Content View (Right Column on Desktop, Full Width on Mobile) ── */}
          <main className={showProgress ? "col-span-1 md:col-span-8" : "col-span-1 md:col-span-12 max-w-2xl mx-auto w-full"}>
            <div key={state.step} className="animate-slide-in-right">
              {state.step === "service" && (
                <StepService onSelect={handleSelectService} />
              )}

              {state.step === "barber" && state.selectedService && (
                <StepBarber
                  service={state.selectedService}
                  onSelect={(barber) => {
                    setAssignedBarber(null);
                    selectBarber(barber);
                  }}
                  onBack={handleBack}
                />
              )}

              {state.step === "time" && state.selectedService && (
                <StepTime
                  service={state.selectedService}
                  barber={state.selectedBarber}
                  onSelect={(date, time) => selectTime(date, time)}
                  onBack={handleBack}
                />
              )}

              {state.step === "confirm" &&
                state.selectedService &&
                state.selectedDate &&
                state.selectedTime && (
                  <StepConfirm
                    service={state.selectedService}
                    barber={state.selectedBarber}
                    assignedBarber={assignedBarber}
                    date={state.selectedDate}
                    time={state.selectedTime}
                    onConfirm={(b) => {
                      setAssignedBarber(b);
                      confirmBooking(b);
                    }}
                    onBack={handleBack}
                  />
                )}

              {state.step === "success" &&
                state.selectedService &&
                assignedBarber && (
                  <StepSuccess
                    service={state.selectedService}
                    barber={assignedBarber}
                    date={state.selectedDate}
                    time={state.selectedTime}
                    onBookAnother={handleBookAnother}
                    onMyBookings={() => goToStep("bookings")}
                  />
                )}

              {state.step === "bookings" && (
                <MyBookings
                  onBack={handleBookAnother}
                  onBookAnother={handleBookAnother}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
