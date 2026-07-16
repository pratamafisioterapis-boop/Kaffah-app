
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, Calendar, Users, Settings, LogOut, Activity, Briefcase, 
  User, Clock, Menu, ChevronRight, Bell, Search, LayoutDashboard,
  FileText, Package, ClipboardList, Database, DollarSign, ChevronDown,
  MessageSquare, Plus, Boxes, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';

// Icon Mapping
const iconMap = {
  Home: LayoutDashboard,
  Calendar,
  Users,
  Settings,
  BriefcaseMedical: Briefcase,
  User,
  Activity,
  FileText,
  Package,
  ClipboardList,
  Database,
  DollarSign,
  MessageSquare,
  Boxes,
  Wallet
};

// Safe date formatter to prevent runtime crashes
const safeFormatDate = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID');
};

const safeFormatTime = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const DashboardLayout = ({ children, navItems = [], role, userName }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

useEffect(() => {
  const interval = setInterval(() => {
    setCurrentTime(new Date());
  }, 1000);

  return () => clearInterval(interval);
}, []);
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, userDetails } = useAuth();
  const [clinicInfo, setClinicInfo] = useState(null);

  useEffect(() => {
    const fetchClinicInfo = async () => {
      if (!userDetails?.clinic_id) return;
      const { data } = await supabase.from('clinics').select('name, logo_url').eq('id', userDetails.clinic_id).single();
      if (data) setClinicInfo(data);
    };
    fetchClinicInfo();
  }, [userDetails]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [openNotif, setOpenNotif] = useState(false);
const isPWA =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;
  useEffect(() => {
    const channel = supabase
      .channel('audit_logs_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_logs'
        },
        async (payload) => {
          const newData = payload.new;
          // Guard against null payload
          if (!newData) return;

          let fullName = 'System';
          
          // Only fetch user if user_id exists
          if (newData.user_id) {
            const { data: user } = await supabase
              .from('users')
              .select('full_name')
              .eq('id', newData.user_id)
              .maybeSingle();
              
            if (user) fullName = user.full_name;
          }

          let patientName = '-';
          const patientId = newData.changes?.patient_id;

          if (patientId) {
            const { data: patient } = await supabase
              .from('patients')
              .select('full_name')
              .eq('id', patientId)
              .maybeSingle();

            if (patient) patientName = patient.full_name;
          }

          const enriched = {
            ...newData,
            users: { full_name: fullName },
            patient_name: patientName
          };

          setNotifications((prev) => [enriched, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          users:user_id (
            id,
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        const patientIds = data
          .map(item => item.changes?.patient_id)
          .filter(Boolean);

        let patientsMap = {};

        if (patientIds.length > 0) {
          const { data: patients } = await supabase
            .from('patients')
            .select('id, full_name')
            .in('id', patientIds);

          patientsMap = Object.fromEntries(
            (patients || []).map(p => [p.id, p.full_name])
          );
        }

        const enriched = data.map(item => ({
          ...item,
          patient_name: patientsMap[item.changes?.patient_id] || '-'
        }));

        setNotifications(enriched);
      }
    };

    fetchNotifications();
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsSidebarOpen(false);
    setIsFabOpen(false);
  }, [location.pathname]);

  const processNavItems = (items) => {
   if (!items) return [];

   // PWA: gunakan menu apa adanya
   if (isPWA) {
      return items;
   }

   let newItems = [...items];
     const isOwnerOrAdmin = ['owner', 'admin'].includes(role);

     if (isOwnerOrAdmin) {
         const dbPath = role === 'owner' ? '/owner/database-patients' : '/admin/database-patients';
         if (!newItems.some(item => item.path === dbPath)) {
             newItems.push({ label: 'Database Pasien', path: dbPath, icon: 'Database' });
         }

         const packagePath = role === 'admin' 
  ? '/admin/package-recaps' 
  : role === 'owner' 
    ? '/owner/package-recaps' 
    : null;
         if (!newItems.some(item => item.path === packagePath)) {
             newItems.push({ label: 'Package Recaps', path: packagePath, icon: 'Package' });
         }

         const followUpPath = '/admin/follow-up-management';
         if (role === 'admin' && !newItems.some(item => item.path === followUpPath)) {
            newItems.push({ label: 'Follow Up Management', path: followUpPath, icon: 'MessageSquare' });
         }
     }

     newItems = newItems.map(item => {
        if (item.label === 'Accounting') return { ...item, label: 'Accounting System' };
        return item;
     });

     if (role === 'admin') {
        const order = ['Dashboard', 'Appointments', 'Daily Recaps', 'Package Recaps', 'Database Pasien', 'Medical Records', 'Physiotherapist Management', 'Follow Up Management', 'Clinical Documents', 'Accounting System', 'Ambil Barang Gudang'];
        const getOrderIndex = (label) => {
            const index = order.findIndex(o => label.toLowerCase().includes(o.toLowerCase()) || (o === 'Appointments' && label.toLowerCase().includes('calendar')) || (o === 'Database Pasien' && label.toLowerCase().includes('database')));
            return index === -1 ? 999 : index;
        };
        newItems.sort((a, b) => getOrderIndex(a.label) - getOrderIndex(b.label));
     } else if (role === 'owner') {
         const order = ['Dashboard', 'Appointments', 'Database Pasien', 'Daily Recaps', 'Package Recaps', 'Medical Records', 'Follow Up Management', 'Physiotherapist Management', 'Accounting System', 'Stok Barang', 'Rekonsiliasi BSI', 'Setup'];
         const getOrderIndex = (label) => {
            const index = order.findIndex(o => label.toLowerCase().includes(o.toLowerCase()) || (o === 'Appointments' && label.toLowerCase().includes('calendar')) || (o === 'Database Pasien' && label.toLowerCase().includes('database')));
            return index === -1 ? 999 : index;
        };
        newItems.sort((a, b) => getOrderIndex(a.label) - getOrderIndex(b.label));
     }

     return newItems;
  };
const pwaNavItems = useMemo(() => {

  if (!isPWA) return navItems;

  if (role === 'admin') {
    return [
      {
        label: 'Dashboard',
        path: '/admin',
        icon: 'Home'
      },
      {
        label: 'Appointments',
        path: '/admin/appointments',
        icon: 'Calendar'
      },
      {
        label: 'Daily Recaps',
        path: '/admin/daily-recap',
        icon: 'FileText'
      },
      {
        label: 'Package Recaps',
        path: '/admin/package-recaps',
        icon: 'Package'
      },
      {
        label: 'Ambil Barang Gudang',
        path: '/admin/inventory-takeout',
        icon: 'Boxes'
      },
      {
        label: 'Database Patients',
        path: '/admin/database-patients',
        icon: 'Database'
      },
      {
        label: 'Medical Records',
        path: '/admin/medical-records',
        icon: 'Activity'
      },
      {
        label: 'Physiotherapist Management',
        path: '/admin/physiotherapist-management',
        icon: 'Users'
      },
      {
        label: 'Follow Up Management',
        path: '/admin/follow-up-management',
        icon: 'MessageSquare'
      },
      {
        label: 'Clinical Documents',
        path: '/admin/clinical-documents',
        icon: 'FileText'
      },
      {
        label: 'Accounting System',
        path: '/admin/accounting',
        icon: 'DollarSign'
      }
    ];
  }

  if (role === 'owner') {
    return [
      {
        label: 'Dashboard',
        path: '/owner/dashboard',
        icon: 'Home'
      },
      {
        label: 'Appointments',
        path: '/owner/appointments',
        icon: 'Calendar'
      },
      {
        label: 'Daily Recaps',
        path: '/owner/daily-recap',
        icon: 'ClipboardList'
      },
      {
        label: 'Package Recaps',
        path: '/owner/package-recaps',
        icon: 'Package'
      },
      {
        label: 'Stok Barang',
        path: '/owner/inventory',
        icon: 'Boxes'
      },
      {
        label: 'Database Patients',
        path: '/owner/database-patients',
        icon: 'Database'
      },
      {
        label: 'Medical Records',
        path: '/owner/medical-records',
        icon: 'Activity'
      },
      {
        label: 'Physiotherapist Management',
        path: '/owner/physiotherapist-management',
        icon: 'Users'
      },
      {
        label: 'Accounting System',
        path: '/owner/accounting',
        icon: 'DollarSign'
      },
      {
        label: 'Modal Awal',
        path: '/owner/modal-awal',
        icon: 'Wallet'
      },
      {
        label: 'Setup',
        path: '/owner/settings',
        icon: 'Settings'
      }
    ];
  }

  if (role === 'therapist') {
    return navItems.filter(item => item.path !== '/therapist/appointments');
  }

  return navItems;

}, [navItems, role, isPWA]);
  const finalNavItems = useMemo(
  () => processNavItems(pwaNavItems),
  [pwaNavItems, role]
);

  

  useEffect(() => {
    const newExpanded = {};
    finalNavItems.forEach((item, index) => {
      if (item.submenu) {
        const isSubmenuActive = item.submenu.some(sub => location.pathname === sub.path);
        if (isSubmenuActive) newExpanded[index] = true;
      }
    });

    setExpandedMenus(prev => {
      const prevStr = JSON.stringify(prev);
      const newStr = JSON.stringify(newExpanded);
      return prevStr === newStr ? prev : newExpanded;
    });

  }, [location.pathname, finalNavItems]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
        className: "bg-slate-900 border-cyan-500/50 text-white"
      });
      navigate('/login');
    } catch (error) {
      console.error("Logout error:", error);
      navigate('/login');
      toast({ variant: "destructive", title: "Logout Notice", description: "Session cleared locally." });
    }
  };

  const toggleSubmenu = (index) => {
    setExpandedMenus(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Converted to standard function rendering to avoid unmount/remount on parent render
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full text-white shadow-2xl relative overflow-hidden" style={{ background: 'var(--app-sidebar-bg, #0f172a)' }}>
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
         <div className="absolute top-[-10%] right-[-20%] w-[200px] h-[200px] bg-blue-600/20 rounded-full blur-[60px]" />
         <div className="absolute bottom-[10%] left-[-10%] w-[150px] h-[150px] bg-cyan-500/10 rounded-full blur-[50px]" />
      </div>

      <div className="flex items-center gap-4 px-6 py-8 relative z-10 border-b border-white/10 flex-shrink-0">
        <div className="relative">
           <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 overflow-hidden">
             {clinicInfo ? (
               <img 
                 src={clinicInfo.logo_url || "https://dqkejdamagvlhqvxaqej.supabase.co/storage/v1/object/public/clinic-assets/logo/1768432355481-n3ep8u.png"}
                 alt={clinicInfo.name || "Clinic Logo"}
                 className="w-full h-full object-contain p-1"
               />
             ) : (
               <div className="w-full h-full animate-pulse bg-slate-200" />
             )}
           </div>
           <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-slate-900 shadow-sm"></div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight leading-none">
            {clinicInfo ? clinicInfo.name : <span className="inline-block w-24 h-4 rounded animate-pulse bg-slate-700 align-middle" />}
          </h2>
          <p className="text-[10px] font-bold tracking-[0.1em] uppercase mt-1" style={{ color: 'var(--app-accent, #93c5fd)' }}>CLINIC MANAGEMENT</p>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6 relative z-10 min-h-0">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Menu Utama</div>
        {finalNavItems.map((item, index) => {
          const Icon = iconMap[item.icon] || Home;
          const isActive = location.pathname === item.path || (item.path !== `/${role}` && location.pathname.startsWith(item.path) && !item.submenu);
          const hasSubmenu = item.submenu && item.submenu.length > 0;
          const isExpanded = expandedMenus[index];
          const isParentActive = hasSubmenu && item.submenu.some(sub => location.pathname === sub.path);

          return (
            <div key={index} className="space-y-1">
              {hasSubmenu ? (
                <button
                  onClick={() => toggleSubmenu(index)}
                  className={cn(
                    "w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden select-none",
                    isParentActive ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className={cn("h-5 w-5 transition-colors", isParentActive ? "text-white" : "text-slate-400 group-hover:text-blue-400")} />
                  <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform duration-200 opacity-50", isExpanded ? "rotate-180" : "")} />
                </button>
              ) : item.onClick ? (
                <button
                  onClick={() => { item.onClick(); setIsSidebarOpen(false); }}
                  className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden text-slate-400 hover:text-white hover:bg-white/5"
                >
                  <Icon className="h-5 w-5 transition-colors text-slate-400 group-hover:text-blue-400" />
                  <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
                </button>
              ) : (
                <NavLink
                  to={item.path}
                  end={item.path === `/${role}` || item.path === `/${role}/dashboard`}
                  className={({ isActive: linkActive }) =>
                    cn(
                      "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden",
                      linkActive || (isActive && item.path !== `/${role}`)
                        ? "text-white shadow-lg" 
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )
                  }
                  style={({ isActive: linkActive }) =>
                    linkActive || (isActive && item.path !== `/${role}`)
                      ? { background: 'var(--app-accent, #2563eb)' }
                      : undefined
                  }
                >
                  {({ isActive: linkActive }) => {
                    const activeState = linkActive || (isActive && item.path !== `/${role}`);
                    return (
                    <>
                      <Icon className={cn("h-5 w-5 transition-colors", activeState ? "text-white" : "text-slate-400 group-hover:text-blue-400")} />
                      <span className="font-medium text-sm flex-1">{item.label}</span>
                      {activeState && <ChevronRight className="w-4 h-4 opacity-50" />}
                      {activeState && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-r-full" />}
                    </>
                  )}}
                </NavLink>
              )}

              <AnimatePresence initial={false}>
                {hasSubmenu && isExpanded && (
                  <motion.div
                    key={`submenu-${index}`} // Critical for Framer Motion inside AnimatePresence
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pl-11 pr-2 space-y-1 py-1">
                      {item.submenu.map((subItem, subIndex) => (
                        <NavLink
                          key={subIndex}
                          to={subItem.path}
                          className={({ isActive }) =>
                            cn(
                              "block px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
                              isActive 
                                ? "bg-white/5" 
                                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                            )
                          }
                          style={({ isActive }) => isActive ? { color: 'var(--app-accent, #60a5fa)' } : undefined}
                        >
                          {({ isActive }) => (
                            <div className="flex items-center gap-2">
                              <span className={cn("w-1.5 h-1.5 rounded-full transition-colors", isActive ? "" : "bg-slate-600")} style={isActive ? { background: 'var(--app-accent, #60a5fa)' } : undefined} />
                              {subItem.label}
                            </div>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto p-4 border-t border-white/10 relative z-10 bg-slate-950/30 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 mb-3">
          <div className="flex-shrink-0 relative">
            <img 
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${typeof userName === 'string' ? userName : 'User'}&backgroundColor=0ea5e9`} 
              alt="Avatar" 
              className="h-10 w-10 rounded-full bg-slate-800 border-2 border-slate-700" 
            />
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="text-sm font-semibold text-white truncate">{typeof userName === 'string' ? userName : 'User'}</p>
            <p className="text-xs text-slate-400 capitalize truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
              {typeof role === 'string' ? role : 'User'}
            </p>
          </div>
        </div>
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 h-10 rounded-xl"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm font-medium">Keluar Aplikasi</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-slate-50" style={{ fontFamily: 'var(--app-font, inherit)' }}>
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Overlay fullscreen */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm"
              style={{ zIndex: 60 }}
            />
            {/* Sidebar */}
            <motion.aside
              key="sidebar"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 w-[280px] h-full shadow-2xl"
              style={{ zIndex: 70 }}
            >
              {renderSidebarContent()}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <aside className="hidden lg:block w-[280px] fixed h-full z-30">
        {renderSidebarContent()}
      </aside>

      <main className={cn(
        "flex-1 flex flex-col lg:ml-[280px] min-h-screen w-full max-w-full overflow-x-hidden transition-all duration-300 px-2 sm:px-0",
        isPWA && (role === 'therapist' || role === 'admin') ? "pt-0" : "pt-0"
      )}>

        {/* Header normal dihapus - digantikan hero banner di masing-masing halaman */}

        <div className={cn(
          "w-full max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500",
          isPWA && (role === 'therapist' || role === 'owner' || role === 'admin') ? "p-4 pt-4 pb-24" : "p-4 sm:p-8 pt-2"
        )}>
           {children}
        </div>
      </main>

      {/* Floating Action Button — pill list 1 kolom, semua menu, scrollable — khusus PWA */}
      {(role === 'therapist' || role === 'owner' || role === 'admin') && (
        <>
          <AnimatePresence>
            {isFabOpen && (
              <motion.div
                key="fab-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsFabOpen(false)}
                className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[75]"
              />
            )}
          </AnimatePresence>

        <div className="lg:hidden fixed right-4 bottom-6 z-[80] flex flex-col items-end gap-3">
          <AnimatePresence>
            {isFabOpen && (
              <motion.div
                key="fab-menu"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col items-end gap-3 max-h-[38vh] overflow-y-auto pr-1 pb-1"
              >
                {finalNavItems.map((item, idx) => {
                  const Icon = iconMap[item.icon] || Home;
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (item.onClick) { item.onClick(); } else { navigate(item.path); }
                        setIsFabOpen(false);
                      }}
                      className="flex items-center gap-2 shrink-0"
                    >
                      <span className={cn(
                        "text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-sm border whitespace-nowrap",
                        isActive
                          ? "text-white"
                          : "bg-white text-slate-700 border-slate-200"
                      )} style={isActive ? { background: 'var(--app-accent, #2563eb)', borderColor: 'var(--app-accent, #2563eb)' } : undefined}>
                        {item.label}
                      </span>
                      <span className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center shadow-md border shrink-0",
                        isActive
                          ? "border-transparent"
                          : "bg-white border-slate-200"
                      )} style={isActive ? { background: 'var(--app-accent, #2563eb)' } : undefined}>
                        <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-slate-600")} />
                      </span>
                    </button>
                  );
                })}

                {/* Pemisah + Tombol Logout */}
                <div className="w-full h-px bg-slate-200 my-0.5" />
                <button
                  onClick={() => {
                    setIsFabOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2 shrink-0"
                >
                  <span className="text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-sm border whitespace-nowrap bg-white text-red-500 border-red-200">
                    Keluar Aplikasi
                  </span>
                  <span className="w-9 h-9 rounded-full flex items-center justify-center shadow-md border shrink-0 bg-white border-red-200">
                    <LogOut className="w-4 h-4 text-red-500" />
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsFabOpen(prev => !prev)}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform shrink-0",
              isFabOpen ? "bg-slate-900 rotate-45" : ""
            )}
            style={!isFabOpen ? { background: 'var(--app-accent, #2563eb)' } : undefined}
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
        </>
      )}
    </div>
  );
};

export default DashboardLayout;
