import React, { useState, useEffect, useCallback, useRef } from "react";
import { Outlet, NavLink, useNavigate, Navigate, useLocation } from "react-router-dom";
import { Calendar, Users, BarChart3, LogOut, Settings, Scissors, ChevronDown, X, Clock, Building, UserCog } from "lucide-react";
import { useBarberAuth } from "../../context/BarberAuthContext";
import { supabase } from "../../lib/supabase";
import { uz } from "../../lib/uz";

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

  const activeTabIndex = React.useMemo(() => {
    if (location.pathname.startsWith("/barber/timetable")) return 0;
    if (location.pathname.startsWith("/barber/clients")) return 1;
    if (location.pathname.startsWith("/barber/stats")) return 2;
    return 3; // "Ko'proq" tab or secondary pages
  }, [location.pathname]);
  const currentTabIndex = swipeableTabs.findIndex((t) => location.pathname.startsWith(t.path));

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
              <h1 className="font-extrabold text-base leading-tight">{uz.barberPortal.title}</h1>
              <p className="text-xs text-muted truncate max-w-[140px]">
                {barber.full_name} • {isAdmin ? uz.barberPortal.adminRole : uz.barberPortal.barberRole}
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

      {/* ── Mobile Bottom Navigation: Floating iOS 26 Liquid Glass Capsule Bar with Sliding Pill ── */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-50 liquid-glass-nav rounded-[26px] p-1.5 shadow-2xl">
        <div className="relative w-full">
          {/* iOS 26 Native Sliding Liquid Glass Pill Indicator */}
          <div
            className="absolute top-0 bottom-0 w-1/4 p-0.5 pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] z-0"
            style={{
              transform: `translateX(${activeTabIndex * 100}%)`,
            }}
          >
            <div className="w-full h-full rounded-2xl liquid-glass-pill shadow-md" />
          </div>

          <div className="grid grid-cols-4 items-center justify-items-center gap-0 relative z-10 w-full pointer-events-auto">
            {primaryTabs.map((item, idx) => {
              const Icon = item.icon;
              const isTimetable = item.label === "Jadval";
              const isActive = activeTabIndex === idx;

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-2xl text-[11px] font-bold transition-colors duration-200 ios-press relative z-20 select-none cursor-pointer ${
                    isActive ? "text-white scale-[1.02]" : "text-muted hover:text-primary"
                  }`}
                >
                  <div className="relative pointer-events-none">
                    <Icon size={21} className="transition-transform duration-300" />
                    {isTimetable && (isAdmin ? shopPendingCount > 0 : personalPendingCount > 0) && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] bg-danger text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-md px-1 animate-urgency">
                        {isAdmin ? shopPendingCount : personalPendingCount}
                      </span>
                    )}
                  </div>
                  <span className="tracking-tight truncate max-w-full text-center leading-tight mt-0.5 pointer-events-none">
                    {item.label}
                  </span>
                </button>
              );
            })}

            {/* "More" tab — opens iOS bottom sheet */}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-2xl text-[11px] font-bold transition-colors duration-200 ios-press relative z-20 select-none cursor-pointer ${
                activeTabIndex === 3 ? "text-white scale-[1.02]" : "text-muted hover:text-primary"
              }`}
            >
              <div className="relative pointer-events-none">
                <ChevronDown size={21} className={`transition-transform duration-300 ${moreOpen ? "rotate-180" : ""}`} />
              </div>
              <span className="tracking-tight truncate max-w-full text-center leading-tight mt-0.5 pointer-events-none">
                Ko'proq
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── "More" bottom sheet (mobile) ── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-primary/40 backdrop-blur-md z-50 animate-fade-in"
            onClick={() => setMoreOpen(false)}
          />

          {/* Sheet */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card rounded-t-[32px] border-t border-border/60 z-50 animate-slide-up shadow-2xl pb-[calc(env(safe-area-inset-bottom,20px)+70px)]">
            {/* Grab Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 rounded-full bg-muted/30" />
            </div>

            <div className="flex items-center justify-between px-6 py-3 border-b border-border/40">
              <div>
                <h3 className="text-sm font-extrabold text-primary tracking-tight">Boshqa bo'limlar</h3>
                <p className="text-[11px] text-muted font-medium">Barcha sozlamalar va sahifalar</p>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-muted hover:text-primary transition-all active:scale-90"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 gap-2.5 max-h-[55vh] overflow-y-auto">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 p-3 rounded-2xl text-xs font-bold transition-all ios-press border ${
                      isActive
                        ? "bg-accent text-white border-accent shadow-md shadow-accent/20"
                        : "bg-surface/60 text-primary border-border/50 hover:bg-surface"
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${isActive ? "bg-white/20" : "bg-card text-accent shadow-xs"}`}>
                      <Icon size={18} />
                    </div>
                    <span className="truncate">{item.label}</span>
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
