'use client';
import { KALENDER_PENDIDIKAN_JATENG_2026_2027 } from '@/lib/kalenderJateng';
import { Calendar, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function KaldikJatengPage() {
  return (
    <div className="p-4 md:p-6 bg-[#f8fafc] min-h-screen max-w-[1400px] mx-auto space-y-6 font-sans">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <Calendar className="w-4 h-4" /> Referensi Resmi Dinas Pendidikan
          </div>
          <h1 className="text-2xl font-black text-slate-900">Kalender Pendidikan Jawa Tengah 2026/2027</h1>
          <p className="text-xs text-slate-500 mt-1">Acuan standar hari efektif fungsional, pekan efektif, dan libur nasional untuk perhitungan Prota & Promes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {['1 (Ganjil)', '2 (Genap)'].map((sem) => (
          <div key={sem} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b pb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-violet-600" /> Semester {sem}
            </h2>
            <div className="space-y-3">
              {KALENDER_PENDIDIKAN_JATENG_2026_2027
                .filter(item => item.semester === sem)
                .map((row, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="font-bold text-slate-900 block">{row.bulan}</span>
                      <span className="text-slate-500">{row.keterangan}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg">{row.pekanEfektif} Pekan</span>
                      <span className="block text-[10px] text-slate-400 mt-1">{row.jumlahHariEfektif} Hari Efektif</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}