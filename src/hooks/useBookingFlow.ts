import { useState, useCallback } from "react";
import type { Barber, Service, Step } from "../lib/types";

export interface BookingFlowState {
  step: Step;
  selectedService: Service | null;
  selectedBarber: Barber | null;
  selectedDate: string;
  selectedTime: string;
  assignedBarber: Barber | null;
}

const initialState: BookingFlowState = {
  step: "service",
  selectedService: null,
  selectedBarber: null,
  selectedDate: "",
  selectedTime: "",
  assignedBarber: null,
};

export function useBookingFlow() {
  const [state, setState] = useState<BookingFlowState>(initialState);

  const selectService = useCallback((service: Service) => {
    setState((prev) => ({
      ...prev,
      step: "barber",
      selectedService: service,
      selectedBarber: null,
    }));
  }, []);

  const selectBarber = useCallback((barber: Barber | null) => {
    setState((prev) => ({
      ...prev,
      step: "time",
      selectedBarber: barber,
    }));
  }, []);

  const selectTime = useCallback((date: string, time: string) => {
    setState((prev) => ({
      ...prev,
      step: "confirm",
      selectedDate: date,
      selectedTime: time,
    }));
  }, []);

  const confirmBooking = useCallback((assignedBarber: Barber) => {
    setState((prev) => ({
      ...prev,
      step: "success",
      assignedBarber: assignedBarber,
    }));
  }, []);

  const goToStep = useCallback((step: Step) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    state,
    selectService,
    selectBarber,
    selectTime,
    confirmBooking,
    goToStep,
    reset,
  };
}
