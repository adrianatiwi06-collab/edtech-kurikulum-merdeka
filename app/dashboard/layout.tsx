'use client';

import { useEffect, ReactNode, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { BookOpen, FileText, ClipboardCheck, BarChart3, Users, LogOut, Loader2, Database, ChevronDown, ChevronRight, Home, FileCheck, Brain } from 'lucide-react';
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
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <aside className="w-64 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 shadow-2xl flex flex-col">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-110">
              <span className="text-xl">📚</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">EdTech</h1>
              <p className="text-xs text-slate-400">Kurikulum Merdeka</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 py-4 overflow-hidden">
          <button
            onClick={() => handleNavigation('/dashboard')}
            className={`w-full flex items-center gap-3 px-6 py-3 text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all duration-300 hover:translate-x-1 ${
              pathname === '/dashboard' ? 'bg-slate-800 text-white border-l-4 border-blue-500' : ''
            }`}
          >
            <Home className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
            <span className="font-medium">Dashboard</span>
          </button>

          <div className="mt-2">
            <button
              onClick={() => setMasterDataOpen(!masterDataOpen)}
              className="w-full flex items-center justify-between px-6 py-3 text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all duration-300 hover:translate-x-1"
            >
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 transition-transform duration-300" />
                <span className="font-medium">Master Data</span>
              </div>
              {masterDataOpen ? <ChevronDown className="w-4 h-4 transition-transform duration-300" /> : <ChevronRight className="w-4 h-4 transition-transform duration-300" />}
            </button>
            {masterDataOpen && (
              <div className="bg-slate-900/30 border-l-2 border-slate-700 ml-6">
                <button
                  onClick={() => handleNavigation('/dashboard/master-data')}
                  className={`w-full flex items-center gap-2 pl-8 pr-6 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/30 transition-all duration-300 hover:translate-x-1 ${
                    pathname === '/dashboard/master-data' ? 'text-white bg-slate-800/50 font-medium' : ''
                  }`}
                >
                  <Users className="w-4 h-4 transition-transform duration-300" />
                  Kelas & Siswa
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/generate-tp')}
                  className={`w-full flex items-center gap-2 pl-8 pr-6 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/30 transition-all duration-300 hover:translate-x-1 ${
                    pathname === '/dashboard/generate-tp' ? 'text-white bg-slate-800/50 font-medium' : ''
                  }`}
                >
                  <Brain className="w-4 h-4 transition-transform duration-300" />
                  Generate TP
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/my-tp')}
                  className={`w-full flex items-center gap-2 pl-8 pr-6 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/30 transition-all duration-300 hover:translate-x-1 ${
                    pathname === '/dashboard/my-tp' ? 'text-white bg-slate-800/50 font-medium' : ''
                  }`}
                >
                  <BookOpen className="w-4 h-4 transition-transform duration-300" />
                  TP Tersimpan
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/bank-soal')}
                  className={`w-full flex items-center gap-2 pl-8 pr-6 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/30 transition-all duration-300 hover:translate-x-1 ${
                    pathname === '/dashboard/bank-soal' ? 'text-white bg-slate-800/50 font-medium' : ''
                  }`}
                >
                  <FileText className="w-4 h-4 transition-transform duration-300" />
                  Bank Soal
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/template-ujian')}
                  className={`w-full flex items-center gap-2 pl-8 pr-6 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/30 transition-all duration-300 hover:translate-x-1 ${
                    pathname === '/dashboard/template-ujian' ? 'text-white bg-slate-800/50 font-medium' : ''
                  }`}
                >
                  <FileCheck className="w-4 h-4 transition-transform duration-300" />
                  Template Ujian
                </button>
              </div>
            )}
          </div>

          <div className="mt-2">
            <button
              onClick={() => setAssessmentOpen(!assessmentOpen)}
              className="w-full flex items-center justify-between px-6 py-3 text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all duration-300 hover:translate-x-1"
            >
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-5 h-5 transition-transform duration-300" />
                <span className="font-medium">Assessment</span>
              </div>
              {assessmentOpen ? <ChevronDown className="w-4 h-4 transition-transform duration-300" /> : <ChevronRight className="w-4 h-4 transition-transform duration-300" />}
            </button>
            {assessmentOpen && (
              <div className="bg-slate-900/30 border-l-2 border-slate-700 ml-6">
                <button
                  onClick={() => handleNavigation('/dashboard/generate-soal')}
                  className={`w-full flex items-center gap-2 pl-8 pr-6 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/30 transition-all duration-300 hover:translate-x-1 ${
                    pathname === '/dashboard/generate-soal' ? 'text-white bg-slate-800/50 font-medium' : ''
                  }`}
                >
                  <Brain className="w-4 h-4 transition-transform duration-300" />
                  Generate Soal
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/koreksi')}
                  className={`w-full flex items-center gap-2 pl-8 pr-6 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/30 transition-all duration-300 hover:translate-x-1 ${
                    pathname === '/dashboard/koreksi' ? 'text-white bg-slate-800/50 font-medium' : ''
                  }`}
                >
                  <ClipboardCheck className="w-4 h-4 transition-transform duration-300" />
                  Koreksi Digital
                </button>
                <button
                  onClick={() => handleNavigation('/dashboard/rekap-nilai')}
                  className={`w-full flex items-center gap-2 pl-8 pr-6 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/30 transition-all duration-300 hover:translate-x-1 ${
                    pathname === '/dashboard/rekap-nilai' ? 'text-white bg-slate-800/50 font-medium' : ''
                  }`}
                >
                  <BarChart3 className="w-4 h-4 transition-transform duration-300" />
                  Rekap Nilai
                </button>
              </div>
            )}
          </div>

          <div className="mt-2">
            <button
              onClick={() => setAnalysisOpen(!analysisOpen)}
              className="w-full flex items-center justify-between px-6 py-3 text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all duration-300 hover:translate-x-1"
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 transition-transform duration-300" />
                <span className="font-medium">Analysis</span>
              </div>
              {analysisOpen ? <ChevronDown className="w-4 h-4 transition-transform duration-300" /> : <ChevronRight className="w-4 h-4 transition-transform duration-300" />}
            </button>
            {analysisOpen && (
              <div className="bg-slate-900/30 border-l-2 border-slate-700 ml-6">
                <button
                  onClick={() => handleNavigation('/dashboard/analisis-tp')}
                  className={`w-full flex items-center gap-2 pl-8 pr-6 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/30 transition-all duration-300 hover:translate-x-1 ${
                    pathname === '/dashboard/analisis-tp' ? 'text-white bg-slate-800/50 font-medium' : ''
                  }`}
                >
                  <BarChart3 className="w-4 h-4 transition-transform duration-300" />
                  Analisis TP
                </button>
              </div>
            )}
          </div>
        </nav>

        <div className="flex-shrink-0 p-4 border-t border-slate-700/50">
          <div className="bg-gradient-to-br from-blue-500/10 to-indigo-600/10 rounded-xl p-4 mb-3 border border-blue-500/20 transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-semibold shadow-lg transition-transform duration-300 hover:scale-110">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 mb-0.5">Logged in as</p>
                <p className="text-sm font-semibold text-white truncate">{user.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-slate-800/50 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border-slate-700 hover:border-red-500/50 transition-all duration-300 hover:scale-105"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2 transition-transform duration-300" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {navigating && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex items-center gap-2 bg-white px-6 py-4 rounded-xl shadow-2xl border border-blue-200">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Loading...</span>
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
