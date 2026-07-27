import React, { useState, useEffect, useCallback, useRef } from "react";
import { Outlet, NavLink, useNavigate, Navigate, useLocation } from "react-router-dom";
import { Calendar, Users, BarChart3, LogOut, Settings, Scissors, ChevronDown, X, Clock, Building, UserCog } from "lucide-react";
import { useBarberAuth } from "../../context/BarberAuthContext";
import { supabase } from "../../lib/supabase";

export const BarberLayout: React.FC = () => {
  const { user, barber, signOut, loading } = useBarberAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Pending counts states
  const [shopPendingCount, setShopPendingCount] = useState(0);
  const [personalPendingCount, setPersonalPendingCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  // Swipe & Slide Animation Tracking for iOS 26 Experience
  const prevPathRef = useRef(location.pathname);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | "none">("none");
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const fetchPendingCounts = useCallback(async () => {
    if (!barber) return;
    try {
      const { data: locationBarbers } = await supabase
        .from("barbers")
        .select("id")
        .eq("location_id", barber.location_id || "");

      const locBarberIds = locationBarbers?.map((b) => b.id) || [];
      if (locBarberIds.length === 0) {
        setShopPendingCount(0);
        setPersonalPendingCount(0);
        return;
      }

      const { data: pendingBookings, error: pendingErr } = await supabase
        .from("bookings")
        .select("id, barber_id")
        .eq("status", "pending")
        .in("barber_id", locBarberIds);

      if (pendingErr) throw pendingErr;

      const list = pendingBookings || [];
      setShopPendingCount(list.length);
      setPersonalPendingCount(list.filter((b) => b.barber_id === barber.id).length);
    } catch (err) {
      console.error("Error fetching pending counts:", err);
    }
  }, [barber]);

  useEffect(() => {
    if (!barber) return;
    fetchPendingCounts();

    const channel = supabase
      .channel("layout-bookings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          fetchPendingCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barber, fetchPendingCounts]);

  // Close "more" menu when navigating
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const isAdmin = barber?.role === "admin";

  const { primaryTabs, moreItems, swipeableTabs, allSidebarItems } = React.useMemo(() => {
    const primary = [
      { label: "Jadval", icon: Calendar, path: "/barber/timetable" },
      { label: "Mijozlar", icon: Users, path: "/barber/clients" },
      { label: "Statistika", icon: BarChart3, path: "/barber/stats" },
    ];
    const more = [
      { label: "Ish jadvali", icon: Clock, path: "/barber/schedule" },
      ...(isAdmin ? [{ label: "Xizmatlar", icon: Scissors, path: "/barber/services" }] : []),
      ...(isAdmin ? [{ label: "Salon", icon: Building, path: "/barber/shop" }] : []),
      ...(isAdmin ? [{ label: "Jamoa", icon: UserCog, path: "/barber/team" }] : []),
      { label: "Sozlamalar", icon: Settings, path: "/barber/settings" },
    ];
    return {
      primaryTabs: primary,
      moreItems: more,
      swipeableTabs: [...primary, ...more],
      allSidebarItems: [...primary, ...more],
    };
  }, [isAdmin]);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      const prevIndex = swipeableTabs.findIndex((t) => prevPathRef.current.startsWith(t.path));
      const newIndex = swipeableTabs.findIndex((t) => location.pathname.startsWith(t.path));
      if (prevIndex !== -1 && newIndex !== -1) {
        setSlideDirection(newIndex > prevIndex ? "left" : "right");
      } else {
        setSlideDirection("left");
      }
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname, swipeableTabs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!barber) {
    if (user) {
      return <Navigate to="/barber/onboarding" replace />;
    }
    return <Navigate to="/barber/register" replace />;
  }

  // Check if current path is in "more" items (to highlight the more button)
  const isMoreActive = moreItems.some((item) => location.pathname.startsWith(item.path));
  const currentTabIndex = swipeableTabs.findIndex((t) => location.pathname.startsWith(t.path));

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || !e.changedTouches[0]) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Check if horizontal swipe exceeds 50px threshold and is greater than vertical movement
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0 && currentTabIndex < swipeableTabs.length - 1 && currentTabIndex !== -1) {
        // Swipe left -> next tab
        const nextTab = swipeableTabs[currentTabIndex + 1];
        if (nextTab) navigate(nextTab.path);
      } else if (deltaX > 0 && currentTabIndex > 0) {
        // Swipe right -> prev tab
        const prevTab = swipeableTabs[currentTabIndex - 1];
        if (prevTab) navigate(prevTab.path);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/barber/login");
  };

  const getBadgeClass = (isActive: boolean, isPersonal: boolean) => {
    if (isActive) {
      return isPersonal 
        ? "bg-white text-accent border border-white/20"
        : "bg-white/30 text-white border border-white/10";
    } else {
      return isPersonal
        ? "bg-accent text-white border border-accent/20"
        : "bg-accent/10 text-accent border border-accent/10";
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row text-text">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border/50 p-6 justify-between shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-accent/20">
              <Scissors size={18} />
            </div>
            <div>
              <h1 className="font-extrabold text-base leading-tight">Barber Portal</h1>
              <p className="text-xs text-muted truncate max-w-[140px]">
                {barber.full_name} • {isAdmin ? "Admin" : "Usta"}
              </p>
            </div>
          </div>

          {/* Pending Notification Widget */}
          {(isAdmin ? shopPendingCount > 0 : personalPendingCount > 0) && (
            <div className="bg-accent/6 border border-accent/15 rounded-2xl p-3.5 space-y-1.5 text-[11px] font-medium text-muted">
              <div className="flex items-center gap-1.5 font-bold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft" />
                Kutilayotgan so'rovlar
              </div>
              {isAdmin ? (
                <div className="space-y-0.5">
                  <p>Salon: <strong className="text-primary">{shopPendingCount} ta</strong></p>
                  {personalPendingCount > 0 && (
                    <p>Sizga: <strong className="text-primary">{personalPendingCount} ta</strong></p>
                  )}
                </div>
              ) : (
                <p>Sizga: <strong className="text-primary">{personalPendingCount} ta</strong></p>
              )}
            </div>
          )}

          <nav className="space-y-1">
            {allSidebarItems.map((item) => {
              const Icon = item.icon;
              const isTimetable = item.label === "Jadval";
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-accent text-white shadow-md shadow-accent/20"
                        : "text-muted hover:bg-surface hover:text-primary"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </div>

                      {isTimetable && (
                        <div className="flex items-center gap-1">
                          {isAdmin ? (
                            <>
                              {shopPendingCount > 0 && (
                                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md ${getBadgeClass(isActive, false)}`}>
                                  {shopPendingCount}
                                </span>
                              )}
                              {personalPendingCount > 0 && (
                                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md ${getBadgeClass(isActive, true)}`}>
                                  {personalPendingCount}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              {personalPendingCount > 0 && (
                                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md ${getBadgeClass(isActive, true)}`}>
                                  {personalPendingCount}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-danger hover:bg-danger/8 transition-colors w-full"
        >
          <LogOut size={18} />
          <span>Chiqish</span>
        </button>
      </aside>

      {/* Mobile Top Header - iOS 26 Liquid Glass */}
      <header className="md:hidden liquid-glass-nav border-b border-white/40 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-sm shadow-accent/20">
            <Scissors size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm leading-none truncate">{barber.full_name}</h1>
            <span className="text-[9px] text-accent font-bold uppercase tracking-wider">
              {isAdmin ? "Admin" : "Usta"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Pending Indicator */}
          {(isAdmin ? shopPendingCount > 0 : personalPendingCount > 0) && (
            <div className="flex items-center gap-1 text-[9px] font-extrabold bg-accent text-white px-2.5 py-1 rounded-full shrink-0">
              <span className="w-1 h-1 rounded-full bg-white animate-pulse-soft shrink-0" />
              {isAdmin 
                ? `${shopPendingCount}` 
                : `${personalPendingCount}`
              }
            </div>
          )}

          <button
            onClick={handleLogout}
            className="p-2 text-muted hover:text-danger transition-colors"
            title="Chiqish"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content View with Swipe Gesture & iOS 26 Liquid Glass Slide */}
      <main 
        className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full pb-28 md:pb-8 overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          key={location.pathname} 
          className={
            slideDirection === "left" 
              ? "animate-slide-left" 
              : slideDirection === "right" 
              ? "animate-slide-right" 
              : "animate-fade-in"
          }
        >
          <Outlet />
        </div>
      </main>

      {/* ── Mobile Bottom Navigation: Floating iOS 26 Liquid Glass Capsule Bar ── */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-30 liquid-glass-nav rounded-[28px] py-1.5 px-2">
        <div className="flex items-center justify-around relative">
          {primaryTabs.map((item) => {
            const Icon = item.icon;
            const isTimetable = item.label === "Jadval";
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-1.5 px-3.5 rounded-2xl text-[10px] font-bold transition-all duration-300 ios-press relative z-10 ${
                    isActive ? "text-white liquid-glass-pill scale-105" : "text-muted hover:text-primary"
                  }`
                }
              >
                <div className="relative">
                  <Icon size={20} className="transition-transform duration-300" />
                  {isTimetable && (isAdmin ? shopPendingCount > 0 : personalPendingCount > 0) && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] bg-danger text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-md px-1 animate-urgency">
                      {isAdmin ? shopPendingCount : personalPendingCount}
                    </span>
                  )}
                </div>
                <span className="tracking-tight">{item.label}</span>
              </NavLink>
            );
          })}

          {/* "More" tab — opens iOS bottom sheet */}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-1 py-1.5 px-3.5 rounded-2xl text-[10px] font-bold transition-all duration-300 ios-press relative z-10 ${
              isMoreActive ? "text-white liquid-glass-pill scale-105" : "text-muted hover:text-primary"
            }`}
          >
            <div className="relative">
              <ChevronDown size={20} className={`transition-transform duration-300 ${moreOpen ? "rotate-180" : ""}`} />
            </div>
            <span className="tracking-tight">Ko'proq</span>
          </button>
        </div>
      </nav>

      {/* ── "More" bottom sheet (mobile) ── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-primary/40 backdrop-blur-sm z-30 animate-fade-in"
            onClick={() => setMoreOpen(false)}
          />

          {/* Sheet */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl border-t border-border/50 z-40 animate-slide-up shadow-xl">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            <div className="flex items-center justify-between px-5 py-2">
              <span className="text-xs font-bold text-muted uppercase tracking-widest">Boshqa sahifalar</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface text-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-4 pb-6 space-y-1">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-accent text-white shadow-md shadow-accent/20"
                        : "text-primary hover:bg-surface"
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
