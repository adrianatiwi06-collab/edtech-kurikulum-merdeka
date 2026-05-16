'use client';

import { useEffect, ReactNode, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { BookOpen, FileText, ClipboardCheck, BarChart3, Users, LogOut, Loader2, Database, ChevronDown, ChevronRight, Home, FileCheck, Brain, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [navigating, setNavigating] = useState(false);
  const [masterDataOpen, setMasterDataOpen] = useState(true);
  const [assessmentOpen, setAssessmentOpen] = useState(true);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    
    // Check if email is verified
    if (!loading && user && !user.emailVerified) {
      // Redirect to verification pending page
      router.push(`/verify-email-pending?email=${encodeURIComponent(user.email || '')}&userId=${user.uid}`);
    }
  }, [user, loading, router]);

  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleNavigation = (href: string) => {
    if (pathname !== href) {
      setNavigating(true);
      startTransition(() => {
        router.push(href);
      });
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <aside className={`bg-gradient-to-br from-purple-600 via-fuchsia-500 to-pink-500 shadow-2xl flex flex-col relative overflow-hidden transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}>
        
        <div className="relative p-6 border-b border-white/20 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-3 transition-all duration-300 ${
              sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
            }`}>
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 hover:rotate-6">
                <span className="text-xl">📚</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">EdTech</h1>
                <p className="text-xs text-purple-100 font-medium">Kurikulum Merdeka</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-white/20 rounded-lg transition-all duration-300 text-white hover:scale-110"
              title={sidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar'}
            >
              {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </button>
          </div>
        </div>
        
        <nav className="relative flex-1 py-4 overflow-y-auto overflow-x-hidden px-3 space-y-1">
          <button
            onClick={() => handleNavigation('/dashboard')}
            className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
              pathname === '/dashboard' 
                ? 'bg-white text-purple-700 font-semibold shadow-lg scale-105' 
                : 'text-white hover:bg-white/20 hover:scale-105'
            } ${sidebarCollapsed ? 'justify-center' : ''}`}
            title={sidebarCollapsed ? 'Dashboard' : ''}
          >
            <Home className={`w-5 h-5 transition-transform duration-300 ${pathname === '/dashboard' ? 'text-purple-700' : 'group-hover:scale-110'}`} />
            <span className={`transition-all duration-300 ${
              sidebarCollapsed ? 'hidden' : 'block'
            }`}>Dashboard</span>
          </button>

          <div className="pt-2">
            <button
              onClick={() => setMasterDataOpen(!masterDataOpen)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-white hover:bg-white/20 rounded-xl transition-all duration-300 group hover:scale-105 ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Master Data' : ''}
            >
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                <span className={`font-medium transition-all duration-300 ${
                  sidebarCollapsed ? 'hidden' : 'block'
                }`}>Master Data</span>
              </div>
              {!sidebarCollapsed && (masterDataOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
            </button>
            {masterDataOpen && !sidebarCollapsed && (
              <div className="ml-4 mt-1 space-y-1 border-l border-white/30 pl-3">
                <button
                  onClick={() => handleNavigation('/dashboard/master-data')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 hover:scale-105 ${
                    pathname === '/dashboard/master-data' 
                      ? 'text-purple-700 bg-white font-semibold shadow-lg' 
                      : 'text-purple-100 hover:text-white hover:bg-white/20'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Kelas & Siswa
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/generate-tp')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 hover:scale-105 ${
                    pathname === '/dashboard/generate-tp' 
                      ? 'text-purple-700 bg-white font-semibold shadow-lg' 
                      : 'text-purple-100 hover:text-white hover:bg-white/20'
                  }`}
                >
                  <Brain className="w-4 h-4" />
                  Generate TP
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/my-tp')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 hover:scale-105 ${
                    pathname === '/dashboard/my-tp' 
                      ? 'text-purple-700 bg-white font-semibold shadow-lg' 
                      : 'text-purple-100 hover:text-white hover:bg-white/20'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  TP Tersimpan
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/bank-soal')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 hover:scale-105 ${
                    pathname === '/dashboard/bank-soal' 
                      ? 'text-purple-700 bg-white font-semibold shadow-lg' 
                      : 'text-purple-100 hover:text-white hover:bg-white/20'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Bank Soal
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/template-ujian')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 hover:scale-105 ${
                    pathname === '/dashboard/template-ujian' 
                      ? 'text-purple-700 bg-white font-semibold shadow-lg' 
                      : 'text-purple-100 hover:text-white hover:bg-white/20'
                  }`}
                >
                  <FileCheck className="w-4 h-4" />
                  Template Ujian
                </button>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={() => setAssessmentOpen(!assessmentOpen)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-white hover:bg-white/20 rounded-xl transition-all duration-300 group hover:scale-105 ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Assessment' : ''}
            >
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                <span className={`font-medium transition-all duration-300 ${
                  sidebarCollapsed ? 'hidden' : 'block'
                }`}>Assessment</span>
              </div>
              {!sidebarCollapsed && (assessmentOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
            </button>
            {assessmentOpen && !sidebarCollapsed && (
              <div className="ml-4 mt-1 space-y-1 border-l border-white/30 pl-3">
                <button
                  onClick={() => handleNavigation('/dashboard/generate-soal')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 hover:scale-105 ${
                    pathname === '/dashboard/generate-soal' 
                      ? 'text-purple-700 bg-white font-semibold shadow-lg' 
                      : 'text-purple-100 hover:text-white hover:bg-white/20'
                  }`}
                >
                  <Brain className="w-4 h-4" />
                  Generate Soal
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/koreksi')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 hover:scale-105 ${
                    pathname === '/dashboard/koreksi' 
                      ? 'text-purple-700 bg-white font-semibold shadow-lg' 
                      : 'text-purple-100 hover:text-white hover:bg-white/20'
                  }`}
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Koreksi Digital
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/rekap-nilai')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 hover:scale-105 ${
                    pathname === '/dashboard/rekap-nilai' 
                      ? 'text-purple-700 bg-white font-semibold shadow-lg' 
                      : 'text-purple-100 hover:text-white hover:bg-white/20'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Rekap Nilai
                </button>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={() => setAnalysisOpen(!analysisOpen)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-white hover:bg-white/20 rounded-xl transition-all duration-300 group hover:scale-105 ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Analysis' : ''}
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                <span className={`font-medium transition-all duration-300 ${
                  sidebarCollapsed ? 'hidden' : 'block'
                }`}>Analysis</span>
              </div>
              {!sidebarCollapsed && (analysisOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
            </button>
            {analysisOpen && !sidebarCollapsed && (
              <div className="ml-4 mt-1 space-y-1 border-l border-white/30 pl-3">
                <button
                  onClick={() => handleNavigation('/dashboard/analisis-tp')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 hover:scale-105 ${
                    pathname === '/dashboard/analisis-tp' 
                      ? 'text-purple-700 bg-white font-semibold shadow-lg' 
                      : 'text-purple-100 hover:text-white hover:bg-white/20'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Analisis TP
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/analisis-nilai')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 hover:scale-105 ${
                    pathname === '/dashboard/analisis-nilai' 
                      ? 'text-purple-700 bg-white font-semibold shadow-lg' 
                      : 'text-purple-100 hover:text-white hover:bg-white/20'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Analisis Nilai Siswa
                </button>
              </div>
            )}
          </div>
        </nav>

        <div className="flex-shrink-0 p-4 border-t border-white/20">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 mb-3 border border-white/20 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-purple-100 mb-0.5">Logged in as</p>
                <p className="text-sm font-semibold text-white truncate">{user.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-white/90 hover:bg-white text-red-600 hover:text-red-700 border-white/50 hover:border-white transition-all duration-300 font-semibold hover:scale-105 shadow-lg"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {navigating && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex items-center gap-2 bg-white px-6 py-4 rounded-xl shadow-2xl border-2 border-purple-200">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">Loading...</span>
            </div>
          </div>
        )}
        <div className="py-8 px-6 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
