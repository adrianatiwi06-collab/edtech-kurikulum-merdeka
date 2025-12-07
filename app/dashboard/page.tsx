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
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Tujuan Pembelajaran'
    },
    {
      title: 'Bank Soal',
      value: stats.bankSoal,
      icon: FileText,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Total Soal'
    },
    {
      title: 'Template Ujian',
      value: stats.templates,
      icon: FileCheck,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Template Tersedia'
    },
    {
      title: 'Nilai Tersimpan',
      value: stats.grades,
      icon: BarChart3,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gradient">Dashboard</h1>
          <p className="mt-3 text-gray-600 text-lg">
            Selamat datang, {user?.email?.split('@')[0] || 'Guru'} ✨
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {loading ? (
          // Loading skeleton
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="w-12 h-12 bg-gray-200 rounded-lg mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </CardHeader>
            </Card>
          ))
        ) : (
          statsCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="border-0 shadow-md hover:shadow-lg smooth-transition">
                <CardHeader>
                  <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <CardDescription className="text-sm text-gray-500">{stat.title}</CardDescription>
                  <CardTitle className="text-3xl font-bold">{stat.value}</CardTitle>
                  <p className="text-xs text-gray-400 mt-1">{stat.description}</p>
                </CardHeader>
              </Card>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} href={action.href}>
                <Card className="card-elegant hover:shadow-xl hover:scale-105 smooth-transition cursor-pointer border-0">
                  <CardHeader>
                    <div className={`w-12 h-12 ${action.bgColor} rounded-xl flex items-center justify-center mb-3 shadow-md hover:shadow-lg smooth-transition`}>
                      <Icon className={`w-6 h-6 ${action.color}`} />
                    </div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                    <CardDescription className="text-sm text-gray-600">{action.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Clock className="w-6 h-6" />
          Recent Activity
        </h2>
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
