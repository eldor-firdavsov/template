import { useState, useRef, useEffect } from "react";
import { useBookingFlow } from "../hooks/useBookingFlow";
import { StepLocation } from "./StepLocation";
import { StepService } from "./StepService";
import { StepBarber } from "./StepBarber";
import { StepTime } from "./StepTime";
import { StepConfirm } from "./StepConfirm";
import { StepSuccess } from "./StepSuccess";
import { MyBookings } from "./MyBookings";
import type { Barber, Service, Location } from "../lib/types";
import { uz } from "../lib/uz";
import { supabase } from "../lib/supabase";

import { Scissors, Check } from "lucide-react";

export function ClientBookingApp({ initialStep }: { initialStep?: "bookings" }) {
  const {
    state,
    selectLocation,
    selectService,
    selectBarber,
    selectTime,
    confirmBooking,
    goToStep,
    reset,
  } = useBookingFlow();
  const [assignedBarber, setAssignedBarber] = useState<Barber | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);

  // iOS 26 Slide Direction & Swipe Tracking
  const prevStepRef = useRef(state.step);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | "none">("none");
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchIgnoreSwipe = useRef(false);

  const stepOrderMap: Record<string, number> = {
    location: 0,
    service: 1,
    barber: 2,
    time: 3,
    confirm: 4,
    success: 5,
    bookings: 6,
  };

  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase
        .from("locations")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      const locs = (data || []) as Location[];
      setLocations(locs);

      if (locs.length > 1 && !state.selectedLocation && state.step !== "bookings" && state.step !== "success") {
        goToStep("location");
      } else if (locs.length === 1 && !state.selectedLocation) {
        selectLocation(locs[0]!);
      }
    }
    fetchLocations();
  }, []);

  useEffect(() => {
    if (prevStepRef.current !== state.step) {
      const oldIdx = stepOrderMap[prevStepRef.current] ?? 0;
      const newIdx = stepOrderMap[state.step] ?? 0;
      setSlideDirection(newIdx > oldIdx ? "left" : "right");
      prevStepRef.current = state.step;
    }
  }, [state.step]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    const target = e.target as HTMLElement | null;
    // Date strip / other horizontal scrollers must not trigger step swipe-back
    touchIgnoreSwipe.current = Boolean(
      target?.closest?.("[data-no-swipe], [data-horizontal-scroll]"),
    );
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || !e.changedTouches[0]) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const ignore = touchIgnoreSwipe.current;

    touchStartX.current = null;
    touchStartY.current = null;
    touchIgnoreSwipe.current = false;

    if (ignore) return;

    // Horizontal swipe: require clear intent so date/time taps aren't aborted
    if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
      if (deltaX > 0) {
        // Swipe right -> Go back to previous step
        if (state.step === "service" && locations.length > 1) goToStep("location");
        else if (state.step === "barber") goToStep("service");
        else if (state.step === "time") goToStep("barber");
        else if (state.step === "confirm") goToStep("time");
        else if (state.step === "bookings") goToStep("service");
      } else if (deltaX < 0) {
        // Swipe left -> Go forward if already selected
        if (state.step === "location" && state.selectedLocation) goToStep("service");
        else if (state.step === "service" && state.selectedService) goToStep("barber");
        else if (state.step === "barber" && state.selectedBarber) goToStep("time");
        else if (state.step === "time" && state.selectedDate && state.selectedTime) goToStep("confirm");
      }
    }
  };

  // Set initial step only once on mount to prevent infinite render loop
  const hasSetInitialStep = useRef(false);
  useEffect(() => {
    if (!hasSetInitialStep.current && initialStep === "bookings") {
      hasSetInitialStep.current = true;
      goToStep("bookings");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectService = async (service: Service) => {
    const { data: mappings } = await supabase
      .from("barber_services")
      .select("barber_id")
      .eq("service_id", service.id);

    if (mappings && mappings.length > 0) {
      const barberIds = mappings.map((m) => m.barber_id);

      const buildQuery = (withLocation: boolean) => {
        let q = supabase
          .from("barbers")
          .select("*")
          .in("id", barberIds)
          .eq("is_active", true);
        if (withLocation && state.selectedLocation) {
          q = q.eq("location_id", state.selectedLocation.id);
        }
        return q;
      };

      let { data: barbers } = await buildQuery(true);

      // Fall back without location filter if location-filtered result is empty
      if ((!barbers || barbers.length === 0) && state.selectedLocation) {
        const fallback = await buildQuery(false);
        barbers = fallback.data;
      }

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

        const buildQuery = (withLocation: boolean) => {
          let q = supabase
            .from("barbers")
            .select("id")
            .in("id", barberIds)
            .eq("is_active", true);
          if (withLocation && state.selectedLocation) {
            q = q.eq("location_id", state.selectedLocation.id);
          }
          return q;
        };

        let { data: barbers } = await buildQuery(true);

        if ((!barbers || barbers.length === 0) && state.selectedLocation) {
          const fallback = await buildQuery(false);
          barbers = fallback.data;
        }

        if (barbers && barbers.length === 1) {
          goToStep("service");
          return;
        }
      }
    }

    if (state.step === "service" && locations.length > 1) {
      goToStep("location");
      return;
    }

    const backMap: Record<string, string> = {
      location: "location",
      service: "location",
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

        {/* Header - iOS 26 Liquid Glass */}
        {state.step !== "success" && (
          <header className="flex items-center justify-between mb-6 pt-1 liquid-glass-nav rounded-2xl p-4 shadow-sm border border-white/60">
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
              {/* Progress Card - iOS 26 Liquid Glass */}
              <div className="liquid-glass-card rounded-2xl p-5 shadow-md space-y-4">
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
                          {isPast ? <Check size={10} className="stroke-[3]" /> : idx + 1}
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

          {/* ── Mobile Progress Bar (iOS 26 Liquid Glass) ── */}
          {showProgress && (
            <div className="md:hidden col-span-1 mb-5 sticky top-3 z-10 liquid-glass-nav rounded-[24px] p-3.5 shadow-md border border-white/80">
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
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                          isActive
                            ? "liquid-glass-pill text-white shadow-sm scale-110"
                            : isPast
                            ? "bg-accent/20 text-accent cursor-pointer hover:bg-accent/30"
                            : "bg-surface border border-border text-muted/50"
                        }`}
                      >
                        {isPast ? <Check size={10} className="stroke-[3]" /> : idx + 1}
                      </button>
                      <span className={`text-[9px] uppercase tracking-wider font-semibold ${
                        isActive ? "text-accent font-bold" : isPast ? "text-primary" : "text-muted/40"
                      }`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Selection summary pills (mobile) */}
              {(state.selectedService || state.selectedBarber || state.selectedTime) && (
                <div className="flex flex-wrap gap-1.5 text-xs mt-3 pt-2 border-t border-border/40">
                  {state.selectedService && (
                    <button
                      onClick={() => goToStep("service")}
                      className="px-2.5 py-1.5 rounded-xl bg-accent/10 border border-accent/25 flex items-center gap-1.5 hover:bg-accent/15 transition-all animate-scale-in shadow-sm"
                    >
                      <span className="font-semibold text-primary">{state.selectedService.name}</span>
                      <span className="text-accent font-bold">• {state.selectedService.price.toLocaleString()} so'm</span>
                    </button>
                  )}
                  {state.selectedBarber && (
                    <button
                      onClick={() => goToStep("barber")}
                      className="px-2.5 py-1.5 rounded-xl bg-white/70 border border-border/80 flex items-center gap-1.5 hover:border-accent/40 transition-all animate-scale-in shadow-sm"
                    >
                      <span className="font-medium text-primary">
                        {state.selectedBarber.id === "any" ? "Har qanday usta" : state.selectedBarber.full_name}
                      </span>
                    </button>
                  )}
                  {state.selectedDate && state.selectedTime && (
                    <button
                      onClick={() => goToStep("time")}
                      className="px-2.5 py-1.5 rounded-xl bg-white/70 border border-border/80 flex items-center gap-1.5 hover:border-accent/40 transition-all animate-scale-in shadow-sm"
                    >
                      <span className="font-medium text-primary">{state.selectedDate} • {state.selectedTime}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Main Content View with iOS 26 Slide & Touch Swipe ── */}
          <main 
            className={showProgress ? "col-span-1 md:col-span-8 overflow-x-hidden" : "col-span-1 md:col-span-12 max-w-2xl mx-auto w-full overflow-x-hidden"}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div 
              key={state.step} 
              className={
                slideDirection === "left" 
                  ? "animate-slide-left" 
                  : slideDirection === "right" 
                  ? "animate-slide-right" 
                  : "animate-fade-in"
              }
            >
              {state.step === "location" && (
                <StepLocation onSelect={selectLocation} />
              )}

              {state.step === "service" && (
                <StepService
                  selectedLocation={state.selectedLocation}
                  locationsCount={locations.length}
                  onChangeLocation={() => goToStep("location")}
                  onSelect={handleSelectService}
                />
              )}

              {state.step === "barber" && state.selectedService && (
                <StepBarber
                  service={state.selectedService}
                  selectedLocation={state.selectedLocation}
                  onSelect={(barber) => {
                    setAssignedBarber(null);
                    selectBarber(barber);
                    goToStep("time");
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
