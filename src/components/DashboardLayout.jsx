
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, Calendar, Users, Settings, LogOut, Activity, Briefcase, 
  User, Clock, Menu, ChevronRight, Bell, Search, LayoutDashboard,
  FileText, Package, ClipboardList, Database, DollarSign, ChevronDown,
  MessageSquare
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
  MessageSquare
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
  const { signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
        const order = ['Dashboard', 'Appointments', 'Daily Recaps', 'Package Recaps', 'Database Pasien', 'Medical Records', 'Physiotherapist Management', 'Follow Up Management', 'Clinical Documents', 'Accounting System'];
        const getOrderIndex = (label) => {
            const index = order.findIndex(o => label.toLowerCase().includes(o.toLowerCase()) || (o === 'Appointments' && label.toLowerCase().includes('calendar')) || (o === 'Database Pasien' && label.toLowerCase().includes('database')));
            return index === -1 ? 999 : index;
        };
        newItems.sort((a, b) => getOrderIndex(a.label) - getOrderIndex(b.label));
     } else if (role === 'owner') {
         const order = ['Dashboard', 'Appointments', 'Database Pasien', 'Daily Recaps', 'Package Recaps', 'Medical Records', 'Physiotherapist Management', 'Accounting System', 'Setup'];
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
        label: 'Appointments',
        path: '/admin/appointments',
        icon: 'Calendar'
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
        path: '/owner/therapist-management',
        icon: 'Users'
      },
      {
        label: 'Accounting System',
        path: '/owner/finance-dashboard',
        icon: 'DollarSign'
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
    <div className="flex flex-col h-full bg-slate-900 text-white shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
         <div className="absolute top-[-10%] right-[-20%] w-[200px] h-[200px] bg-blue-600/20 rounded-full blur-[60px]" />
         <div className="absolute bottom-[10%] left-[-10%] w-[150px] h-[150px] bg-cyan-500/10 rounded-full blur-[50px]" />
      </div>

      <div className="flex items-center gap-4 px-6 py-8 relative z-10 border-b border-white/10 flex-shrink-0">
        <div className="relative">
           <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 overflow-hidden">
             <img 
  src="https://dqkejdamagvlhqvxaqej.supabase.co/storage/v1/object/public/clinic-assets/logo/1768432355481-n3ep8u.png"
  alt="Kaffah Physiotherapy Logo"
  className="w-full h-full object-contain p-1"
/>
           </div>
           <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-slate-900 shadow-sm"></div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight leading-none">Kaffah</h2>
          <p className="text-[10px] text-blue-300 font-bold tracking-[0.1em] uppercase mt-1">PHYSIOTHERAPY</p>
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
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30" 
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )
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
                                ? "text-blue-400 bg-blue-500/10" 
                                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                            )
                          }
                        >
                          {({ isActive }) => (
                            <div className="flex items-center gap-2">
                              <span className={cn("w-1.5 h-1.5 rounded-full transition-colors", isActive ? "bg-blue-400" : "bg-slate-600")} />
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
    <div className="flex min-h-screen w-full overflow-x-hidden bg-slate-50 font-sans">
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
        isPWA && role === 'therapist' ? "pt-0" : "pt-0"
      )}>

        {/* Header khusus PWA Therapist */}
        {isPWA && role === 'therapist' && (
          <header className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-600 hover:bg-slate-100 rounded-xl shrink-0"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-base font-bold text-slate-800 truncate">
              {location.pathname === '/therapist' ? 'Dashboard'
                : location.pathname.includes('/booking') ? 'Booking Calendar'
                : location.pathname.includes('/appointments') ? 'Daftar Appointment'
                : location.pathname.includes('/records/new') ? 'Buat SOAP'
                : location.pathname.includes('/records') ? 'Evaluasi Pasien'
                : 'Therapist'}
            </h1>
          </header>
        )}

        {/* Header khusus PWA Owner */}
        {isPWA && role === 'owner' && (
          <header className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-100 shadow-sm">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-600 hover:bg-slate-100 rounded-xl shrink-0"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-base font-bold text-slate-800 truncate">
                {location.pathname.includes('/dashboard') ? 'Dashboard'
                  : location.pathname.includes('/appointments') ? 'Appointments'
                  : location.pathname.includes('/daily-recap') ? 'Daily Recaps'
                  : location.pathname.includes('/package-recaps') ? 'Package Recaps'
                  : location.pathname.includes('/medical-records') ? 'Medical Records'
                  : location.pathname.includes('/therapist-management') ? 'Therapist Management'
                  : location.pathname.includes('/finance-dashboard') ? 'Accounting System'
                  : location.pathname.includes('/settings') ? 'Setup'
                  : 'Owner'}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                <span className="text-xs font-semibold text-slate-600">Owner</span>
              </div>
            </div>
          </header>
        )}

        {/* Header normal dihapus - digantikan hero banner di masing-masing halaman */}

        <div className={cn(
          "w-full max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500",
          isPWA && (role === 'therapist' || role === 'owner') ? "p-4 pt-4 pb-24" : "p-4 sm:p-8 pt-2"
        )}>
           {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
