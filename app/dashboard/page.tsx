'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart2,
  BarChart3,
  BellRing,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  FolderOpen,
  Lightbulb,
  LineChart,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WandSparkles,
  Zap,
} from 'lucide-react';

import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from 'framer-motion';

/* =========================================================
   TYPES
========================================================= */

type Tone =
  | 'blue'
  | 'emerald'
  | 'violet'
  | 'orange'
  | 'rose'
  | 'indigo'
  | 'cyan'
  | 'amber'
  | 'sky';

type Stat = {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  href: string;
  tone: Tone;
  trend: string;
};

type QuickAction = {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  label: string;
  tone: Tone;
};

type Feature = {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  tone: Tone;
};

type Activity = {
  title: string;
  description: string;
  time: string;
  icon: React.ElementType;
  tone: Tone;
};

/* =========================================================
   ANIMATION VARIANTS
========================================================= */

const pageVariants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1] as const,
      staggerChildren: 0.06,
    },
  },
};

const sectionVariants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      
    },
  },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.075,
    },
  },
};

/* =========================================================
   COMPONENT
========================================================= */

export default function DashboardPage() {
  const reduceMotion = useReducedMotion();

  /* =======================================================
     DATA
  ======================================================= */

  const stats: Stat[] = [
    {
      title: 'Total TP',
      value: '188',
      description: 'Tujuan Pembelajaran',
      icon: BookOpen,
      href: '/dashboard/my-tp',
      tone: 'blue',
      trend: '+12 bulan ini',
    },
    {
      title: 'Bank Soal',
      value: '51',
      description: 'Total Soal',
      icon: FileText,
      href: '/dashboard/bank-soal',
      tone: 'emerald',
      trend: '+8 soal',
    },
    {
      title: 'Template Ujian',
      value: '7',
      description: 'Template tersedia',
      icon: FileCheck2,
      href: '/dashboard/template-ujian',
      tone: 'violet',
      trend: '2 diperbarui',
    },
    {
      title: 'Nilai Tersimpan',
      value: '38',
      description: 'Total Penilaian',
      icon: BarChart2,
      href: '/dashboard/rekap-nilai',
      tone: 'orange',
      trend: '+5 minggu ini',
    },
  ];

  const quickActions: QuickAction[] = [
    {
      title: 'Generate TP',
      description:
        'Buat Tujuan Pembelajaran dengan bantuan AI.',
      href: '/dashboard/generate-tp',
      icon: Target,
      label: 'Mulai membuat',
      tone: 'blue',
    },
    {
      title: 'Generate Soal AI',
      description:
        'Susun soal berdasarkan Tujuan Pembelajaran.',
      href: '/dashboard/generate-soal',
      icon: BrainCircuit,
      label: 'Buat soal',
      tone: 'violet',
    },
    {
      title: 'Template Ujian',
      description:
        'Buat template ujian siap digunakan dan dicetak.',
      href: '/dashboard/template-ujian',
      icon: FileCheck2,
      label: 'Kelola template',
      tone: 'rose',
    },
  ];

  const features: Feature[] = [
    {
      title: 'Master Data',
      description: 'Kelola kelas dan siswa',
      href: '/dashboard/master-data',
      icon: Users,
      tone: 'blue',
    },
    {
      title: 'Bank Soal',
      description: 'Kelola koleksi soal',
      href: '/dashboard/bank-soal',
      icon: FolderOpen,
      tone: 'emerald',
    },
    {
      title: 'Koreksi Digital',
      description: 'Koreksi jawaban siswa',
      href: '/dashboard/koreksi',
      icon: ClipboardCheck,
      tone: 'rose',
    },
    {
      title: 'Rekap Nilai',
      description: 'Lihat rekapitulasi nilai',
      href: '/dashboard/rekap-nilai',
      icon: BarChart3,
      tone: 'orange',
    },
    {
      title: 'Analisis TP',
      description: 'Analisis ketercapaian TP',
      href: '/dashboard/analisis-tp',
      icon: LineChart,
      tone: 'violet',
    },
    {
      title: 'My TP',
      description: 'Kumpulan TP Anda',
      href: '/dashboard/my-tp',
      icon: BookOpen,
      tone: 'indigo',
    },
    {
      title: 'Jurnal & Absensi',
      description: 'Kelola jurnal pembelajaran',
      href: '/dashboard/jurnal',
      icon: Clock3,
      tone: 'cyan',
    },
    {
      title: 'Riwayat Jurnal',
      description: 'Lihat riwayat jurnal',
      href: '/dashboard/riwayat-jurnal',
      icon: RefreshCw,
      tone: 'amber',
    },
    {
      title: 'Rekap Kehadiran',
      description: 'Rekap kehadiran siswa',
      href: '/dashboard/rekap-kehadiran',
      icon: Users,
      tone: 'sky',
    },
  ];

  const activities: Activity[] = [
    {
      title: 'Generate TP Matematika',
      description: '8 tujuan pembelajaran dibuat',
      time: '10 menit lalu',
      icon: Target,
      tone: 'blue',
    },
    {
      title: 'Bank Soal diperbarui',
      description: '5 soal baru ditambahkan',
      time: '1 jam lalu',
      icon: FileText,
      tone: 'emerald',
    },
    {
      title: 'Rekap nilai diperbarui',
      description:
        'Data penilaian kelas tersimpan',
      time: 'Kemarin',
      icon: BarChart2,
      tone: 'violet',
    },
    {
      title: 'Template Ujian dibuat',
      description:
        'Template Sumatif Bahasa Indonesia',
      time: '2 hari lalu',
      icon: FileCheck2,
      tone: 'orange',
    },
  ];

  /* =======================================================
     TONE SYSTEM
  ======================================================= */

  const getToneClasses = (tone: Tone) => {
    const tones: Record<
      Tone,
      {
        icon: string;
        soft: string;
        hover: string;
        text: string;
        dot: string;
      }
    > = {
      blue: {
        icon: 'bg-blue-600 text-white',
        soft: 'bg-blue-50',
        hover: 'group-hover:bg-blue-100',
        text: 'text-blue-700',
        dot: 'bg-blue-500',
      },
      emerald: {
        icon: 'bg-emerald-500 text-white',
        soft: 'bg-emerald-50',
        hover: 'group-hover:bg-emerald-100',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
      },
      violet: {
        icon: 'bg-violet-600 text-white',
        soft: 'bg-violet-50',
        hover: 'group-hover:bg-violet-100',
        text: 'text-violet-700',
        dot: 'bg-violet-500',
      },
      orange: {
        icon: 'bg-orange-500 text-white',
        soft: 'bg-orange-50',
        hover: 'group-hover:bg-orange-100',
        text: 'text-orange-700',
        dot: 'bg-orange-500',
      },
      rose: {
        icon: 'bg-rose-500 text-white',
        soft: 'bg-rose-50',
        hover: 'group-hover:bg-rose-100',
        text: 'text-rose-700',
        dot: 'bg-rose-500',
      },
      indigo: {
        icon: 'bg-indigo-500 text-white',
        soft: 'bg-indigo-50',
        hover: 'group-hover:bg-indigo-100',
        text: 'text-indigo-700',
        dot: 'bg-indigo-500',
      },
      cyan: {
        icon: 'bg-cyan-500 text-white',
        soft: 'bg-cyan-50',
        hover: 'group-hover:bg-cyan-100',
        text: 'text-cyan-700',
        dot: 'bg-cyan-500',
      },
      amber: {
        icon: 'bg-amber-500 text-white',
        soft: 'bg-amber-50',
        hover: 'group-hover:bg-amber-100',
        text: 'text-amber-700',
        dot: 'bg-amber-500',
      },
      sky: {
        icon: 'bg-sky-500 text-white',
        soft: 'bg-sky-50',
        hover: 'group-hover:bg-sky-100',
        text: 'text-sky-700',
        dot: 'bg-sky-500',
      },
    };

    return tones[tone];
  };

  /* =======================================================
     MOTION HELPERS
  ======================================================= */

  const motionSectionProps = reduceMotion
    ? {
        initial: false,
        whileInView: undefined,
        viewport: undefined,
      }
    : {
        initial: 'hidden',
        whileInView: 'visible',
        viewport: {
          once: true,
          amount: 0.12,
        },
      };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <motion.div
      variants={pageVariants}
      initial={reduceMotion ? false : 'hidden'}
      animate={reduceMotion ? undefined : 'visible'}
      className="space-y-8"
    >

      {/* =====================================================
          HERO
      ===================================================== */}

      <motion.section
        {...motionSectionProps}
        variants={sectionVariants}
        className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
      >

        {/* Background decoration */}
        <motion.div
          animate={
            reduceMotion
              ? undefined
              : {
                  x: [0, 18, 0],
                  y: [0, -12, 0],
                  scale: [1, 1.08, 1],
                }
          }
          transition={
            reduceMotion
              ? undefined
              : {
                  duration: 10,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
          }
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl"
        />

        <motion.div
          animate={
            reduceMotion
              ? undefined
              : {
                  x: [0, -20, 0],
                  y: [0, 10, 0],
                  scale: [1, 1.06, 1],
                }
          }
          transition={
            reduceMotion
              ? undefined
              : {
                  duration: 12,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
          }
          className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-violet-100/50 blur-3xl"
        />

        <div className="relative grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-8 p-6 sm:p-8 lg:p-10">

          {/* LEFT */}
          <div className="flex flex-col justify-between">

            <div>

              <motion.div
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 10,
                      }
                }
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 1,
                        y: 0,
                      }
                }
                transition={{
                  delay: 0.15,
                  duration: 0.45,
                }}
                className="mb-5 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI Teaching Workspace
              </motion.div>

              <motion.h2
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 16,
                      }
                }
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 1,
                        y: 0,
                      }
                }
                transition={{
                  delay: 0.22,
                  duration: 0.55,
                  ease: [0.16, 1, 0.3, 1] as const,
                }}
                className="max-w-3xl text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-950"
              >
                Selamat datang kembali,

                <span className="block bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">
                  Mas Wowo 👋
                </span>
              </motion.h2>

              <motion.p
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 12,
                      }
                }
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 1,
                        y: 0,
                      }
                }
                transition={{
                  delay: 0.3,
                  duration: 0.5,
                }}
                className="mt-4 max-w-2xl text-sm sm:text-base leading-7 text-slate-500"
              >
                Kelola Tujuan Pembelajaran, buat soal,
                analisis nilai, dan selesaikan administrasi
                pembelajaran dari satu tempat.
              </motion.p>
            </div>

            {/* CTA */}
            <motion.div
              initial={
                reduceMotion
                  ? false
                  : {
                      opacity: 0,
                      y: 12,
                    }
              }
              animate={
                reduceMotion
                  ? undefined
                  : {
                      opacity: 1,
                      y: 0,
                    }
              }
              transition={{
                delay: 0.38,
                duration: 0.5,
              }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link
                href="/dashboard/generate-tp"
                className="group"
              >
                <motion.div
                  whileHover={
                    reduceMotion
                      ? undefined
                      : {
                          y: -2,
                          scale: 1.015,
                        }
                  }
                  whileTap={
                    reduceMotion
                      ? undefined
                      : {
                          scale: 0.98,
                        }
                  }
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 22,
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-200"
                >
                  <WandSparkles className="h-4 w-4" />
                  Generate TP

                  <motion.span
                    whileHover={
                      reduceMotion
                        ? undefined
                        : {
                            x: 4,
                          }
                    }
                  >
                    <ArrowRight className="h-4 w-4" />
                  </motion.span>
                </motion.div>
              </Link>

              <Link
                href="/dashboard/generate-soal"
                className="group"
              >
                <motion.div
                  whileHover={
                    reduceMotion
                      ? undefined
                      : {
                          y: -2,
                        }
                  }
                  whileTap={
                    reduceMotion
                      ? undefined
                      : {
                          scale: 0.98,
                        }
                  }
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors duration-200 group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700"
                >
                  <BrainCircuit className="h-4 w-4" />
                  Generate Soal AI
                </motion.div>
              </Link>
            </motion.div>
          </div>

          {/* AI CARD */}
          <motion.div
            initial={
              reduceMotion
                ? false
                : {
                    opacity: 0,
                    x: 30,
                    scale: 0.96,
                  }
            }
            animate={
              reduceMotion
                ? undefined
                : {
                    opacity: 1,
                    x: 0,
                    scale: 1,
                  }
            }
            transition={{
              delay: 0.25,
              duration: 0.7,
              ease: [0.16, 1, 0.3, 1] as const,
            }}
            className="relative"
          >
            <motion.div
              whileHover={
                reduceMotion
                  ? undefined
                  : {
                      y: -4,
                    }
              }
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 24,
              }}
              className="h-full min-h-[280px] rounded-[28px] bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 p-6 text-white shadow-2xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-200">
                    <motion.div
                      animate={
                        reduceMotion
                          ? undefined
                          : {
                              rotate: [0, 5, -5, 0],
                            }
                      }
                      transition={
                        reduceMotion
                          ? undefined
                          : {
                              duration: 3,
                              repeat: Infinity,
                              repeatDelay: 2,
                            }
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 backdrop-blur"
                    >
                      <Sparkles className="h-4 w-4 text-cyan-300" />
                    </motion.div>

                    AI Insight
                  </div>

                  <h3 className="text-xl font-bold">
                    Ada beberapa hal yang bisa Anda
                    selesaikan hari ini.
                  </h3>
                </div>

                <motion.div
                  animate={
                    reduceMotion
                      ? undefined
                      : {
                          y: [0, -5, 0],
                        }
                  }
                  transition={
                    reduceMotion
                      ? undefined
                      : {
                          duration: 2.8,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }
                  }
                  className="rounded-xl bg-white/10 p-2 backdrop-blur"
                >
                  <Lightbulb className="h-5 w-5 text-amber-300" />
                </motion.div>
              </div>

              <div className="mt-6 space-y-3">
                <motion.div
                  whileHover={
                    reduceMotion
                      ? undefined
                      : {
                          x: 4,
                        }
                  }
                  className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"
                >
                  <div className="flex gap-3">
                    <motion.div
                      animate={
                        reduceMotion
                          ? undefined
                          : {
                              scale: [1, 1.3, 1],
                            }
                      }
                      transition={
                        reduceMotion
                          ? undefined
                          : {
                              duration: 2,
                              repeat: Infinity,
                            }
                      }
                      className="mt-0.5 h-2.5 w-2.5 rounded-full bg-cyan-300"
                    />

                    <div>
                      <p className="text-sm font-semibold">
                        Buat soal dari TP yang tersimpan
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-300">
                        12 TP terdeteksi belum memiliki
                        bank soal terkait.
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={
                    reduceMotion
                      ? undefined
                      : {
                          x: 4,
                        }
                  }
                  className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"
                >
                  <div className="flex gap-3">
                    <motion.div
                      animate={
                        reduceMotion
                          ? undefined
                          : {
                              scale: [1, 1.3, 1],
                            }
                      }
                      transition={
                        reduceMotion
                          ? undefined
                          : {
                              duration: 2.4,
                              repeat: Infinity,
                            }
                      }
                      className="mt-0.5 h-2.5 w-2.5 rounded-full bg-violet-300"
                    />

                    <div>
                      <p className="text-sm font-semibold">
                        Periksa perkembangan penilaian
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-300">
                        Ada data penilaian terbaru yang
                        siap dianalisis.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>

              <Link
                href="/dashboard/analisis-tp"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-cyan-200"
              >
                Lihat analisis
                <motion.span
                  whileHover={
                    reduceMotion
                      ? undefined
                      : {
                          x: 4,
                        }
                  }
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.span>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* =====================================================
          KPI
      ===================================================== */}

      <motion.section
        {...motionSectionProps}
        variants={sectionVariants}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
              Ringkasan
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Aktivitas pembelajaran
            </h2>
          </div>

          <motion.button
            whileHover={
              reduceMotion
                ? undefined
                : {
                    y: -1,
                  }
            }
            whileTap={
              reduceMotion
                ? undefined
                : {
                    scale: 0.96,
                  }
            }
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-800"
          >
            <motion.span
              animate={
                reduceMotion
                  ? undefined
                  : {
                      rotate: 360,
                    }
              }
              transition={{
                duration: 0.6,
                ease: 'easeInOut',
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </motion.span>

            Refresh
          </motion.button>
        </div>

        <motion.div
          variants={containerVariants}
          initial={reduceMotion ? false : 'hidden'}
          whileInView={reduceMotion ? undefined : 'visible'}
          viewport={{
            once: true,
            amount: 0.15,
          }}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        >
          {stats.map((stat) => {
            const Icon = stat.icon;
            const tone = getToneClasses(stat.tone);

            return (
              <motion.div
                key={stat.title}
                variants={cardVariants}
              >
                <Link href={stat.href}>
                  <motion.div
                    whileHover={
                      reduceMotion
                        ? undefined
                        : {
                            y: -6,
                            scale: 1.01,
                          }
                    }
                    whileTap={
                      reduceMotion
                        ? undefined
                        : {
                            scale: 0.985,
                          }
                    }
                    transition={{
                      type: 'spring',
                      stiffness: 350,
                      damping: 24,
                    }}
                    className="group relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)] hover:shadow-[0_18px_45px_rgba(15,23,42,0.09)]"
                  >
                    <motion.div
                      animate={
                        reduceMotion
                          ? undefined
                          : {
                              scale: [1, 1.08, 1],
                            }
                      }
                      transition={
                        reduceMotion
                          ? undefined
                          : {
                              duration: 6,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }
                      }
                      className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-slate-50"
                    />

                    <div className="relative">
                      <div className="flex items-start justify-between">
                        <motion.div
                          whileHover={
                            reduceMotion
                              ? undefined
                              : {
                                  rotate: -5,
                                  scale: 1.08,
                                }
                          }
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone.icon} shadow-lg`}
                        >
                          <Icon className="h-5 w-5" />
                        </motion.div>

                        <motion.div
                          whileHover={
                            reduceMotion
                              ? undefined
                              : {
                                  x: 4,
                                }
                          }
                        >
                          <ChevronRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-slate-500" />
                        </motion.div>
                      </div>

                      <div className="mt-8">
                        <p className="text-sm font-semibold text-slate-500">
                          {stat.title}
                        </p>

                        <div className="mt-1 flex items-end justify-between gap-3">
                          <motion.h3
                            initial={
                              reduceMotion
                                ? false
                                : {
                                    opacity: 0,
                                    y: 6,
                                  }
                            }
                            whileInView={
                              reduceMotion
                                ? undefined
                                : {
                                    opacity: 1,
                                    y: 0,
                                  }
                            }
                            viewport={{
                              once: true,
                            }}
                            transition={{
                              duration: 0.4,
                            }}
                            className="text-4xl font-black tracking-tight text-slate-950"
                          >
                            {stat.value}
                          </motion.h3>

                          <span
                            className={`rounded-full ${tone.soft} px-2.5 py-1 text-[10px] font-bold ${tone.text}`}
                          >
                            {stat.trend}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-400">
                          {stat.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.section>

      {/* =====================================================
          BENTO MAIN
      ===================================================== */}

      <motion.section
        {...motionSectionProps}
        variants={sectionVariants}
        className="grid grid-cols-1 xl:grid-cols-12 gap-5"
      >

        {/* QUICK CREATE */}
        <motion.div
          variants={cardVariants}
          whileHover={
            reduceMotion
              ? undefined
              : {
                  y: -3,
                }
          }
          className="xl:col-span-7 rounded-[30px] border border-slate-200/80 bg-white p-6 sm:p-7 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Quick Create
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Mulai pekerjaan baru
              </h2>
            </div>

            <motion.div
              animate={
                reduceMotion
                  ? undefined
                  : {
                      rotate: [0, 90, 0],
                    }
              }
              transition={{
                duration: 4,
                repeat: Infinity,
                repeatDelay: 3,
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"
            >
              <Plus className="h-5 w-5" />
            </motion.div>
          </div>

          <motion.div
            variants={containerVariants}
            className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {quickActions.map((action) => {
              const Icon = action.icon;
              const tone = getToneClasses(action.tone);

              return (
                <motion.div
                  key={action.title}
                  variants={cardVariants}
                >
                  <Link href={action.href}>
                    <motion.div
                      whileHover={
                        reduceMotion
                          ? undefined
                          : {
                              y: -5,
                              scale: 1.015,
                            }
                      }
                      whileTap={
                        reduceMotion
                          ? undefined
                          : {
                              scale: 0.98,
                            }
                      }
                      transition={{
                        type: 'spring',
                        stiffness: 350,
                        damping: 22,
                      }}
                      className={`group rounded-[24px] border border-slate-200 p-4 ${tone.soft}`}
                    >
                      <motion.div
                        whileHover={
                          reduceMotion
                            ? undefined
                            : {
                                rotate: 6,
                                scale: 1.08,
                              }
                        }
                        className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl ${tone.icon} shadow-md`}
                      >
                        <Icon className="h-5 w-5" />
                      </motion.div>

                      <h3 className="text-sm font-bold text-slate-900">
                        {action.title}
                      </h3>

                      <p className="mt-2 min-h-[58px] text-xs leading-5 text-slate-500">
                        {action.description}
                      </p>

                      <div
                        className={`mt-4 flex items-center gap-1 text-xs font-bold ${tone.text}`}
                      >
                        {action.label}

                        <motion.span
                          whileHover={
                            reduceMotion
                              ? undefined
                              : {
                                  x: 4,
                                }
                          }
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </motion.span>
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        {/* PROGRESS */}
        <motion.div
          variants={cardVariants}
          whileHover={
            reduceMotion
              ? undefined
              : {
                  y: -3,
                }
          }
          className="xl:col-span-5 rounded-[30px] border border-slate-200/80 bg-white p-6 sm:p-7 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Progress
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Target semester
              </h2>
            </div>

            <motion.div
              animate={
                reduceMotion
                  ? undefined
                  : {
                      y: [0, -4, 0],
                    }
              }
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600"
            >
              <TrendingUp className="h-5 w-5" />
            </motion.div>
          </div>

          <div className="mt-7 flex items-center gap-6">
            <div className="relative h-32 w-32 shrink-0">
              <svg
                viewBox="0 0 120 120"
                className="h-full w-full -rotate-90"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-slate-100"
                />

                <motion.circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray="301.59"
                  className="text-blue-600"
                  initial={{
                    strokeDashoffset: 301.59,
                  }}
                  whileInView={{
                    strokeDashoffset: reduceMotion
                      ? 66.35
                      : 66.35,
                  }}
                  viewport={{
                    once: true,
                  }}
                  transition={{
                    duration: 1.2,
                    delay: 0.15,
                    ease: [0.16, 1, 0.3, 1] as const,
                  }}
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  initial={
                    reduceMotion
                      ? false
                      : {
                          opacity: 0,
                          scale: 0.7,
                        }
                  }
                  whileInView={
                    reduceMotion
                      ? undefined
                      : {
                          opacity: 1,
                          scale: 1,
                        }
                  }
                  viewport={{
                    once: true,
                  }}
                  transition={{
                    delay: 0.6,
                    duration: 0.45,
                  }}
                  className="text-2xl font-black text-slate-950"
                >
                  78%
                </motion.span>

                <span className="text-[10px] font-semibold text-slate-400">
                  selesai
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700">
                Target pembelajaran
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                Sebagian besar target semester sudah tercapai.
              </p>

              <motion.div
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                        x: -8,
                      }
                }
                whileInView={
                  reduceMotion
                    ? undefined
                    : {
                        opacity: 1,
                        x: 0,
                      }
                }
                viewport={{
                  once: true,
                }}
                transition={{
                  delay: 0.8,
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                On Track
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* ACTIVITY */}
        <motion.div
          variants={cardVariants}
          whileHover={
            reduceMotion
              ? undefined
              : {
                  y: -3,
                }
          }
          className="xl:col-span-7 rounded-[30px] border border-slate-200/80 bg-white p-6 sm:p-7 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Activity
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Aktivitas terbaru
              </h2>
            </div>

            <Link
              href="/dashboard"
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              Lihat semua
            </Link>
          </div>

          <motion.div
            variants={containerVariants}
            className="mt-6 space-y-2"
          >
            {activities.map((activity) => {
              const Icon = activity.icon;
              const tone = getToneClasses(
                activity.tone
              );

              return (
                <motion.div
                  key={activity.title}
                  variants={cardVariants}
                  whileHover={
                    reduceMotion
                      ? undefined
                      : {
                          x: 4,
                          backgroundColor:
                            'rgba(248,250,252,0.9)',
                        }
                  }
                  className="group flex items-center gap-4 rounded-2xl p-3"
                >
                  <motion.div
                    whileHover={
                      reduceMotion
                        ? undefined
                        : {
                            scale: 1.08,
                            rotate: -4,
                          }
                    }
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.soft} ${tone.text}`}
                  >
                    <Icon className="h-5 w-5" />
                  </motion.div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">
                      {activity.title}
                    </p>

                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {activity.description}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden sm:block text-[11px] font-medium text-slate-400">
                      {activity.time}
                    </span>

                    <motion.div
                      whileHover={
                        reduceMotion
                          ? undefined
                          : {
                              x: 4,
                            }
                      }
                    >
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        {/* SMART REMINDER */}
        <motion.div
          variants={cardVariants}
          whileHover={
            reduceMotion
              ? undefined
              : {
                  y: -3,
                }
          }
          className="xl:col-span-5 overflow-hidden rounded-[30px] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-6 sm:p-7 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-violet-700 shadow-sm">
                <BellRing className="h-3.5 w-3.5" />
                Smart Reminder
              </div>

              <h2 className="mt-4 text-xl font-bold text-slate-900">
                Jangan lewatkan pekerjaan penting
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Beberapa aktivitas berikut bisa Anda
                selesaikan lebih dulu.
              </p>
            </div>

            <motion.div
              animate={
                reduceMotion
                  ? undefined
                  : {
                      rotate: [0, 8, -8, 0],
                    }
              }
              transition={{
                duration: 4,
                repeat: Infinity,
                repeatDelay: 2,
              }}
              className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200"
            >
              <Zap className="h-5 w-5" />
            </motion.div>
          </div>

          <div className="mt-6 space-y-3">

            <motion.div
              whileHover={
                reduceMotion
                  ? undefined
                  : {
                      x: 4,
                    }
              }
              className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white/80 p-3.5"
            >
              <motion.div
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
                }}
                className="h-2.5 w-2.5 rounded-full bg-violet-500"
              />

              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">
                  12 TP belum memiliki soal
                </p>

                <p className="mt-0.5 text-xs text-slate-400">
                  Gunakan Generate Soal AI
                </p>
              </div>

              <Link
                href="/dashboard/generate-soal"
                className="rounded-xl bg-violet-50 p-2 text-violet-600 hover:bg-violet-100"
              >
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

            <motion.div
              whileHover={
                reduceMotion
                  ? undefined
                  : {
                      x: 4,
                    }
              }
              className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white/80 p-3.5"
            >
              <motion.div
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        scale: [1, 1.25, 1],
                      }
                }
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                }}
                className="h-2.5 w-2.5 rounded-full bg-blue-500"
              />

              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">
                  Data nilai siap dianalisis
                </p>

                <p className="mt-0.5 text-xs text-slate-400">
                  Lihat perkembangan siswa
                </p>
              </div>

              <Link
                href="/dashboard/analisis-nilai"
                className="rounded-xl bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
              >
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

          </div>
        </motion.div>
      </motion.section>

      {/* =====================================================
          ALL FEATURES
      ===================================================== */}

      <motion.section
        {...motionSectionProps}
        variants={sectionVariants}
      >
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
              Workspace
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Semua fitur
            </h2>
          </div>

          <span className="text-xs text-slate-400">
            {features.length} fitur tersedia
          </span>
        </div>

        <motion.div
          variants={containerVariants}
          initial={reduceMotion ? false : 'hidden'}
          whileInView={reduceMotion ? undefined : 'visible'}
          viewport={{
            once: true,
            amount: 0.1,
          }}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const tone = getToneClasses(
              feature.tone
            );

            const featured =
              index === 0 || index === 3;

            return (
              <motion.div
                key={feature.title}
                variants={cardVariants}
              >
                <Link href={feature.href}>
                  <motion.div
                    whileHover={
                      reduceMotion
                        ? undefined
                        : {
                            y: -5,
                            scale: 1.01,
                          }
                    }
                    whileTap={
                      reduceMotion
                        ? undefined
                        : {
                            scale: 0.985,
                          }
                    }
                    transition={{
                      type: 'spring',
                      stiffness: 350,
                      damping: 23,
                    }}
                    className={`
                      group
                      relative
                      overflow-hidden
                      rounded-[26px]
                      border
                      border-slate-200/80
                      bg-white
                      p-5
                      shadow-[0_6px_24px_rgba(15,23,42,0.035)]
                      hover:shadow-[0_16px_38px_rgba(15,23,42,0.08)]
                      ${
                        featured
                          ? 'sm:min-h-[150px]'
                          : 'min-h-[135px]'
                      }
                    `}
                  >
                    <motion.div
                      animate={
                        reduceMotion
                          ? undefined
                          : {
                              scale: [1, 1.05, 1],
                            }
                      }
                      transition={
                        reduceMotion
                          ? undefined
                          : {
                              duration: 7,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }
                      }
                      className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-50"
                    />

                    <div className="relative flex h-full flex-col justify-between">

                      <div className="flex items-start justify-between">
                        <motion.div
                          whileHover={
                            reduceMotion
                              ? undefined
                              : {
                                  rotate: 6,
                                  scale: 1.08,
                                }
                          }
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone.soft} ${tone.text}`}
                        >
                          <Icon className="h-5 w-5" />
                        </motion.div>

                        <motion.div
                          whileHover={
                            reduceMotion
                              ? undefined
                              : {
                                  x: 4,
                                }
                          }
                        >
                          <ChevronRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-slate-500" />
                        </motion.div>
                      </div>

                      <div className="mt-5">
                        <h3 className="text-sm font-bold text-slate-900">
                          {feature.title}
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.section>

      {/* =====================================================
          BOTTOM CTA
      ===================================================== */}

      <motion.section
        {...motionSectionProps}
        variants={sectionVariants}
        className="overflow-hidden rounded-[30px] bg-slate-950 shadow-[0_16px_50px_rgba(15,23,42,0.12)]"
      >
        <div className="relative p-6 sm:p-8">

          <motion.div
            animate={
              reduceMotion
                ? undefined
                : {
                    x: [0, 20, 0],
                    y: [0, -10, 0],
                  }
            }
            transition={
              reduceMotion
                ? undefined
                : {
                    duration: 10,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
            }
            className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl"
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
                    duration: 12,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
            }
            className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl"
          />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                EdTech AI Workspace
              </div>

              <h2 className="mt-2 max-w-2xl text-2xl font-black text-white">
                Kurangi pekerjaan administratif,
                fokus pada pembelajaran.
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Gunakan fitur AI untuk membantu menyusun TP,
                membuat soal, dan membaca data pembelajaran Anda.
              </p>
            </div>

            <Link
              href="/dashboard/generate-tp"
              className="group inline-flex shrink-0"
            >
              <motion.div
                whileHover={
                  reduceMotion
                    ? undefined
                    : {
                        y: -3,
                        scale: 1.02,
                      }
                }
                whileTap={
                  reduceMotion
                    ? undefined
                    : {
                        scale: 0.97,
                      }
                }
                transition={{
                  type: 'spring',
                  stiffness: 380,
                  damping: 22,
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-bold text-slate-950 shadow-lg"
              >
                <WandSparkles className="h-4 w-4" />

                Mulai dengan AI

                <motion.span
                  whileHover={
                    reduceMotion
                      ? undefined
                      : {
                          x: 4,
                        }
                  }
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.span>
              </motion.div>
            </Link>

          </div>
        </div>
      </motion.section>

      {/* =====================================================
          FLOATING STATUS
      ===================================================== */}

      <AnimatePresence>
        {!reduceMotion && (
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 1.2,
              duration: 0.5,
            }}
            className="pointer-events-none fixed bottom-6 right-6 hidden lg:block"
          >
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-[10px] font-semibold text-slate-500 shadow-lg backdrop-blur-xl">
              <motion.span
                animate={{
                  scale: [1, 1.25, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
                className="h-2 w-2 rounded-full bg-emerald-500"
              />

              Semua sistem berjalan normal
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}