import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useBarberAuth } from "../../context/BarberAuthContext";
import type { Booking } from "../../lib/types";
import { DollarSign, Calendar, AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";

export const BarberStats: React.FC = () => {
  const { barber } = useBarberAuth();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("30d");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!barber) return;
    setLoading(true);

    try {
      let query = supabase.from("bookings").select("*");

      if (barber.role !== "admin") {
        query = query.eq("barber_id", barber.id);
      }

      if (timeRange !== "all") {
        const days = timeRange === "7d" ? 7 : 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("created_at", since);
      }

      const { data, error } = await query;
      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      console.error("Error loading stats:", err);
    } finally {
      setLoading(false);
    }
  }, [barber, timeRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Compute metric totals
  const totalBookings = bookings.length;
  const completedBookings = bookings.filter((b) => b.status === "completed");
  const confirmedBookings = bookings.filter((b) => b.status === "confirmed");
  const noShowBookings = bookings.filter((b) => b.status === "no_show");
  const cancelledBookings = bookings.filter((b) => b.status === "cancelled");

  const totalRevenue = completedBookings.reduce((sum, b) => sum + Number(b.price_at_booking || 0), 0);
  const potentialRevenue = [...completedBookings, ...confirmedBookings].reduce(
    (sum, b) => sum + Number(b.price_at_booking || 0),
    0
  );

  const noShowRate = totalBookings > 0 ? ((noShowBookings.length / totalBookings) * 100).toFixed(1) : "0.0";
  const completionRate = totalBookings > 0 ? ((completedBookings.length / totalBookings) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-xl font-extrabold text-text">Performance Analytics</h2>
          <p className="text-xs text-text-secondary">
            {barber?.role === "admin" ? "Shop-wide revenue & booking stats" : "Your personal performance metrics"}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-bg p-1 rounded-xl border border-white/10 text-xs font-bold">
          <button
            onClick={() => setTimeRange("7d")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              timeRange === "7d" ? "bg-accent text-white" : "text-text-secondary hover:text-text"
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setTimeRange("30d")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              timeRange === "30d" ? "bg-accent text-white" : "text-text-secondary hover:text-text"
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setTimeRange("all")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              timeRange === "all" ? "bg-accent text-white" : "text-text-secondary hover:text-text"
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card p-5 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-xs font-bold uppercase tracking-wider">Completed Revenue</span>
                <DollarSign size={18} className="text-emerald-400" />
              </div>
              <p className="text-3xl font-extrabold text-emerald-400">${totalRevenue.toFixed(2)}</p>
              <p className="text-[11px] text-text-secondary">
                Est. Total: ${potentialRevenue.toFixed(2)}
              </p>
            </div>

            <div className="bg-card p-5 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-xs font-bold uppercase tracking-wider">Total Bookings</span>
                <Calendar size={18} className="text-blue-400" />
              </div>
              <p className="text-3xl font-extrabold text-text">{totalBookings}</p>
              <p className="text-[11px] text-text-secondary">
                {completedBookings.length} completed ({completionRate}%)
              </p>
            </div>

            <div className="bg-card p-5 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-xs font-bold uppercase tracking-wider">No-Show Rate</span>
                <AlertCircle size={18} className="text-amber-400" />
              </div>
              <p className="text-3xl font-extrabold text-amber-400">{noShowRate}%</p>
              <p className="text-[11px] text-text-secondary">
                {noShowBookings.length} total no-shows
              </p>
            </div>

            <div className="bg-card p-5 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-text-secondary">
                <span className="text-xs font-bold uppercase tracking-wider">Cancellations</span>
                <TrendingUp size={18} className="text-red-400" />
              </div>
              <p className="text-3xl font-extrabold text-red-400">{cancelledBookings.length}</p>
              <p className="text-[11px] text-text-secondary">Cancelled appointments</p>
            </div>
          </div>

          {/* Breakdown Chart Overview */}
          <div className="bg-card rounded-2xl border border-white/10 p-6 space-y-4">
            <h3 className="font-extrabold text-base text-text">Booking Status Breakdown</h3>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={14} /> Completed ({completedBookings.length})
                  </span>
                  <span>{completionRate}%</span>
                </div>
                <div className="w-full h-2.5 bg-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-blue-400 flex items-center gap-1">
                    <Calendar size={14} /> Confirmed/Upcoming ({confirmedBookings.length})
                  </span>
                  <span>
                    {totalBookings > 0
                      ? ((confirmedBookings.length / totalBookings) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </span>
                </div>
                <div className="w-full h-2.5 bg-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        totalBookings > 0 ? (confirmedBookings.length / totalBookings) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertCircle size={14} /> No-Show ({noShowBookings.length})
                  </span>
                  <span>{noShowRate}%</span>
                </div>
                <div className="w-full h-2.5 bg-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${noShowRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
