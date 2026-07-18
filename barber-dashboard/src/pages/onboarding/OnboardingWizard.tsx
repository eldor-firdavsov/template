import { useState } from "react";
import { useNavigate } from "react-router-dom";

type OnboardingStep = "profile" | "location" | "hours" | "services" | "complete";

interface OnboardingData {
  fullName: string;
  bio: string;
  photoUrl: string;
  locationName: string;
  locationAddress: string;
  locationPhone: string;
  locationPhotoUrl: string;
  workingHours: Record<number, { enabled: boolean; start: string; end: string }>;
  services: Array<{ name: string; category: string; duration: number; price: number }>;
}

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<OnboardingStep>("profile");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState<OnboardingData>({
    fullName: "",
    bio: "",
    photoUrl: "",
    locationName: "",
    locationAddress: "",
    locationPhone: "",
    locationPhotoUrl: "",
    workingHours: {
      0: { enabled: false, start: "09:00", end: "17:00" }, // Sunday
      1: { enabled: true, start: "09:00", end: "17:00" },  // Monday
      2: { enabled: true, start: "09:00", end: "17:00" },  // Tuesday
      3: { enabled: true, start: "09:00", end: "17:00" },  // Wednesday
      4: { enabled: true, start: "09:00", end: "17:00" },  // Thursday
      5: { enabled: true, start: "09:00", end: "17:00" },  // Friday
      6: { enabled: false, start: "09:00", end: "17:00" }, // Saturday
    },
    services: [],
  });

  const [newService, setNewService] = useState({
    name: "",
    category: "",
    duration: 30,
    price: 25,
  });

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const handleNext = async () => {
    if (step === "profile") {
      setStep("location");
    } else if (step === "location") {
      setStep("hours");
    } else if (step === "hours") {
      setStep("services");
    } else if (step === "services") {
      await handleSubmit();
    }
  };

  const handleBack = () => {
    const stepOrder: OnboardingStep[] = ["profile", "location", "hours", "services", "complete"];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1]);
    }
  };

  const addService = () => {
    if (newService.name && newService.category) {
      setData({
        ...data,
        services: [...data.services, { ...newService }],
      });
      setNewService({ name: "", category: "", duration: 30, price: 25 });
    }
  };

  const removeService = (index: number) => {
    setData({
      ...data,
      services: data.services.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const barber = JSON.parse(localStorage.getItem("barber") || "{}");

      // Create location
      const locationResponse = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.locationName,
          address: data.locationAddress,
          phone: data.locationPhone,
          photo_url: data.locationPhotoUrl,
        }),
      });

      if (!locationResponse.ok) {
        throw new Error("Failed to create location");
      }

      const location = await locationResponse.json();

      // Update barber with profile and location
      const barberResponse = await fetch(`/api/barbers/${barber.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: data.fullName,
          bio: data.bio,
          photo_url: data.photoUrl,
          location_id: location.id,
          onboarding_completed: true,
        }),
      });

      if (!barberResponse.ok) {
        throw new Error("Failed to update profile");
      }

      // Create working hours
      for (const [day, hours] of Object.entries(data.workingHours)) {
        if (hours.enabled) {
          await fetch("/api/working-hours", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              barber_id: barber.id,
              weekday: parseInt(day),
              start_time: hours.start,
              end_time: hours.end,
            }),
          });
        }
      }

      // Create services
      for (const service of data.services) {
        const serviceResponse = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: service.name,
            category: service.category,
            duration_minutes: service.duration,
            price: service.price,
          }),
        });

        if (!serviceResponse.ok) continue;

        const createdService = await serviceResponse.json();

        // Link service to barber
        await fetch("/api/barber-services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barber_id: barber.id,
            service_id: createdService.id,
          }),
        });
      }

      // Update barber in localStorage
      const updatedBarber = await barberResponse.json();
      localStorage.setItem("barber", JSON.stringify(updatedBarber));

      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case "profile":
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Your Profile</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={data.fullName}
                onChange={(e) => setData({ ...data, fullName: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Bio
              </label>
              <textarea
                value={data.bio}
                onChange={(e) => setData({ ...data, bio: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Tell clients about yourself..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Photo URL
              </label>
              <input
                type="url"
                value={data.photoUrl}
                onChange={(e) => setData({ ...data, photoUrl: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="https://..."
              />
            </div>
          </div>
        );

      case "location":
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Your Shop/Location</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Shop/Location Name *
              </label>
              <input
                type="text"
                value={data.locationName}
                onChange={(e) => setData({ ...data, locationName: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Address *
              </label>
              <input
                type="text"
                value={data.locationAddress}
                onChange={(e) => setData({ ...data, locationAddress: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Shop Phone
              </label>
              <input
                type="tel"
                value={data.locationPhone}
                onChange={(e) => setData({ ...data, locationPhone: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Photo URL
              </label>
              <input
                type="url"
                value={data.locationPhotoUrl}
                onChange={(e) => setData({ ...data, locationPhotoUrl: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="https://..."
              />
            </div>
          </div>
        );

      case "hours":
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Working Hours</h2>
            <p className="text-slate-600 text-sm">
              Set your availability for each day of the week
            </p>
            {days.map((day, index) => (
              <div key={day} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={data.workingHours[index].enabled}
                  onChange={(e) =>
                    setData({
                      ...data,
                      workingHours: {
                        ...data.workingHours,
                        [index]: { ...data.workingHours[index], enabled: e.target.checked },
                      },
                    })
                  }
                  className="w-5 h-5 rounded"
                />
                <span className="w-24 font-medium">{day}</span>
                {data.workingHours[index].enabled && (
                  <>
                    <input
                      type="time"
                      value={data.workingHours[index].start}
                      onChange={(e) =>
                        setData({
                          ...data,
                          workingHours: {
                            ...data.workingHours,
                            [index]: { ...data.workingHours[index], start: e.target.value },
                          },
                        })
                      }
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <span>to</span>
                    <input
                      type="time"
                      value={data.workingHours[index].end}
                      onChange={(e) =>
                        setData({
                          ...data,
                          workingHours: {
                            ...data.workingHours,
                            [index]: { ...data.workingHours[index], end: e.target.value },
                          },
                        })
                      }
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        );

      case "services":
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Services You Offer</h2>
            <p className="text-slate-600 text-sm">
              Add the services you provide (you can add more later)
            </p>

            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                value={newService.name}
                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                placeholder="Service name (e.g., Haircut)"
                className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <input
                type="text"
                value={newService.category}
                onChange={(e) => setNewService({ ...newService, category: e.target.value })}
                placeholder="Category (e.g., Hair)"
                className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <input
                type="number"
                value={newService.duration}
                onChange={(e) => setNewService({ ...newService, duration: parseInt(e.target.value) })}
                placeholder="Duration (min)"
                className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <input
                type="number"
                value={newService.price}
                onChange={(e) => setNewService({ ...newService, price: parseFloat(e.target.value) })}
                placeholder="Price ($)"
                className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <button
              type="button"
              onClick={addService}
              className="w-full bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Add Service
            </button>

            {data.services.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-slate-900">Added Services:</h3>
                {data.services.map((service, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <span className="font-medium">{service.name}</span>
                      <span className="text-slate-600 text-sm ml-2">
                        ({service.category}) • {service.duration}min • ${service.price}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeService(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "complete":
        return (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">You're All Set!</h2>
            <p className="text-slate-600">
              Your shop has been configured and you're ready to start accepting bookings.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                Step {["profile", "location", "hours", "services", "complete"].indexOf(step) + 1} of 5
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{
                  width: `${((["profile", "location", "hours", "services", "complete"].indexOf(step) + 1) / 5) * 100}%`,
                }}
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {renderStep()}

          {step !== "complete" && (
            <div className="flex gap-4 mt-6">
              {step !== "profile" && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-300 transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {loading ? "Saving..." : step === "services" ? "Complete Setup" : "Next"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
