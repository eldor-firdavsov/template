import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import type { Client } from "../../lib/types";
import { Search, ShieldAlert, CheckCircle2, Phone, Calendar, Users } from "lucide-react";
import { Skeleton } from "../../components/ui/Skeleton";

export const BarberClients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("first_seen_at", { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error("Error loading clients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleToggleBlock = async (client: Client) => {
    setTogglingId(client.id);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ is_blocked: !client.is_blocked })
        .eq("id", client.id);

      if (error) throw error;
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, is_blocked: !c.is_blocked } : c))
      );
    } catch (err) {
      console.error("Failed to toggle block state:", err);
    } finally {
      setTogglingId(null);
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-white/10 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-text">Client Directory</h2>
          <p className="text-xs text-text-secondary">View client history and manage access</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-3 text-text-secondary" />
          <input
            type="text"
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-bg rounded-xl text-xs border border-white/10 text-text outline-none focus:border-accent font-semibold transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="w-full h-28 rounded-2xl bg-card border border-white/10" />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-card p-12 rounded-3xl border border-dashed border-white/20 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-bg border border-white/5 flex items-center justify-center mx-auto mb-2 text-text-secondary">
            <Users size={28} />
          </div>
          <div>
            <h3 className="font-bold text-text text-lg">No clients found</h3>
            <p className="text-sm text-text-secondary mt-1 max-w-xs mx-auto">
              {search ? "No clients match your search criteria." : "You haven't had any clients book with you yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className={`bg-card rounded-2xl border p-5 space-y-3 transition-colors shadow-sm ${
                client.is_blocked ? "border-red-500/30 bg-red-500/5" : "border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-text flex items-center gap-2">
                    {client.full_name}
                    {client.is_blocked && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        Blocked
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1">
                    <Phone size={12} />
                    <a href={`tel:${client.phone}`} className="hover:text-accent transition-colors">
                      {client.phone}
                    </a>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleBlock(client)}
                  disabled={togglingId === client.id}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 ${
                    client.is_blocked
                      ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                  }`}
                >
                  {togglingId === client.id ? (
                    "..."
                  ) : client.is_blocked ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={12} /> Unblock
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <ShieldAlert size={12} /> Block
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-text-secondary pt-2 border-t border-white/5 font-medium">
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> First seen: {new Date(client.first_seen_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
