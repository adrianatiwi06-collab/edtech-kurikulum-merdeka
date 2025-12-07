'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BookOpen, 
  FileText, 
  ClipboardCheck, 
  BarChart3, 
  Users,
  Brain,
  FileCheck,
  ListChecks,
  TrendingUp,
  Clock,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface DashboardStats {
  totalTP: number;
  bankSoal: number;
  templates: number;
  grades: number;
}

interface RecentTP {
  id: string;
  tp_text: string;
  created_at: any;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalTP: 0,
    bankSoal: 0,
    templates: 0,
    grades: 0
  });
  const [recentTPs, setRecentTPs] = useState<RecentTP[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        console.log('Fetching dashboard data for user:', user.uid);
        console.log('Firebase db object:', db ? 'initialized' : 'NOT initialized');
        
        // Fetch counts with user_id filter - fetch individually with better error handling
        let tpCount = 0;
        let bankSoalCount = 0;
        let templatesCount = 0;
        let gradesCount = 0;

        try {
          console.log('Fetching TP data...');
          const tpSnapshot = await getDocs(query(collection(db, 'learning_goals'), where('user_id', '==', user.uid)));
          tpCount = tpSnapshot.size;
          console.log('TP count:', tpCount);
        } catch (err: any) {
          console.error('Error fetching TP:', err);
          console.error('Error details:', err.message, err.code);
        }

        try {
          console.log('Fetching Bank Soal data...');
          const bankSoalSnapshot = await getDocs(query(collection(db, 'question_banks'), where('user_id', '==', user.uid)));
          bankSoalCount = bankSoalSnapshot.size;
          console.log('Bank Soal count:', bankSoalCount);
        } catch (err: any) {
          console.error('Error fetching Bank Soal:', err);
          console.error('Error details:', err.message, err.code);
        }

        try {
          console.log('Fetching Templates data...');
          const templatesSnapshot = await getDocs(query(collection(db, 'exam_templates'), where('user_id', '==', user.uid)));
          templatesCount = templatesSnapshot.size;
          console.log('Templates count:', templatesCount);
        } catch (err: any) {
          console.error('Error fetching Templates:', err);
          console.error('Error details:', err.message, err.code);
          // If permission denied, it means collection might not exist or no documents
          // Set count to 0 and continue
          templatesCount = 0;
        }

        try {
          console.log('Fetching Grades data...');
          const gradesSnapshot = await getDocs(query(collection(db, 'grades'), where('user_id', '==', user.uid)));
          gradesCount = gradesSnapshot.size;
          console.log('Grades count:', gradesCount);
        } catch (err: any) {
          console.error('Error fetching Grades:', err);
          console.error('Error details:', err.message, err.code);
        }

        setStats({
          totalTP: tpCount,
          bankSoal: bankSoalCount,
          templates: templatesCount,
          grades: gradesCount
        });

        // Fetch recent TPs (sort client-side to avoid composite index requirement)
        try {
          console.log('Fetching Recent TPs...');
          const recentQuery = query(
            collection(db, 'learning_goals'),
            where('user_id', '==', user.uid)
          );
          const recentSnapshot = await getDocs(recentQuery);
          const tps = recentSnapshot.docs
            .map(doc => ({
              id: doc.id,
              tp_text: doc.data().tp_text,
              created_at: doc.data().created_at
            }))
            .sort((a, b) => {
              const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
              const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
              return dateB - dateA;
            })
            .slice(0, 5);
          setRecentTPs(tps);
          console.log('Recent TPs:', tps.length);
        } catch (err: any) {
          console.error('Error fetching recent TPs:', err);
          console.error('Error details:', err.message, err.code);
        }

        console.log('Dashboard data fetched successfully');
      } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        console.error('Error type:', typeof error, 'Message:', error.message);
        toast.error('Gagal memuat data dashboard', {
          description: error.message || 'Terjadi kesalahan saat mengambil data. Silakan refresh halaman.'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const statsCards = [
    {
      title: 'Total TP',
      value: stats.totalTP,
      icon: BookOpen,
      gradient: 'from-violet-500 to-purple-600',
      iconColor: 'text-violet-600',
      bgGradient: 'from-violet-50 to-purple-50',
      description: 'Tujuan Pembelajaran'
    },
    {
      title: 'Bank Soal',
      value: stats.bankSoal,
      icon: FileText,
      gradient: 'from-emerald-500 to-teal-600',
      iconColor: 'text-emerald-600',
      bgGradient: 'from-emerald-50 to-teal-50',
      description: 'Total Soal'
    },
    {
      title: 'Template Ujian',
      value: stats.templates,
      icon: FileCheck,
      gradient: 'from-indigo-500 to-blue-600',
      iconColor: 'text-indigo-600',
      bgGradient: 'from-indigo-50 to-blue-50',
      description: 'Template Tersedia'
    },
    {
      title: 'Nilai Tersimpan',
      value: stats.grades,
      icon: BarChart3,
      gradient: 'from-amber-500 to-orange-600',
      iconColor: 'text-amber-600',
      bgGradient: 'from-amber-50 to-orange-50',
      description: 'Total Penilaian'
    }
  ];

  const quickActions = [
    {
      title: 'Generate TP',
      description: 'Buat Tujuan Pembelajaran dengan AI',
      icon: Brain,
      href: '/dashboard/generate-tp',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Generate Soal AI',
      description: 'Generate soal dari Tujuan Pembelajaran',
      icon: Brain,
      href: '/dashboard/generate-soal',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: 'Template Ujian',
      description: 'Buat Template Ujian Cepat',
      icon: FileCheck,
      href: '/dashboard/template-ujian',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  const features = [
    {
      title: 'Master Data',
      description: 'Kelola data kelas dan siswa',
      icon: Users,
      href: '/dashboard/master-data',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Bank Soal',
      description: 'Kelola dan lihat bank soal',
      icon: FileText,
      href: '/dashboard/bank-soal',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Koreksi Digital',
      description: 'Koreksi jawaban siswa secara digital',
      icon: ClipboardCheck,
      href: '/dashboard/koreksi',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'Rekap Nilai',
      description: 'Lihat rekapitulasi nilai siswa',
      icon: ListChecks,
      href: '/dashboard/rekap-nilai',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
    {
      title: 'Analisis TP',
      description: 'Analisis ketercapaian Tujuan Pembelajaran',
      icon: TrendingUp,
      href: '/dashboard/analisis-tp',
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
    },
    {
      title: 'My TP',
      description: 'Kelola Tujuan Pembelajaran Anda',
      icon: BookOpen,
      href: '/dashboard/my-tp',
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
    },
  ];

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-10 relative">
        <div className="glass p-8 rounded-3xl">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-5xl font-extrabold text-gradient">Dashboard</h1>
              <p className="text-xl text-gray-700 font-medium">
                Selamat datang kembali, <span className="text-gradient-blue">{user?.email?.split('@')[0] || 'Guru'}</span> ✨
              </p>
              <p className="text-sm text-gray-500">Kelola pembelajaran dengan mudah dan efisien</p>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="lg"
              className="gap-2 btn-elegant bg-white/80 backdrop-blur-sm border-2 hover:bg-gradient-to-r hover:from-violet-50 hover:to-pink-50"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {loading ? (
          // Loading skeleton
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse glass">
              <CardHeader>
                <div className="w-14 h-14 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl mb-4 shimmer"></div>
                <div className="h-4 bg-gray-200 rounded-lg w-20 mb-3"></div>
                <div className="h-10 bg-gray-200 rounded-lg w-16 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded-lg w-24"></div>
              </CardHeader>
            </Card>
          ))
        ) : (
          statsCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card 
                key={stat.title} 
                className="card-elegant border-0 glow-hover group overflow-hidden relative"
                style={{animationDelay: `${index * 100}ms`}}
              >
                {/* Animated background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                
                <CardHeader className="relative z-10">
                  <div className={`w-16 h-16 bg-gradient-to-br ${stat.gradient} rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 smooth-transition glow`}>
                    <Icon className="w-8 h-8 text-white drop-shadow-lg" />
                  </div>
                  <CardDescription className="text-sm font-semibold text-gray-600">{stat.title}</CardDescription>
                  <CardTitle className="text-5xl font-extrabold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent">{stat.value}</CardTitle>
                  <p className="text-xs text-gray-500 mt-2 font-medium">{stat.description}</p>
                </CardHeader>
              </Card>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-8 bg-gradient-to-b from-violet-500 to-pink-500 rounded-full"></div>
          <h2 className="text-3xl font-bold text-gradient">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} href={action.href}>
                <Card className="glass hover:scale-105 smooth-transition cursor-pointer border-0 glow-hover group overflow-hidden relative h-full">
                  {/* Animated sparkle effect */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/40 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  <CardHeader className="relative z-10 space-y-4">
                    <div className={`w-14 h-14 ${action.bgColor} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 smooth-transition float`}>
                      <Icon className={`w-7 h-7 ${action.color}`} />
                    </div>
                    <CardTitle className="text-xl font-bold group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-violet-600 group-hover:to-cyan-500 group-hover:bg-clip-text transition-all duration-300">{action.title}</CardTitle>
                    <CardDescription className="text-sm text-gray-600 font-medium">{action.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* All Features Grid */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-8 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></div>
          <h2 className="text-3xl font-bold text-gradient-blue">Semua Fitur</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.title} href={feature.href}>
                <Card className="card-elegant hover:scale-105 smooth-transition cursor-pointer border-0 glow-hover group h-full">
                  <CardHeader className="space-y-3">
                    <div className={`w-12 h-12 ${feature.bgColor} rounded-xl flex items-center justify-center shadow-md group-hover:shadow-xl smooth-transition`}>
                      <Icon className={`w-6 h-6 ${feature.color}`} />
                    </div>
                    <CardTitle className="text-lg font-bold">{feature.title}</CardTitle>
                    <CardDescription className="text-sm text-gray-600">{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-7 h-7 text-violet-600" />
          <h2 className="text-3xl font-bold text-gradient">Aktivitas Terbaru</h2>
        </div>
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Recently Created TP</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            ) : recentTPs.length > 0 ? (
              <ul className="space-y-2">
                {recentTPs.map((tp, index) => (
                  <li key={tp.id} className="text-sm text-gray-600 border-b last:border-b-0 pb-2 last:pb-0">
                    <span className="font-medium text-gray-800">{index + 1}. </span>
                    {tp.tp_text && tp.tp_text.length > 100 ? tp.tp_text.substring(0, 100) + '...' : tp.tp_text || 'No description'}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Features */}
      <div>
        <h2 className="text-2xl font-bold mb-4">All Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.title} href={feature.href}>
                <Card className="card-elegant hover:shadow-2xl hover:scale-105 smooth-transition cursor-pointer h-full border-0">
                  <CardHeader>
                    <div className={`w-14 h-14 ${feature.bgColor} rounded-xl flex items-center justify-center mb-4 shadow-md hover:shadow-lg smooth-transition`}>
                      <Icon className={`w-7 h-7 ${feature.color}`} />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                    <CardDescription className="text-gray-600">{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
