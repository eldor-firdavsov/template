import { useState } from "react";
import { useBookingFlow } from "./hooks/useBookingFlow";
import { StepService } from "./components/StepService";
import { StepBarber } from "./components/StepBarber";
import { StepTime } from "./components/StepTime";
import { StepConfirm } from "./components/StepConfirm";
import { StepSuccess } from "./components/StepSuccess";
import { MyBookings } from "./components/MyBookings";
import type { Barber } from "./lib/types";

export default function App() {
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

  const handleBack = () => {
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

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-md mx-auto px-4 py-4 pb-10">
        {/* Top nav: show "My Bookings" on most steps */}
        {state.step !== "success" && state.step !== "bookings" && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => goToStep("bookings")}
              className="text-sm text-accent px-3 py-1 rounded-lg hover:bg-accent/10 transition-colors"
            >
              My Bookings
            </button>
          </div>
        )}

        {state.step === "service" && (
          <StepService onSelect={selectService} />
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
    </div>
  );
}
