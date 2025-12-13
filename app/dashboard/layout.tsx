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
    <div className="flex h-screen bg-slate-50">
      <aside className={`bg-white border-r border-slate-200 shadow-sm flex flex-col relative overflow-hidden transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}>
        
        <div className="relative p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-3 transition-all duration-300 ${
              sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
            }`}>
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md transition-all duration-300 hover:scale-105">
                <span className="text-xl text-white">📚</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">EdTech</h1>
                <p className="text-xs text-slate-500 font-medium">Kurikulum Merdeka</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-all duration-300 text-slate-500 hover:text-slate-800"
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
                ? 'bg-violet-50 text-violet-700 font-semibold shadow-sm' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            } ${sidebarCollapsed ? 'justify-center' : ''}`}
            title={sidebarCollapsed ? 'Dashboard' : ''}
          >
            <Home className={`w-5 h-5 transition-transform duration-300 ${pathname === '/dashboard' ? 'text-violet-600' : 'text-slate-500 group-hover:text-slate-700'}`} />
            <span className={`transition-all duration-300 ${
              sidebarCollapsed ? 'hidden' : 'block'
            }`}>Dashboard</span>
          </button>

          <div className="pt-2">
            <button
              onClick={() => setMasterDataOpen(!masterDataOpen)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all duration-300 group ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Master Data' : ''}
            >
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-slate-500 group-hover:text-slate-700 transition-transform duration-300" />
                <span className={`font-medium transition-all duration-300 ${
                  sidebarCollapsed ? 'hidden' : 'block'
                }`}>Master Data</span>
              </div>
              {!sidebarCollapsed && (masterDataOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />)}
            </button>
            {masterDataOpen && !sidebarCollapsed && (
              <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3">
                <button
                  onClick={() => handleNavigation('/dashboard/master-data')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 ${
                    pathname === '/dashboard/master-data' 
                      ? 'text-violet-700 bg-violet-50 font-medium' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Kelas & Siswa
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/generate-tp')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 ${
                    pathname === '/dashboard/generate-tp' 
                      ? 'text-violet-700 bg-violet-50 font-medium' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Brain className="w-4 h-4" />
                  Generate TP
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/my-tp')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 ${
                    pathname === '/dashboard/my-tp' 
                      ? 'text-violet-700 bg-violet-50 font-medium' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  TP Tersimpan
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/bank-soal')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 ${
                    pathname === '/dashboard/bank-soal' 
                      ? 'text-violet-700 bg-violet-50 font-medium' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Bank Soal
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/template-ujian')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 ${
                    pathname === '/dashboard/template-ujian' 
                      ? 'text-violet-700 bg-violet-50 font-medium' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
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
              className={`w-full flex items-center justify-between px-4 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all duration-300 group ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Assessment' : ''}
            >
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-5 h-5 text-slate-500 group-hover:text-slate-700 transition-transform duration-300" />
                <span className={`font-medium transition-all duration-300 ${
                  sidebarCollapsed ? 'hidden' : 'block'
                }`}>Assessment</span>
              </div>
              {!sidebarCollapsed && (assessmentOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />)}
            </button>
            {assessmentOpen && !sidebarCollapsed && (
              <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3">
                <button
                  onClick={() => handleNavigation('/dashboard/generate-soal')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 ${
                    pathname === '/dashboard/generate-soal' 
                      ? 'text-violet-700 bg-violet-50 font-medium' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Brain className="w-4 h-4" />
                  Generate Soal
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/koreksi')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 ${
                    pathname === '/dashboard/koreksi' 
                      ? 'text-violet-700 bg-violet-50 font-medium' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Koreksi Digital
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/rekap-nilai')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 ${
                    pathname === '/dashboard/rekap-nilai' 
                      ? 'text-violet-700 bg-violet-50 font-medium' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
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
              className={`w-full flex items-center justify-between px-4 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all duration-300 group ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
              title={sidebarCollapsed ? 'Analysis' : ''}
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-slate-500 group-hover:text-slate-700 transition-transform duration-300" />
                <span className={`font-medium transition-all duration-300 ${
                  sidebarCollapsed ? 'hidden' : 'block'
                }`}>Analysis</span>
              </div>
              {!sidebarCollapsed && (analysisOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />)}
            </button>
            {analysisOpen && !sidebarCollapsed && (
              <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3">
                <button
                  onClick={() => handleNavigation('/dashboard/analisis-tp')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 ${
                    pathname === '/dashboard/analisis-tp' 
                      ? 'text-violet-700 bg-violet-50 font-medium' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Analisis TP
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/analisis-nilai')}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-300 ${
                    pathname === '/dashboard/analisis-nilai' 
                      ? 'text-violet-700 bg-violet-50 font-medium' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Analisis Nilai Siswa
                </button>
              </div>
            )}
          </div>
        </nav>

        <div className="flex-shrink-0 p-4 border-t border-slate-200">
          <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 mb-0.5">Logged in as</p>
                <p className="text-sm font-semibold text-slate-800 truncate">{user.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border-slate-200 hover:border-red-200 transition-all duration-300"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50/50">
        {navigating && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex items-center gap-2 bg-white px-6 py-4 rounded-xl shadow-2xl border border-slate-100">
              <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
              <span className="text-sm font-medium text-slate-700">Loading...</span>
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
