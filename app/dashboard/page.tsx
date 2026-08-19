'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart2,
  BarChart3,
  BellRing,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  CalendarCheck,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  FolderOpen,
  Lightbulb,
  LineChart,
  PenLine,
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
  useReducedMotion,
} from 'framer-motion';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

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
  href: string;
  icon: React.ElementType;
  tone: Tone;
};

type TodayState = {
  attendanceDone: boolean;
  attendanceCount: number;
  journalDone: boolean;
  journalCount: number;
  loading: boolean;
  error: boolean;
};

const getLocalDateKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
   COMPONENT — V2.3
   Vertical rhythm: 24px between major dashboard sections.
========================================================= */

export default function DashboardPage() {
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();

  const [todayState, setTodayState] = useState<TodayState>({
    attendanceDone: false,
    attendanceCount: 0,
    journalDone: false,
    journalCount: 0,
    loading: true,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;

    const loadTodayState = async () => {
      if (!user) {
        if (!cancelled) setTodayState((prev) => ({ ...prev, loading: false }));
        return;
      }

      try {
        const today = getLocalDateKey();
        const [attendanceSnapshot, journalSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'absensi'), where('user_id', '==', user.uid))),
          getDocs(query(collection(db, 'jurnal_mengajar'), where('user_id', '==', user.uid))),
        ]);

        let attendanceCount = 0;
        attendanceSnapshot.forEach((docSnap) => {
          if (String(docSnap.data().tanggal ?? '') === today) attendanceCount += 1;
        });

        let journalCount = 0;
        journalSnapshot.forEach((docSnap) => {
          if (String(docSnap.data().tanggal ?? '') === today) journalCount += 1;
        });

        if (!cancelled) {
          setTodayState({
            attendanceDone: attendanceCount > 0,
            attendanceCount,
            journalDone: journalCount > 0,
            journalCount,
            loading: false,
            error: false,
          });
        }
      } catch (error) {
        console.error('Gagal memuat status dashboard hari ini:', error);
        if (!cancelled) setTodayState((prev) => ({ ...prev, loading: false, error: true }));
      }
    };

    loadTodayState();
    return () => { cancelled = true; };
  }, [user]);

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
      title: 'Jurnal Mengajar',
      description: 'Catat kegiatan pembelajaran',
      href: '/dashboard/jurnal',
      icon: Clock3,
      tone: 'cyan',
    },
    {
      title: 'Absensi Siswa',
      description: 'Catat kehadiran harian siswa',
      href: '/dashboard/absensi',
      icon: CalendarCheck,
      tone: 'emerald',
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
      href: '/dashboard/generate-tp',
      icon: Target,
      tone: 'blue',
    },
    {
      title: 'Bank Soal diperbarui',
      description: '5 soal baru ditambahkan',
      time: '1 jam lalu',
      href: '/dashboard/bank-soal',
      icon: FileText,
      tone: 'emerald',
    },
    {
      title: 'Rekap nilai diperbarui',
      description:
        'Data penilaian kelas tersimpan',
      time: 'Kemarin',
      href: '/dashboard/rekap-nilai',
      icon: BarChart2,
      tone: 'violet',
    },
    {
      title: 'Template Ujian dibuat',
      description:
        'Template Sumatif Bahasa Indonesia',
      time: '2 hari lalu',
      href: '/dashboard/template-ujian',
      icon: FileCheck2,
      tone: 'orange',
    },
  ];

  /* =======================================================
     TONE SYSTEM
  ======================================================= */

  const tones: Record<
    Tone,
    {
      icon: string;
      soft: string;
      hover: string;
      text: string;
      dot: string;
      border: string;
      blob: string;
    }
  > = {
    blue: {
      icon: 'bg-blue-600 text-white',
      soft: 'bg-blue-50',
      hover: 'group-hover:bg-blue-100',
      text: 'text-blue-700',
      dot: 'bg-blue-500',
      border: 'border-blue-100',
      blob: 'bg-blue-100/70',
    },
    emerald: {
      icon: 'bg-emerald-500 text-white',
      soft: 'bg-emerald-50',
      hover: 'group-hover:bg-emerald-100',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
      border: 'border-emerald-100',
      blob: 'bg-emerald-100/70',
    },
    violet: {
      icon: 'bg-violet-600 text-white',
      soft: 'bg-violet-50',
      hover: 'group-hover:bg-violet-100',
      text: 'text-violet-700',
      dot: 'bg-violet-500',
      border: 'border-violet-100',
      blob: 'bg-violet-100/70',
    },
    orange: {
      icon: 'bg-orange-500 text-white',
      soft: 'bg-orange-50',
      hover: 'group-hover:bg-orange-100',
      text: 'text-orange-700',
      dot: 'bg-orange-500',
      border: 'border-orange-100',
      blob: 'bg-orange-100/70',
    },
    rose: {
      icon: 'bg-rose-500 text-white',
      soft: 'bg-rose-50',
      hover: 'group-hover:bg-rose-100',
      text: 'text-rose-700',
      dot: 'bg-rose-500',
      border: 'border-rose-100',
      blob: 'bg-rose-100/70',
    },
    indigo: {
      icon: 'bg-indigo-500 text-white',
      soft: 'bg-indigo-50',
      hover: 'group-hover:bg-indigo-100',
      text: 'text-indigo-700',
      dot: 'bg-indigo-500',
      border: 'border-indigo-100',
      blob: 'bg-indigo-100/70',
    },
    cyan: {
      icon: 'bg-cyan-500 text-white',
      soft: 'bg-cyan-50',
      hover: 'group-hover:bg-cyan-100',
      text: 'text-cyan-700',
      dot: 'bg-cyan-500',
      border: 'border-cyan-100',
      blob: 'bg-cyan-100/70',
    },
    amber: {
      icon: 'bg-amber-500 text-white',
      soft: 'bg-amber-50',
      hover: 'group-hover:bg-amber-100',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
      border: 'border-amber-100',
      blob: 'bg-amber-100/70',
    },
    sky: {
      icon: 'bg-sky-500 text-white',
      soft: 'bg-sky-50',
      hover: 'group-hover:bg-sky-100',
      text: 'text-sky-700',
      dot: 'bg-sky-500',
      border: 'border-sky-100',
      blob: 'bg-sky-100/70',
    },
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
      className="relative min-h-full w-full min-w-0 overflow-hidden bg-[#f5f7fc] pb-12 pt-6 sm:pt-8 lg:pt-10"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={reduceMotion ? undefined : { opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* =====================================================
          V2 BACKGROUND
      ===================================================== */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-blue-200/20 blur-3xl" />
        <div className="absolute right-[-12rem] top-24 h-[30rem] w-[30rem] rounded-full bg-violet-200/18 blur-3xl" />
        <div className="absolute left-[34%] top-[48rem] h-72 w-72 rounded-full bg-cyan-200/15 blur-3xl" />
        <div className="absolute left-[18%] top-[86rem] h-64 w-64 rounded-full bg-amber-100/18 blur-3xl" />
        <div
          className="absolute inset-x-0 top-0 h-[680px] opacity-[0.22]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.22) 1px, transparent 0)',
            backgroundSize: '26px 26px',
            maskImage: 'linear-gradient(to bottom, black, transparent)',
          }}
        />
      </div>

      <div className="relative space-y-6">
          {/* =====================================================
              HERO / COMMAND CENTER
          ===================================================== */}
        <motion.section
          variants={sectionVariants}
          initial={reduceMotion ? false : 'hidden'}
          animate="visible"
          className="relative overflow-hidden rounded-[38px] border border-white/90 bg-gradient-to-br from-[#edf4ff] via-white to-[#f2efff] shadow-[0_26px_72px_rgba(37,99,235,0.085)]"
        >
          <div className="absolute -right-20 -top-28 h-80 w-80 rounded-[42%] bg-indigo-300/20 blur-2xl" />
          <div className="absolute -bottom-36 left-[35%] h-96 w-96 rounded-[46%] bg-violet-300/12 blur-3xl" />
          <div className="absolute right-[45%] top-10 h-3 w-3 rounded-full bg-cyan-400/70 shadow-[0_0_0_8px_rgba(34,211,238,0.08)]" />
          <div className="absolute right-[41%] top-20 h-2 w-2 rounded-full bg-indigo-400/60" />

          <div className="pointer-events-none absolute left-[45%] top-24 hidden rotate-[-10deg] text-indigo-300/[0.07] lg:block">
            <BookOpen className="h-28 w-28" strokeWidth={1.15} />
          </div>
          <div className="pointer-events-none absolute bottom-10 left-[56%] hidden rotate-[8deg] text-violet-400/[0.055] lg:block">
            <PenLine className="h-24 w-24" strokeWidth={1.1} />
          </div>
          <div className="pointer-events-none absolute right-[37%] bottom-8 hidden text-cyan-400/[0.07] lg:block">
            <Sparkles className="h-16 w-16" strokeWidth={1.2} />
          </div>

          <div className="relative grid gap-6 p-5 sm:gap-7 sm:p-9 lg:grid-cols-[1fr_430px] lg:p-10">
            <div className="flex min-h-0 flex-col justify-between sm:min-h-[360px]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/85 px-3.5 py-2 text-[11px] font-black tracking-wide text-indigo-700 shadow-sm backdrop-blur">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  AI TEACHING WORKSPACE
                </div>

                <h1 className="mt-5 max-w-4xl text-[clamp(2.25rem,10vw,3.1rem)] sm:mt-6 sm:text-[clamp(2.7rem,5.3vw,5rem)] font-black leading-[0.93] tracking-[-0.055em] text-slate-950">
                  Selamat datang kembali,
                  <span className="mt-2 block bg-gradient-to-r from-[#315ef6] via-[#5b4af5] to-[#7047df] bg-clip-text text-transparent">
                    Mas Wowo <span className="inline-block">👋</span>
                  </span>
                </h1>

                <p className="mt-5 max-w-2xl text-sm font-medium leading-6 text-slate-500 sm:mt-6 sm:leading-7 sm:text-base">
                  Kelola Tujuan Pembelajaran, buat soal, analisis nilai,
                  dan selesaikan administrasi pembelajaran dari satu tempat.
                </p>

                <div className="mt-5 flex flex-wrap gap-2 sm:mt-7 sm:gap-2.5">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs font-bold text-slate-600 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Workspace aktif
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-xs font-bold text-slate-600 shadow-sm">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    AI siap membantu
                  </span>
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold shadow-sm ${todayState.attendanceDone ? 'bg-emerald-50 text-emerald-700' : 'bg-white/80 text-slate-600'}`}>
                    {todayState.attendanceDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CalendarCheck className="h-3.5 w-3.5 text-cyan-600" />}
                    {todayState.loading ? 'Memeriksa absensi…' : todayState.attendanceDone ? 'Absensi hari ini selesai' : 'Absensi hari ini belum dicatat'}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
                <Link href="/dashboard/generate-tp">
                  <motion.div
                    whileHover={reduceMotion ? undefined : { y: -3, scale: 1.015 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]"
                  >
                    <WandSparkles className="h-4 w-4" />
                    Generate TP
                    <ArrowRight className="h-4 w-4" />
                  </motion.div>
                </Link>

                <Link href="/dashboard/generate-soal">
                  <motion.div
                    whileHover={reduceMotion ? undefined : { y: -3 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white bg-white/90 px-5 py-3.5 text-sm font-black text-slate-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    <BrainCircuit className="h-4 w-4" />
                    Generate Soal AI
                  </motion.div>
                </Link>
              </div>
            </div>

            {/* AI Insight */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: 28, scale: 0.97 }}
              animate={reduceMotion ? undefined : { opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.18, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex items-center"
            >
              <div className="relative w-full overflow-hidden rounded-[28px] bg-gradient-to-br from-[#101735] via-[#202653] to-[#3d277e] p-5 text-white sm:rounded-[32px] sm:p-6 shadow-[0_24px_55px_rgba(49,46,129,0.25)]">
                <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-violet-400/12 blur-2xl" />
                <div className="absolute -bottom-20 left-8 h-40 w-40 rounded-full bg-cyan-400/10 blur-2xl" />

                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-black text-indigo-100">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                        <Sparkles className="h-4 w-4 text-cyan-300" />
                      </span>
                      AI Insight
                    </div>
                    <span className="rounded-2xl bg-amber-300/15 p-2.5">
                      <Lightbulb className="h-5 w-5 text-amber-300" />
                    </span>
                  </div>

                  <h2 className="mt-5 text-2xl font-black leading-tight">
                    Ada beberapa hal yang bisa Anda selesaikan hari ini.
                  </h2>

                  <div className="mt-6 space-y-3">
                    <Link
                      href="/dashboard/generate-soal"
                      className="group block rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur transition hover:bg-white/[0.15]"
                    >
                      <div className="flex gap-3">
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_0_5px_rgba(103,232,249,0.08)]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black">
                            Buat soal dari TP yang tersimpan
                          </p>
                          <p className="mt-1 text-xs leading-5 text-indigo-100/65">
                            12 TP terdeteksi belum memiliki bank soal terkait.
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-indigo-200 transition group-hover:translate-x-1" />
                      </div>
                    </Link>

                    <Link
                      href="/dashboard/analisis-nilai"
                      className="group block rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur transition hover:bg-white/[0.15]"
                    >
                      <div className="flex gap-3">
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-violet-300 shadow-[0_0_0_5px_rgba(196,181,253,0.08)]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black">
                            Periksa perkembangan penilaian
                          </p>
                          <p className="mt-1 text-xs leading-5 text-indigo-100/65">
                            Ada data penilaian terbaru yang siap dianalisis.
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-indigo-200 transition group-hover:translate-x-1" />
                      </div>
                    </Link>
                  </div>

                  <Link
                    href="/dashboard/analisis-tp"
                    className="mt-5 inline-flex items-center gap-2 text-sm font-black text-white hover:text-cyan-200"
                  >
                    Lihat analisis
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* =====================================================
            KPI COMMAND STRIP
        ===================================================== */}
        <motion.section
          variants={sectionVariants}
          initial={reduceMotion ? false : 'hidden'}
          whileInView={reduceMotion ? undefined : 'visible'}
          viewport={{ once: true, amount: 0.08 }}
        >
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500">
                Ringkasan
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                Aktivitas pembelajaran
              </h2>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-indigo-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              const tone = tones[stat.tone];

              return (
                <Link key={stat.title} href={stat.href} className="group">
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.12 }}
                    transition={{
                      delay: index * 0.06,
                      duration: 0.45,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    whileHover={reduceMotion ? undefined : { y: -7 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                    className="relative min-h-[215px] overflow-hidden rounded-[30px] border border-white/90 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.045)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(37,99,235,0.11)]"
                  >
                    <div
                      className={`absolute -right-10 -top-10 h-36 w-36 rounded-[45%] ${tone.soft} opacity-80`}
                    />
                    <div className="absolute right-5 top-5 h-2 w-2 rounded-full bg-white" />

                    <div className="relative flex items-start justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone.icon} shadow-lg`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-300 transition group-hover:bg-indigo-50 group-hover:text-indigo-500">
                        <ArrowRight className="h-4 w-4 -rotate-45 transition group-hover:rotate-0" />
                      </span>
                    </div>

                    <div className="relative mt-8">
                      <p className="text-sm font-bold text-slate-500">{stat.title}</p>
                      <div className="mt-1 flex items-end justify-between gap-2">
                        <p className="text-4xl font-black tracking-tight text-slate-950">
                          {stat.value}
                        </p>
                        <span className={`rounded-full ${tone.soft} px-2.5 py-1 text-[10px] font-black ${tone.text}`}>
                          {stat.trend}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-medium text-slate-400">
                        {stat.description}
                      </p>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </motion.section>

        {/* =====================================================
            TODAY / QUICK ACTIONS
        ===================================================== */}
        <motion.section
          variants={sectionVariants}
          initial={reduceMotion ? false : 'hidden'}
          whileInView={reduceMotion ? undefined : 'visible'}
          viewport={{ once: true, amount: 0.06 }}
          className="grid gap-5 xl:grid-cols-12"
        >
          {/* Quick Create */}
          <div className="relative overflow-hidden rounded-[28px] border border-white/90 bg-white/95 p-5 shadow-[0_14px_38px_rgba(15,23,42,0.05)] sm:rounded-[32px] sm:p-7 xl:col-span-7">
            <div className="absolute -right-20 -top-20 h-52 w-52 rounded-[45%] bg-indigo-100/55" />
            <div className="absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-cyan-100/35 blur-2xl" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500">
                  Quick Create
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  Mulai pekerjaan baru
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Pilih aktivitas yang ingin Anda kerjakan.
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Plus className="h-5 w-5" />
              </span>
            </div>

            <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: 'Generate TP',
                  desc: 'Buat tujuan pembelajaran dengan AI',
                  href: '/dashboard/generate-tp',
                  icon: Target,
                  tone: 'indigo' as Tone,
                },
                {
                  title: 'Generate Soal',
                  desc: 'Susun soal berdasarkan TP',
                  href: '/dashboard/generate-soal',
                  icon: BrainCircuit,
                  tone: 'violet' as Tone,
                },
                {
                  title: 'Absensi Hari Ini',
                  desc: 'Catat kehadiran siswa',
                  href: '/dashboard/absensi',
                  icon: CalendarCheck,
                  tone: 'cyan' as Tone,
                },
              ].map((item, index) => {
                const Icon = item.icon;
                const tone = tones[item.tone];

                return (
                  <Link key={item.title} href={item.href}>
                    <motion.div
                      whileHover={reduceMotion ? undefined : { y: -5 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                      className={`relative h-full overflow-hidden rounded-[24px] border ${tone.border} ${tone.soft} p-4 transition-shadow hover:shadow-lg`}
                    >
                      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full ${tone.blob}`} />
                      <div className={`relative flex h-11 w-11 items-center justify-center rounded-2xl ${tone.icon} shadow-md`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="relative mt-5 text-sm font-black text-slate-900">
                        {item.title}
                      </h3>
                      <p className="relative mt-1.5 min-h-[40px] text-xs leading-5 text-slate-500">
                        {item.desc}
                      </p>
                      <span className={`relative mt-4 inline-flex items-center gap-1 text-xs font-black ${tone.text}`}>
                        Mulai
                        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                      </span>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Today */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0f1738] via-[#20285b] to-[#3d247e] p-5 text-white shadow-[0_20px_50px_rgba(30,41,100,0.20)] sm:rounded-[32px] sm:p-7 xl:col-span-5">
            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-400/10 blur-2xl" />
            <div className="absolute -bottom-20 left-10 h-44 w-44 rounded-full bg-fuchsia-400/10 blur-2xl" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">
                    Hari ini
                  </p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Apa yang perlu dikerjakan?
                  </h2>
                </div>
                <div className="rounded-2xl bg-white/10 p-2.5">
                  <Zap className="h-5 w-5 text-amber-300" />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Link href="/dashboard/absensi" className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3.5 backdrop-blur transition hover:bg-white/[0.15]">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${todayState.attendanceDone ? 'bg-emerald-400/15 text-emerald-300' : 'bg-cyan-400/15 text-cyan-300'}`}>
                    {todayState.attendanceDone ? <CheckCircle2 className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black">Absensi siswa</p>
                      {!todayState.loading && <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${todayState.attendanceDone ? 'bg-emerald-300/15 text-emerald-200' : 'bg-amber-300/15 text-amber-200'}`}>{todayState.attendanceDone ? 'SELESAI' : 'PERLU'}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-indigo-100/60">
                      {todayState.loading ? 'Memeriksa data hari ini…' : todayState.attendanceDone ? `${todayState.attendanceCount} catatan absensi hari ini` : 'Catat kehadiran siswa satu kali hari ini'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-indigo-200 transition group-hover:translate-x-1" />
                </Link>

                <Link href="/dashboard/jurnal" className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3.5 backdrop-blur transition hover:bg-white/[0.15]">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${todayState.journalDone ? 'bg-emerald-400/15 text-emerald-300' : 'bg-violet-400/15 text-violet-300'}`}>
                    {todayState.journalDone ? <CheckCircle2 className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black">Jurnal mengajar</p>
                      {!todayState.loading && <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${todayState.journalDone ? 'bg-emerald-300/15 text-emerald-200' : 'bg-amber-300/15 text-amber-200'}`}>{todayState.journalDone ? 'SELESAI' : 'PERLU'}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-indigo-100/60">
                      {todayState.loading ? 'Memeriksa data hari ini…' : todayState.journalDone ? `${todayState.journalCount} jurnal dibuat hari ini` : 'Catat kegiatan pembelajaran hari ini'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-indigo-200 transition group-hover:translate-x-1" />
                </Link>

                <Link href="/dashboard/analisis-nilai" className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3.5 backdrop-blur transition hover:bg-white/[0.15]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300"><TrendingUp className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">Analisis nilai</p>
                    <p className="mt-0.5 text-xs text-indigo-100/60">Periksa data penilaian terbaru</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-indigo-200 transition group-hover:translate-x-1" />
                </Link>

                {todayState.error && <p className="px-1 text-[10px] font-semibold text-amber-200/80">Status administrasi belum dapat diperiksa. Anda tetap dapat membuka menu di atas.</p>}
              </div>
            </div>
          </div>
        </motion.section>

        {/* =====================================================
            PROGRESS + ACTIVITY
        ===================================================== */}
        <motion.section
          variants={sectionVariants}
          initial={reduceMotion ? false : 'hidden'}
          whileInView={reduceMotion ? undefined : 'visible'}
          viewport={{ once: true, amount: 0.06 }}
          className="grid gap-5 xl:grid-cols-12"
        >
          {/* Progress */}
          <div className="relative overflow-hidden rounded-[32px] border border-white/90 bg-gradient-to-br from-white to-emerald-50/55 p-6 shadow-[0_12px_35px_rgba(15,23,42,0.055)] sm:p-7 xl:col-span-5">
            <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-emerald-100/55" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">
                  Progress
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  Target semester
                </h2>
              </div>
              <span className="rounded-2xl bg-emerald-100 p-2.5 text-emerald-700">
                <TrendingUp className="h-5 w-5" />
              </span>
            </div>

            <div className="relative mt-7 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
              <div className="relative h-32 w-32 shrink-0">
                <svg viewBox="0 0 120 120" className="-rotate-90">
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    className="text-emerald-100"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="301.59"
                    strokeDashoffset="66.35"
                    className="text-emerald-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-slate-950">78%</span>
                  <span className="text-[10px] font-bold text-slate-400">
                    selesai
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm font-black text-slate-800">On Track</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Sebagian besar target semester sudah tercapai.
                </p>
                <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  78% selesai
                </span>

                <div className="mt-5 space-y-2">
                  {[['Tujuan Pembelajaran', '82%'], ['Penilaian', '68%'], ['Administrasi', '91%']].map(([label, value]) => (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-slate-400"><span>{label}</span><span>{value}</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: value }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Activity */}
          <div className="rounded-[32px] border border-white/90 bg-white p-6 shadow-[0_14px_38px_rgba(15,23,42,0.05)] sm:p-7 xl:col-span-7">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Activity
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  Aktivitas terbaru
                </h2>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-[10px] font-black text-indigo-600">
                Terbaru
              </span>
            </div>

            <div className="mt-6 space-y-2">
              {activities.map((activity) => {
                const Icon = activity.icon;
                const tone = tones[activity.tone];

                return (
                  <Link
                    key={activity.title}
                    href={activity.href}
                    className="group flex items-center gap-4 rounded-2xl p-3 transition hover:bg-slate-50"
                  >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.soft} ${tone.text}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-800">
                        {activity.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {activity.description}
                      </p>
                    </div>
                    <span className="hidden shrink-0 text-[11px] font-bold text-slate-400 sm:block">
                      {activity.time}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-500" />
                  </Link>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* =====================================================
            ALL FEATURES
        ===================================================== */}
        <motion.section
          variants={sectionVariants}
          initial={reduceMotion ? false : 'hidden'}
          whileInView={reduceMotion ? undefined : 'visible'}
          viewport={{ once: true, amount: 0.05 }}
        >
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500">
                Workspace
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                Semua fitur
              </h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-slate-400 shadow-sm">
              {features.length} fitur
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const tone = tones[feature.tone];

              return (
                <Link key={feature.title} href={feature.href} className="group">
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.08 }}
                    transition={{
                      delay: Math.min(index * 0.025, 0.22),
                      duration: 0.4,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    whileHover={reduceMotion ? undefined : { y: -5 }}
                    className={`relative min-h-[150px] overflow-hidden rounded-[27px] border ${tone.border} bg-white p-5 shadow-[0_9px_28px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(37,99,235,0.085)]`}
                  >
                    <div className={`absolute -right-9 -top-9 h-28 w-28 rounded-[45%] ${tone.soft}`} />
                    <div className={`relative flex h-11 w-11 items-center justify-center rounded-2xl ${tone.soft} ${tone.text}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="relative mt-5 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900">
                          {feature.title}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          {feature.description}
                        </p>
                      </div>
                      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-300 transition group-hover:bg-indigo-50 group-hover:text-indigo-500">
                        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </motion.section>

        {/* =====================================================
            FINAL CTA
        ===================================================== */}
        <motion.section
          variants={sectionVariants}
          initial={reduceMotion ? false : 'hidden'}
          whileInView={reduceMotion ? undefined : 'visible'}
          viewport={{ once: true, amount: 0.05 }}
          className="relative overflow-hidden rounded-[34px] bg-gradient-to-br from-[#101735] via-[#20285d] to-[#3f287f] shadow-[0_22px_60px_rgba(49,46,129,0.20)]"
        >
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 p-7 sm:p-9 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-black text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                EDTECH AI WORKSPACE
              </div>
              <h2 className="mt-2 max-w-2xl text-2xl font-black tracking-tight text-white sm:text-3xl">
                Kurangi pekerjaan administratif, fokus pada pembelajaran.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-indigo-100/65">
                Gunakan fitur AI untuk membantu menyusun TP, membuat soal,
                dan membaca data pembelajaran Anda.
              </p>
            </div>

            <Link href="/dashboard/generate-tp" className="shrink-0">
              <motion.div
                whileHover={reduceMotion ? undefined : { y: -3, scale: 1.02 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg"
              >
                <WandSparkles className="h-4 w-4" />
                Mulai dengan AI
                <ArrowRight className="h-4 w-4" />
              </motion.div>
            </Link>
          </div>
        </motion.section>

        </div>

      <div className="pointer-events-none fixed bottom-6 right-6 z-20 hidden lg:block">
        <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3.5 py-2 text-[10px] font-bold text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
          Semua sistem berjalan normal
        </div>
      </div>
    </motion.div>
  );
}