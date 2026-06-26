
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
      }
    ];
  }

  return navItems; // therapist

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
          <motion.div key="mobile-sidebar-container" className="fixed inset-0 z-40 lg:hidden">
            <motion.div 
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.aside
              key="sidebar"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute top-0 left-0 w-[280px] h-full shadow-2xl"
              style={{ zIndex: 50 }}
            >
              {renderSidebarContent()}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="hidden lg:block w-[280px] fixed h-full z-30">
        {renderSidebarContent()}
      </aside>

      <main className="flex-1 flex flex-col lg:ml-[280px] min-h-screen w-full max-w-full overflow-x-hidden transition-all duration-300 pt-[80px] px-2 sm:px-0">
        <header className={cn(
          "sticky top-4 z-50 mx-4 sm:mx-8 px-4 sm:px-6 py-3 flex justify-between items-center rounded-2xl transition-all duration-300",
          scrolled 
            ? "bg-white/70 backdrop-blur-xl shadow-lg border border-white/40" 
            : "bg-white/50 backdrop-blur-md border border-white/30",
          isPWA && role === 'therapist' && "hidden"
        )}>
          <div className="flex items-center gap-3">
             <Button 
               variant="ghost" 
               size="icon" 
               className="lg:hidden text-slate-600 hover:bg-slate-100"
               onClick={() => setIsSidebarOpen(true)}
             >
               <Menu className="h-6 w-6" />
             </Button>
             
             <div className="flex flex-col">
               <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight capitalize flex items-center gap-2">
  {location.pathname.includes('/records/new')
    ? 'Buat Catatan Medis (SOAP)'
    : location.pathname.includes('/dashboard')
    ? 'Dashboard'
    : location.pathname.split('/').pop().replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())}
</h1>
               <p className="text-xs text-slate-500 hidden sm:block">Welcome back, let's make today productive.</p>
             </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
             <div className="hidden md:flex items-center gap-3 bg-gradient-to-r from-blue-50/80 to-purple-50/80 backdrop-blur-sm px-5 py-2.5 rounded-full border border-blue-100/50 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 group cursor-default">
                <div className="p-2 bg-white rounded-full shadow-sm border border-blue-100 group-hover:border-blue-200 transition-colors">
                  <Clock className="w-4 h-4 text-blue-600 animate-[pulse_2s_ease-in-out_infinite]" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-slate-800 tracking-tight font-mono variant-numeric-tabular">
                    {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="h-4 w-px bg-indigo-200/60 mx-1"></div>
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-widest">
                    {currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
             </div>

             <Button variant="ghost" size="icon" className="hidden sm:flex text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full">
                <Search className="w-5 h-5" />
             </Button>

             <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpenNotif(!openNotif)}
                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full relative"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
            </Button>
            {openNotif && (
              <div className="absolute right-0 top-12 w-80 bg-white shadow-xl rounded-xl border z-50 p-3 max-h-[400px] overflow-y-auto">
                <p className="text-sm font-semibold mb-2">Notifikasi</p>

                {notifications.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">Belum ada aktivitas</p>
                ) : (
                  notifications.map((item) => {
                    const isInsert = item.action === 'INSERT';
                    const isDelete = item.action === 'DELETE';
                    const actionText = isInsert ? 'Menambahkan' : isDelete ? 'Menghapus' : 'Mengubah';
                    const color = isInsert ? 'text-green-600' : isDelete ? 'text-red-500' : 'text-blue-600';

                    const handleClick = async () => {
                      await supabase.from('audit_logs').update({ is_read: true }).eq('id', item.id);

                      if (item.resource_type === 'appointments') {
                        const rawDate = item.changes?.appointment_date;
                        const cleanDate = typeof rawDate === 'string' ? rawDate.split('T')[0] : null;
                        navigate('/admin/appointments', { state: { highlightId: item.resource_id, date: cleanDate } });
                      }

                      if (item.resource_type === 'daily_recaps') {
                        const rawDate = item.changes?.recap_date;
                        const cleanDate = typeof rawDate === 'string' ? rawDate.split('T')[0] : null;
                        navigate('/admin/daily-recaps', { state: { highlightId: item.resource_id, date: cleanDate } });
                      }
                      setOpenNotif(false);
                    };

                    return (
                      <div
                        key={item.id}
                        onClick={handleClick}
                        className="p-3 rounded-xl hover:bg-slate-50 transition border-b last:border-none cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-800">
                            {item.users?.full_name || 'User'}
                          </p>
                          <span className={`text-[10px] font-semibold ${color}`}>
                            {actionText.toUpperCase()}
                          </span>
                        </div>

                        {item.resource_type === 'appointments' && (
                          <div className="mt-1 text-xs text-slate-600">
                            <p className="text-[11px]">📅 Appointment</p>
                            <p className="font-semibold text-slate-900">{item.patient_name || '-'}</p>
                            <p>
                              {safeFormatDate(item.changes?.appointment_date)} • {safeFormatTime(item.changes?.appointment_date)}
                            </p>
                          </div>
                        )}

                        {item.resource_type === 'daily_recaps' && (
                          <div className="mt-1 text-xs text-slate-600">
                            <p className="text-[11px]">📝 Daily Recap</p>
                            <p className="font-semibold text-slate-900">{item.patient_name || '-'}</p>
                          </div>
                        )}

                        {item.resource_type !== 'appointments' && item.resource_type !== 'daily_recaps' && (
                          <p className="text-xs text-slate-600 mt-1">
                            {actionText} {item.resource_type}
                          </p>
                        )}

                        <p className="text-[10px] text-gray-400 mt-2">
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </header>
        
        <div className="p-4 sm:p-8 pt-20 w-full max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
           {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
