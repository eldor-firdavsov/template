import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ProfileSettings() {
  const navigate = useNavigate();
  const [barber, setBarber] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    full_name: "",
    bio: "",
    photo_url: "",
    phone: "",
  });

  const [workingHours, setWorkingHours] = useState<
    Record<number, { enabled: boolean; start: string; end: string }>
  >({});

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  useEffect(() => {
    const barberData = JSON.parse(localStorage.getItem("barber") || "{}");
    setBarber(barberData);
    setFormData({
      full_name: barberData.full_name || "",
      bio: barberData.bio || "",
      photo_url: barberData.photo_url || "",
      phone: barberData.phone || "",
    });

    // Fetch working hours
    fetchWorkingHours(barberData.id);
  }, []);

  const fetchWorkingHours = async (barberId: string) => {
    try {
      const response = await fetch(`/api/working-hours?barber_id=${barberId}`);
      const data = await response.json();

      const hoursMap: Record<number, { enabled: boolean; start: string; end: string }> = {
        0: { enabled: false, start: "09:00", end: "17:00" },
        1: { enabled: false, start: "09:00", end: "17:00" },
        2: { enabled: false, start: "09:00", end: "17:00" },
        3: { enabled: false, start: "09:00", end: "17:00" },
        4: { enabled: false, start: "09:00", end: "17:00" },
        5: { enabled: false, start: "09:00", end: "17:00" },
        6: { enabled: false, start: "09:00", end: "17:00" },
      };

      data.forEach((hour: any) => {
        hoursMap[hour.weekday] = {
          enabled: true,
          start: hour.start_time,
          end: hour.end_time,
        };
      });

      setWorkingHours(hoursMap);
    } catch (err) {
      console.error("Failed to fetch working hours:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/barbers/${barber.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const updatedBarber = await response.json();
      localStorage.setItem("barber", JSON.stringify(updatedBarber));
      setBarber(updatedBarber);
      setSuccess("Profile updated successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleHoursUpdate = async () => {
    setLoading(true);
    setError("");

    try {
      // Delete existing hours
      await fetch(`/api/working-hours?barber_id=${barber.id}`, {
        method: "DELETE",
      });

      // Create new hours
      for (const [day, hours] of Object.entries(workingHours)) {
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

      setSuccess("Working hours updated successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update working hours");
    } finally {
      setLoading(false);
    }
  };

  if (!barber) {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-slate-600 hover:text-slate-900 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-xl font-semibold text-slate-900">My Profile</h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
            {success}
          </div>
        )}

        {/* Profile Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Profile Information</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Bio</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Tell clients about yourself..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Photo URL</label>
              <input
                type="url"
                value={formData.photo_url}
                onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled
              />
              <p className="text-xs text-slate-500 mt-1">Contact support to change your phone number</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>

        {/* Working Hours */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Working Hours</h2>
          <div className="space-y-3 mb-4">
            {days.map((day, index) => (
              <div key={day} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={workingHours[index]?.enabled || false}
                  onChange={(e) =>
                    setWorkingHours({
                      ...workingHours,
                      [index]: { ...workingHours[index], enabled: e.target.checked },
                    })
                  }
                  className="w-5 h-5 rounded"
                />
                <span className="w-24 font-medium">{day}</span>
                {workingHours[index]?.enabled && (
                  <>
                    <input
                      type="time"
                      value={workingHours[index]?.start || "09:00"}
                      onChange={(e) =>
                        setWorkingHours({
                          ...workingHours,
                          [index]: { ...workingHours[index], start: e.target.value },
                        })
                      }
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <span>to</span>
                    <input
                      type="time"
                      value={workingHours[index]?.end || "17:00"}
                      onChange={(e) =>
                        setWorkingHours({
                          ...workingHours,
                          [index]: { ...workingHours[index], end: e.target.value },
                        })
                      }
                      className="px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={handleHoursUpdate}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : "Save Working Hours"}
          </button>
        </div>
      </main>
    </div>
  );
}
