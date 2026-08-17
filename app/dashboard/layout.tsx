'use client';

import {
  ReactNode,
  useEffect,
  useState,
  useTransition,
} from 'react';

import {
  usePathname,
  useRouter,
} from 'next/navigation';

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';

import {
  BarChart2,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileCheck,
  FileText,
  GraduationCap,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

/* =========================================================
   TYPES
========================================================= */

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

/* =========================================================
   ANIMATION CONFIG
========================================================= */

const sidebarVariants = {
  expanded: {
    width: 280,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  collapsed: {
    width: 84,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const mobileSidebarVariants = {
  closed: {
    x: '-100%',
    transition: {
      duration: 0.28,
      ease: [0.4, 0, 1, 1],
    },
  },
  open: {
    x: 0,
    transition: {
      duration: 0.32,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const menuContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.035,
    },
  },
};

const menuItemVariants = {
  hidden: {
    opacity: 0,
    x: -6,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

const dropdownVariants = {
  hidden: {
    opacity: 0,
    y: -6,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.18,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.98,
    transition: {
      duration: 0.14,
    },
  },
};

/* =========================================================
   COMPONENT
========================================================= */

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const {
    user,
    loading,
    signOut,
  } = useAuth();

  const router = useRouter();
  const pathname = usePathname();

  const reduceMotion = useReducedMotion();

  const [isPending, startTransition] =
    useTransition();

  const [navigating, setNavigating] =
    useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [mobileSidebarOpen, setMobileSidebarOpen] =
    useState(false);

  const [openGroups, setOpenGroups] =
    useState<Record<string, boolean>>({
      masterData: true,
      assessment: true,
      administrasi: true,
      analysis: true,
    });

  const [notificationOpen, setNotificationOpen] =
    useState(false);

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [isDark, setIsDark] =
    useState(false);

  /* =======================================================
     AUTH
  ======================================================= */

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (
      !loading &&
      user &&
      !user.emailVerified
    ) {
      router.push(
        `/verify-email-pending?email=${encodeURIComponent(
          user.email || ''
        )}&userId=${user.uid}`
      );
    }
  }, [
    user,
    loading,
    router,
  ]);

  /* =======================================================
     RESET NAVIGATION STATE
  ======================================================= */

  useEffect(() => {
    setNavigating(false);
    setMobileSidebarOpen(false);
    setNotificationOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  /* =======================================================
     CLOSE DROPDOWNS WHEN CLICKING ESC
  ======================================================= */

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setNotificationOpen(false);
        setProfileOpen(false);
        setMobileSidebarOpen(false);
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      );
    };
  }, []);

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const handleNavigation = (
    href: string
  ) => {
    if (pathname === href) {
      setMobileSidebarOpen(false);
      return;
    }

    setNavigating(true);

    startTransition(() => {
      router.push(href);
    });
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleSignOut = async () => {
    try {
      setProfileOpen(false);

      await signOut();

      router.push('/login');
    } catch (error) {
      console.error(
        'Logout failed:',
        error
      );
    }
  };

  /* =======================================================
     TOGGLE GROUP
  ======================================================= */

  const toggleGroup = (
    id: string
  ) => {
    setOpenGroups((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  /* =======================================================
     PAGE TITLE
  ======================================================= */

  const getPageTitle = () => {
    if (
      pathname === '/dashboard' ||
      pathname === '/'
    ) {
      return 'Dashboard';
    }

    const pages = [
      {
        match: 'master-data',
        title: 'Master Data',
      },
      {
        match: 'generate-tp',
        title: 'Generate TP',
      },
      {
        match: 'my-tp',
        title: 'TP Tersimpan',
      },
      {
        match: 'bank-soal',
        title: 'Bank Soal',
      },
      {
        match: 'template-ujian',
        title: 'Template Ujian',
      },
      {
        match: 'generate-soal',
        title: 'Generate Soal',
      },
      {
        match: 'koreksi',
        title: 'Koreksi Digital',
      },
      {
        match: 'rekap-nilai',
        title: 'Rekap Nilai',
      },
      {
        match: 'jurnal',
        title: 'Jurnal & Absensi',
      },
      {
        match: 'riwayat-jurnal',
        title: 'Riwayat Jurnal',
      },
      {
        match: 'rekap-kehadiran',
        title: 'Rekap Kehadiran',
      },
      {
        match: 'analisis-tp',
        title: 'Analisis TP',
      },
      {
        match: 'analisis-nilai',
        title: 'Analisis Nilai Siswa',
      },
      {
        match: 'analisis-butir-soal',
        title: 'Analisis Butir Soal',
      },
    ];

    const found = pages.find(
      (page) =>
        pathname.includes(page.match)
    );

    return found?.title ?? 'EdTech';
  };

  /* =======================================================
     NAVIGATION DATA
  ======================================================= */

  const menuGroups: NavGroup[] = [
    {
      id: 'masterData',
      label: 'Master Data',
      icon: Database,
      items: [
        {
          label: 'Kelas & Siswa',
          href: '/dashboard/master-data',
          icon: Users,
        },
        {
          label: 'Generate TP',
          href: '/dashboard/generate-tp',
          icon: Brain,
        },
        {
          label: 'TP Tersimpan',
          href: '/dashboard/my-tp',
          icon: BookOpen,
        },
        {
          label: 'Bank Soal',
          href: '/dashboard/bank-soal',
          icon: FileText,
        },
        {
          label: 'Template Ujian',
          href: '/dashboard/template-ujian',
          icon: FileCheck,
        },
      ],
    },
    {
      id: 'assessment',
      label: 'Assessment',
      icon: ClipboardCheck,
      items: [
        {
          label: 'Generate Soal',
          href: '/dashboard/generate-soal',
          icon: Brain,
        },
        {
          label: 'Koreksi Digital',
          href: '/dashboard/koreksi',
          icon: ClipboardCheck,
        },
        {
          label: 'Rekap Nilai',
          href: '/dashboard/rekap-nilai',
          icon: BarChart3,
        },
      ],
    },
    {
      id: 'administrasi',
      label: 'Administrasi',
      icon: ClipboardList,
      items: [
        {
          label: 'Jurnal & Absensi',
          href: '/dashboard/jurnal',
          icon: BookOpen,
        },
        {
          label: 'Riwayat Jurnal',
          href: '/dashboard/riwayat-jurnal',
          icon: FileText,
        },
        {
          label: 'Rekap Kehadiran',
          href: '/dashboard/rekap-kehadiran',
          icon: Users,
        },
      ],
    },
    {
      id: 'analysis',
      label: 'Analysis',
      icon: BarChart3,
      items: [
        {
          label: 'Analisis TP',
          href: '/dashboard/analisis-tp',
          icon: BarChart3,
        },
        {
          label: 'Analisis Nilai Siswa',
          href: '/dashboard/analisis-nilai',
          icon: Users,
        },
        {
          label: 'Analisis Butir Soal',
          href: '/dashboard/analisis-butir-soal',
          icon: BarChart2,
        },
      ],
    },
  ];

  /* =======================================================
     ACTIVE STATE
  ======================================================= */

  const isItemActive = (
    href: string
  ) => {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <motion.div
          initial={
            reduceMotion
              ? false
              : {
                  opacity: 0,
                  scale: 0.92,
                }
          }
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: 1,
                  scale: 1,
                }
          }
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-xl shadow-blue-200">
              <GraduationCap className="h-7 w-7 text-white" />
            </div>

            <motion.span
              animate={
                reduceMotion
                  ? undefined
                  : {
                      scale: [1, 1.2, 1],
                    }
              }
              transition={{
                duration: 1.8,
                repeat: Infinity,
              }}
              className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-400"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <motion.div
              animate={
                reduceMotion
                  ? undefined
                  : {
                      rotate: 360,
                    }
              }
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-blue-600" />
            </motion.div>

            Memuat EdTech...
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  /* =======================================================
     NAV ITEM
  ======================================================= */

  const renderNavItem = (
    item: NavItem,
    mobile = false
  ) => {
    const Icon = item.icon;
    const active = isItemActive(
      item.href
    );

    const isCollapsed =
      sidebarCollapsed && !mobile;

    return (
      <motion.button
        key={item.href}
        variants={
          reduceMotion
            ? undefined
            : menuItemVariants
        }
        whileHover={
          reduceMotion
            ? undefined
            : {
                x: active ? 0 : 2,
              }
        }
        whileTap={
          reduceMotion
            ? undefined
            : {
                scale: 0.985,
              }
        }
        onClick={() =>
          handleNavigation(item.href)
        }
        title={
          isCollapsed
            ? item.label
            : undefined
        }
        className={`
          group
          relative
          flex
          w-full
          items-center
          ${
            isCollapsed
              ? 'justify-center'
              : 'gap-3'
          }
          rounded-xl
          px-3
          py-2.5
          text-sm
          transition-colors
          duration-200
          ${
            active
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }
        `}
      >
        {active && (
          <motion.span
            layoutId="desktop-active-indicator"
            className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-blue-600"
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
            }}
          />
        )}

        <motion.span
          whileHover={
            reduceMotion
              ? undefined
              : {
                  scale: 1.08,
                }
          }
          className="flex shrink-0"
        >
          <Icon
            className={`
              h-[19px]
              w-[19px]
              ${
                active
                  ? 'text-blue-600'
                  : 'text-slate-500 group-hover:text-slate-700'
              }
            `}
          />
        </motion.span>

        {!isCollapsed && (
          <span
            className={`
              truncate
              font-medium
              ${
                active
                  ? 'text-blue-700'
                  : 'text-slate-600'
              }
            `}
          >
            {item.label}
          </span>
        )}
      </motion.button>
    );
  };

  /* =======================================================
     NAV GROUP
  ======================================================= */

  const renderNavGroup = (
    group: NavGroup,
    mobile = false
  ) => {
    const Icon = group.icon;

    const isOpen =
      openGroups[group.id];

    const isCollapsed =
      sidebarCollapsed && !mobile;

    return (
      <motion.div
        variants={
          reduceMotion
            ? undefined
            : menuItemVariants
        }
        className="mb-2"
      >
        <motion.button
          whileHover={
            reduceMotion
              ? undefined
              : {
                  x: isCollapsed ? 0 : 1,
                }
          }
          whileTap={
            reduceMotion
              ? undefined
              : {
                  scale: 0.99,
                }
          }
          onClick={() => {
            if (isCollapsed) {
              setSidebarCollapsed(false);
              setOpenGroups((current) => ({
                ...current,
                [group.id]: true,
              }));
              return;
            }

            toggleGroup(group.id);
          }}
          title={
            isCollapsed
              ? group.label
              : undefined
          }
          className={`
            flex
            w-full
            items-center
            ${
              isCollapsed
                ? 'justify-center'
                : 'justify-between'
            }
            gap-2
            rounded-xl
            px-3
            py-2.5
            text-slate-500
            transition-colors
            duration-200
            hover:bg-slate-50
            hover:text-slate-900
          `}
        >
          <div
            className={`
              flex
              items-center
              ${
                isCollapsed
                  ? 'justify-center'
                  : 'gap-3'
              }
            `}
          >
            <Icon className="h-[19px] w-[19px] shrink-0" />

            {!isCollapsed && (
              <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
                {group.label}
              </span>
            )}
          </div>

          {!isCollapsed && (
            <motion.span
              animate={{
                rotate: isOpen ? 0 : -90,
              }}
              transition={{
                duration: 0.2,
              }}
            >
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </motion.span>
          )}
        </motion.button>

        <AnimatePresence initial={false}>
          {isOpen &&
            !isCollapsed && (
              <motion.div
                initial={
                  reduceMotion
                    ? false
                    : {
                        height: 0,
                        opacity: 0,
                      }
                }
                animate={{
                  height: 'auto',
                  opacity: 1,
                }}
                exit={
                  reduceMotion
                    ? undefined
                    : {
                        height: 0,
                        opacity: 0,
                      }
                }
                transition={{
                  duration: 0.22,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="overflow-hidden"
              >
                <motion.div
                  variants={menuContainerVariants}
                  initial={
                    reduceMotion
                      ? false
                      : 'hidden'
                  }
                  animate={
                    reduceMotion
                      ? undefined
                      : 'visible'
                  }
                  className="ml-2 mt-1 space-y-1 border-l border-slate-200 pl-3"
                >
                  {group.items.map(
                    (item) =>
                      renderNavItem(
                        item,
                        mobile
                      )
                  )}
                </motion.div>
              </motion.div>
            )}
        </AnimatePresence>
      </motion.div>
    );
  };

  /* =======================================================
     SIDEBAR CONTENT
  ======================================================= */

  const sidebarContent = (
    <div className="flex h-full flex-col">

      {/* LOGO */}
      <div className="px-4 pb-4 pt-5">
        <div
          className={`
            flex
            items-center
            ${
              sidebarCollapsed
                ? 'justify-center'
                : 'gap-3'
            }
          `}
        >
          <motion.div
            whileHover={
              reduceMotion
                ? undefined
                : {
                    rotate: -4,
                    scale: 1.05,
                  }
            }
            className="relative shrink-0"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-blue-200">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>

            <motion.span
              animate={
                reduceMotion
                  ? undefined
                  : {
                      scale: [1, 1.15, 1],
                    }
              }
              transition={{
                duration: 2.4,
                repeat: Infinity,
              }}
              className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400"
            />
          </motion.div>

          <AnimatePresence initial={false}>
            {!sidebarCollapsed && (
              <motion.div
                initial={{
                  opacity: 0,
                  width: 0,
                }}
                animate={{
                  opacity: 1,
                  width: 'auto',
                }}
                exit={{
                  opacity: 0,
                  width: 0,
                }}
                transition={{
                  duration: 0.2,
                }}
                className="min-w-0 overflow-hidden"
              >
                <p className="truncate text-base font-bold leading-none text-slate-900">
                  EdTech
                </p>

                <p className="mt-1 truncate text-[11px] text-slate-400">
                  Kurikulum Merdeka
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* COLLAPSE */}
      <div className="px-4 pb-4">
        <motion.button
          whileHover={
            reduceMotion
              ? undefined
              : {
                  scale: 1.01,
                }
          }
          whileTap={
            reduceMotion
              ? undefined
              : {
                  scale: 0.98,
                }
          }
          onClick={() =>
            setSidebarCollapsed(
              (value) => !value
            )
          }
          className={`
            flex
            h-9
            w-full
            items-center
            ${
              sidebarCollapsed
                ? 'justify-center'
                : 'justify-between'
            }
            rounded-xl
            border
            border-slate-200
            bg-slate-50
            px-3
            text-slate-500
            transition-colors
            hover:bg-slate-100
            hover:text-slate-800
          `}
        >
          {!sidebarCollapsed && (
            <span className="text-[11px] font-semibold">
              Navigasi
            </span>
          )}

          <motion.span
            animate={{
              rotate: sidebarCollapsed
                ? 0
                : 180,
            }}
            transition={{
              duration: 0.25,
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.span>
        </motion.button>
      </div>

      {/* NAVIGATION */}
      <motion.nav
        variants={
          reduceMotion
            ? undefined
            : menuContainerVariants
        }
        initial={
          reduceMotion
            ? false
            : 'hidden'
        }
        animate={
          reduceMotion
            ? undefined
            : 'visible'
        }
        className="scrollbar-thin scrollbar-thumb-slate-200 flex-1 overflow-y-auto px-4 pb-4"
      >
        <div className="mb-4">
          {renderNavItem({
            label: 'Dashboard',
            href: '/dashboard',
            icon: LayoutDashboard,
          })}
        </div>

        {menuGroups.map(
          (group) =>
            renderNavGroup(group)
        )}
      </motion.nav>

      {/* BOTTOM */}
      <div className="border-t border-slate-100 p-4">

        {!sidebarCollapsed ? (
          <motion.div
            layout
            className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 1.06,
                      }
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white shadow-sm"
              >
                {user.email?.[0]?.toUpperCase() ||
                  'U'}
              </motion.div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-400">
                  Akun aktif
                </p>

                <p className="truncate text-xs font-semibold text-slate-700">
                  {user.email}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="mt-3 h-9 w-full justify-start rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </motion.div>
        ) : (
          <motion.button
            whileHover={
              reduceMotion
                ? undefined
                : {
                    scale: 1.05,
                  }
            }
            whileTap={
              reduceMotion
                ? undefined
                : {
                    scale: 0.96,
                  }
            }
            onClick={handleSignOut}
            title="Logout"
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <LogOut className="h-5 w-5" />
          </motion.button>
        )}
      </div>
    </div>
  );

  /* =======================================================
     RETURN
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">

      {/* ===================================================
          BACKGROUND DECORATION
      ==================================================== */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          animate={
            reduceMotion
              ? undefined
              : {
                  x: [0, 20, 0],
                  y: [0, -15, 0],
                }
          }
          transition={
            reduceMotion
              ? undefined
              : {
                  duration: 14,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
          }
          className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-100/30 blur-3xl"
        />

        <motion.div
          animate={
            reduceMotion
              ? undefined
              : {
                  x: [0, -15, 0],
                  y: [0, 12, 0],
                }
          }
          transition={
            reduceMotion
              ? undefined
              : {
                  duration: 16,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
          }
          className="absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-violet-100/25 blur-3xl"
        />
      </div>

      {/* ===================================================
          DESKTOP SIDEBAR
      ==================================================== */}

      <motion.aside
        variants={
          reduceMotion
            ? undefined
            : sidebarVariants
        }
        initial={false}
        animate={
          reduceMotion
            ? undefined
            : sidebarCollapsed
              ? 'collapsed'
              : 'expanded'
        }
        className="fixed bottom-4 left-4 top-4 z-40 hidden flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_12px_50px_rgba(15,23,42,0.07)] backdrop-blur-xl lg:flex"
      >
        {sidebarContent}
      </motion.aside>

      {/* ===================================================
          MOBILE OVERLAY
      ==================================================== */}

      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={
              reduceMotion
                ? false
                : {
                    opacity: 0,
                  }
            }
            animate={{
              opacity: 1,
            }}
            exit={
              reduceMotion
                ? undefined
                : {
                    opacity: 0,
                  }
            }
            onClick={() =>
              setMobileSidebarOpen(false)
            }
            className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ===================================================
          MOBILE SIDEBAR
      ==================================================== */}

      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.aside
            variants={
              reduceMotion
                ? undefined
                : mobileSidebarVariants
            }
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed bottom-0 left-0 top-0 z-[60] flex w-[290px] flex-col overflow-hidden bg-white shadow-2xl lg:hidden"
          >
            <div className="absolute right-3 top-3 z-10">
              <motion.button
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 1.05,
                      }
                }
                whileTap={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 0.95,
                      }
                }
                onClick={() =>
                  setMobileSidebarOpen(
                    false
                  )
                }
                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ===================================================
          MAIN
      ==================================================== */}

      <motion.main
        animate={
          reduceMotion
            ? undefined
            : {
                paddingLeft:
                  sidebarCollapsed
                    ? 116
                    : 312,
              }
        }
        transition={{
          duration: 0.3,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="relative min-h-screen lg:pl-[312px]"
      >

        {/* =================================================
            TOP NAVBAR
        ================================================= */}

        <header className="sticky top-0 z-30 px-4 pb-1 pt-4 sm:px-6 lg:px-8">

          <div className="flex h-[72px] items-center justify-between rounded-2xl border border-slate-200/80 bg-white/90 px-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl sm:px-5">

            {/* LEFT */}
            <div className="flex min-w-0 items-center gap-3">

              {/* Mobile button */}
              <motion.button
                whileTap={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 0.92,
                      }
                }
                onClick={() =>
                  setMobileSidebarOpen(true)
                }
                className="rounded-xl p-2.5 text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </motion.button>

              {/* Title */}
              <div className="min-w-0">
                <p className="hidden text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:block">
                  EdTech Workspace
                </p>

                <div className="flex items-center gap-2">
                  <motion.h1
                    key={getPageTitle()}
                    initial={
                      reduceMotion
                        ? false
                        : {
                            opacity: 0,
                            y: 4,
                          }
                    }
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      duration: 0.2,
                    }}
                    className="truncate text-base font-bold text-slate-900 sm:text-lg"
                  >
                    {getPageTitle()}
                  </motion.h1>

                  {pathname ===
                    '/dashboard' && (
                    <motion.div
                      animate={
                        reduceMotion
                          ? undefined
                          : {
                              rotate: [
                                0,
                                7,
                                -7,
                                0,
                              ],
                            }
                      }
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        repeatDelay: 3,
                      }}
                    >
                      <Sparkles className="h-4 w-4 text-amber-400" />
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-1.5 sm:gap-2">

              {/* SEARCH */}
              <motion.button
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 1.01,
                      }
                }
                whileTap={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 0.99,
                      }
                }
                onClick={() =>
                  setSearchOpen(true)
                }
                className="hidden h-10 w-[220px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-slate-400 transition-colors hover:bg-slate-100 md:flex lg:w-[280px]"
              >
                <Search className="h-4 w-4" />

                <span className="text-xs">
                  Cari sesuatu...
                </span>

                <span className="ml-auto rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold">
                  ⌘K
                </span>
              </motion.button>

              {/* MOBILE SEARCH */}
              <motion.button
                whileTap={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 0.92,
                      }
                }
                onClick={() =>
                  setSearchOpen(true)
                }
                className="rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 md:hidden"
              >
                <Search className="h-5 w-5" />
              </motion.button>

              {/* NOTIFICATION */}
              <div className="relative">

                <motion.button
                  whileHover={
                    reduceMotion
                      ? undefined
                      : {
                          scale: 1.04,
                        }
                  }
                  whileTap={
                    reduceMotion
                      ? undefined
                      : {
                          scale: 0.92,
                        }
                  }
                  onClick={() => {
                    setNotificationOpen(
                      (value) => !value
                    );
                    setProfileOpen(false);
                  }}
                  className={`
                    relative
                    rounded-xl
                    p-2.5
                    transition-colors
                    ${
                      notificationOpen
                        ? 'bg-slate-100 text-slate-800'
                        : 'text-slate-500 hover:bg-slate-100'
                    }
                  `}
                >
                  <Bell className="h-5 w-5" />

                  <motion.span
                    animate={
                      reduceMotion
                        ? undefined
                        : {
                            scale: [1, 1.25, 1],
                          }
                    }
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatDelay: 2,
                    }}
                    className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-red-500"
                  />
                </motion.button>

                <AnimatePresence>
                  {notificationOpen && (
                    <motion.div
                      variants={dropdownVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute right-0 top-12 z-50 w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            Notifikasi
                          </p>

                          <p className="text-[10px] text-slate-400">
                            3 pemberitahuan baru
                          </p>
                        </div>

                        <button className="text-[10px] font-semibold text-blue-600 hover:text-blue-700">
                          Tandai dibaca
                        </button>
                      </div>

                      <div className="space-y-1 p-2">

                        {[
                          {
                            title:
                              '12 TP belum memiliki soal',
                            text:
                              'Gunakan Generate Soal AI untuk melanjutkan.',
                            icon: Brain,
                            color:
                              'bg-violet-50 text-violet-600',
                          },
                          {
                            title:
                              'Data nilai siap dianalisis',
                            text:
                              'Terdapat penilaian terbaru.',
                            icon: BarChart3,
                            color:
                              'bg-blue-50 text-blue-600',
                          },
                          {
                            title:
                              'Template ujian diperbarui',
                            text:
                              'Template terakhir berhasil disimpan.',
                            icon: FileCheck,
                            color:
                              'bg-emerald-50 text-emerald-600',
                          },
                        ].map(
                          (
                            notification
                          ) => {
                            const Icon =
                              notification.icon;

                            return (
                              <motion.div
                                key={
                                  notification.title
                                }
                                whileHover={
                                  reduceMotion
                                    ? undefined
                                    : {
                                        x: 2,
                                      }
                                }
                                className="flex gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50"
                              >
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${notification.color}`}
                                >
                                  <Icon className="h-4 w-4" />
                                </div>

                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-800">
                                    {
                                      notification.title
                                    }
                                  </p>

                                  <p className="mt-1 text-[10px] leading-4 text-slate-400">
                                    {
                                      notification.text
                                    }
                                  </p>
                                </div>
                              </motion.div>
                            );
                          }
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* THEME */}
              <motion.button
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        rotate: 10,
                        scale: 1.04,
                      }
                }
                whileTap={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 0.92,
                      }
                }
                onClick={() =>
                  setIsDark(
                    (value) => !value
                  )
                }
                className="hidden rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 sm:block"
                title="Tema"
              >
                <AnimatePresence
                  mode="wait"
                  initial={false}
                >
                  {isDark ? (
                    <motion.span
                      key="sun"
                      initial={{
                        opacity: 0,
                        scale: 0.7,
                        rotate: -30,
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                        rotate: 0,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.7,
                        rotate: 30,
                      }}
                    >
                      <Sun className="h-5 w-5" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="moon"
                      initial={{
                        opacity: 0,
                        scale: 0.7,
                        rotate: 30,
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                        rotate: 0,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.7,
                        rotate: -30,
                      }}
                    >
                      <Moon className="h-5 w-5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* DIVIDER */}
              <div className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" />

              {/* PROFILE */}
              <div className="relative">

                <motion.button
                  whileHover={
                    reduceMotion
                      ? undefined
                      : {
                          scale: 1.01,
                        }
                  }
                  whileTap={
                    reduceMotion
                      ? undefined
                      : {
                          scale: 0.98,
                        }
                  }
                  onClick={() => {
                    setProfileOpen(
                      (value) => !value
                    );
                    setNotificationOpen(
                      false
                    );
                  }}
                  className={`
                    flex
                    items-center
                    gap-2
                    rounded-xl
                    p-1.5
                    sm:p-1
                    transition-colors
                    ${
                      profileOpen
                        ? 'bg-slate-100'
                        : 'hover:bg-slate-50'
                    }
                  `}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white shadow-sm">
                    {user.email?.[0]?.toUpperCase() ||
                      'U'}
                  </div>

                  <div className="hidden text-left xl:block">
                    <p className="max-w-[130px] truncate text-xs font-semibold text-slate-700">
                      {user.email}
                    </p>

                    <p className="text-[10px] text-slate-400">
                      Guru
                    </p>
                  </div>

                  <motion.span
                    animate={{
                      rotate: profileOpen
                        ? 180
                        : 0,
                    }}
                    transition={{
                      duration: 0.2,
                    }}
                  >
                    <ChevronDown className="hidden h-4 w-4 text-slate-400 xl:block" />
                  </motion.span>
                </motion.button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      variants={dropdownVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                    >
                      <div className="border-b border-slate-100 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 font-bold text-white">
                            {user.email?.[0]?.toUpperCase() ||
                              'U'}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">
                              {user.email}
                            </p>

                            <p className="mt-0.5 text-[10px] text-slate-400">
                              Guru • EdTech
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-2">

                        <motion.button
                          whileHover={
                            reduceMotion
                              ? undefined
                              : {
                                  x: 2,
                                }
                          }
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Settings className="h-4 w-4" />
                          Pengaturan
                        </motion.button>

                        <motion.button
                          whileHover={
                            reduceMotion
                              ? undefined
                              : {
                                  x: 2,
                                }
                          }
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          <HelpCircle className="h-4 w-4" />
                          Bantuan
                        </motion.button>

                        <div className="my-1 border-t border-slate-100" />

                        <motion.button
                          whileHover={
                            reduceMotion
                              ? undefined
                              : {
                                  x: 2,
                                }
                          }
                          onClick={
                            handleSignOut
                          }
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <LogOut className="h-4 w-4" />
                          Logout
                        </motion.button>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* =================================================
            NAVIGATION PROGRESS
        ================================================= */}

        {(navigating || isPending) && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-1"
          >
            <motion.div
              initial={{
                width: '0%',
              }}
              animate={{
                width: '85%',
              }}
              transition={{
                duration: 0.7,
                ease: 'easeOut',
              }}
              className="h-full bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400"
            />

            <motion.div
              animate={{
                x: ['0%', '100%'],
              }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute right-0 top-0 h-full w-24 bg-white/40 blur-sm"
            />
          </motion.div>
        )}

        {/* =================================================
            SEARCH MODAL
        ================================================= */}

        <AnimatePresence>
          {searchOpen && (
            <>
              <motion.div
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                      }
                }
                animate={{
                  opacity: 1,
                }}
                exit={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 0,
                      }
                }
                onClick={() =>
                  setSearchOpen(false)
                }
                className="fixed inset-0 z-[80] bg-slate-950/30 backdrop-blur-sm"
              />

              <motion.div
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: -15,
                        scale: 0.98,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 0,
                        y: -15,
                        scale: 0.98,
                      }
                }
                className="fixed left-1/2 top-[15%] z-[90] w-[calc(100%-32px)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              >
                <div className="border-b border-slate-100 p-4">
                  <div className="flex items-center gap-3">
                    <Search className="h-5 w-5 text-slate-400" />

                    <input
                      autoFocus
                      type="text"
                      placeholder="Cari fitur, halaman, atau data..."
                      className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    />

                    <button
                      onClick={() =>
                        setSearchOpen(
                          false
                        )
                      }
                      className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500"
                    >
                      ESC
                    </button>
                  </div>
                </div>

                <div className="p-3">
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Akses cepat
                  </p>

                  {[
                    {
                      title:
                        'Generate TP',
                      href:
                        '/dashboard/generate-tp',
                      icon: Brain,
                    },
                    {
                      title:
                        'Generate Soal',
                      href:
                        '/dashboard/generate-soal',
                      icon: ClipboardCheck,
                    },
                    {
                      title:
                        'Bank Soal',
                      href:
                        '/dashboard/bank-soal',
                      icon: FileText,
                    },
                    {
                      title:
                        'Analisis Nilai',
                      href:
                        '/dashboard/analisis-nilai',
                      icon: BarChart3,
                    },
                  ].map(
                    (item) => {
                      const Icon =
                        item.icon;

                      return (
                        <motion.button
                          key={item.href}
                          whileHover={
                            reduceMotion
                              ? undefined
                              : {
                                  x: 3,
                                }
                          }
                          onClick={() => {
                            setSearchOpen(
                              false
                            );
                            handleNavigation(
                              item.href
                            );
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-50"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Icon className="h-4 w-4" />
                          </div>

                          <span className="text-sm font-semibold text-slate-700">
                            {item.title}
                          </span>

                          <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
                        </motion.button>
                      );
                    }
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* =================================================
            CONTENT
        ================================================= */}

        <motion.div
          layout
          className="relative px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          <div className="mx-auto w-full max-w-[1700px]">
            {children}
          </div>
        </motion.div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1700px] flex-col items-center justify-between gap-2 text-xs text-slate-400 sm:flex-row">
            <p>
              © {new Date().getFullYear()} EdTech
            </p>

            <div className="flex items-center gap-4">
              <button className="transition-colors hover:text-slate-600">
                Bantuan
              </button>

              <button className="transition-colors hover:text-slate-600">
                Kebijakan Privasi
              </button>

              <button className="transition-colors hover:text-slate-600">
                Pengaturan
              </button>
            </div>
          </div>
        </footer>
      </motion.main>
    </div>
  );
}