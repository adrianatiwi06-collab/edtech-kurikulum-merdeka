'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, CalendarDays, Clock3, FileText, Loader2, Save, Sparkles } from 'lucide-react';

interface Class {
  id: string;
  name: string;
}

export default function JurnalPage() {
  const { user } = useAuth();

  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('');
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [jamPelajaran, setJamPelajaran] = useState('');
  const [materi, setMateri] = useState('');
  const [metode, setMetode] = useState('');
  const [catatan, setCatatan] = useState('');

  useEffect(() => {
    if (user) loadClasses();
  }, [user]);

  const loadClasses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'classes'), where('user_id', '==', user.uid));
      const snapshot = await getDocs(q);
      const data: Class[] = [];
      snapshot.forEach((item) => data.push({ id: item.id, ...item.data() } as Class));
      data.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      setClasses(data);
    } catch (error) {
      console.error(error);
      alert('Gagal memuat daftar kelas.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return alert('Sesi pengguna belum tersedia.');

    if (!tanggal || !selectedClass || !mataPelajaran.trim() || !materi.trim()) {
      alert('Mohon lengkapi Tanggal, Kelas, Mata Pelajaran, dan Materi Pembelajaran.');
      return;
    }

    setSaving(true);
    try {
      const className = classes.find((item) => item.id === selectedClass)?.name || '';

      await addDoc(collection(db, 'jurnal_mengajar'), {
        user_id: user.uid,
        tanggal,
        class_id: selectedClass,
        class_name: className,
        mata_pelajaran: mataPelajaran.trim(),
        jam_pelajaran: jamPelajaran.trim(),
        materi: materi.trim(),
        metode: metode.trim(),
        catatan: catatan.trim(),
        created_at: new Date().toISOString(),
      });

      alert('Jurnal Mengajar berhasil disimpan.');
      setMateri('');
      setMetode('');
      setCatatan('');
      setJamPelajaran('');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan jurnal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fc] px-4 pb-12 pt-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 p-6 text-white shadow-[0_18px_50px_rgba(37,99,235,0.20)] md:p-8">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Jurnal Pembelajaran
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Jurnal Mengajar</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100 md:text-base">
                Dokumentasikan kegiatan pembelajaran dengan rapi. Data jurnal tersimpan
                terpisah dari data absensi siswa.
              </p>
            </div>

            <div className="hidden rounded-[24px] bg-white/10 p-5 backdrop-blur md:block">
              <BookOpen className="h-12 w-12" />
            </div>
          </div>
        </section>

        <Card className="overflow-hidden rounded-[28px] border-0 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.07)]">
          <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-6 py-5 md:px-8">
            <CardTitle className="flex items-center gap-3 text-xl text-slate-800">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <FileText className="h-5 w-5" />
              </span>
              Buku Jurnal Mengajar
            </CardTitle>
            <CardDescription className="ml-13">
              Hanya data aktivitas mengajar yang disimpan pada halaman ini.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-7 p-6 md:p-8">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Tanggal Pelaksanaan</label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 focus-visible:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Kelas</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  disabled={loading}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                >
                  <option value="">{loading ? 'Memuat kelas...' : '-- Pilih Kelas --'}</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>Kelas {item.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Mata Pelajaran</label>
                <Input
                  value={mataPelajaran}
                  onChange={(e) => setMataPelajaran(e.target.value)}
                  placeholder="Contoh: Pendidikan Pancasila"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50 focus-visible:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Clock3 className="h-4 w-4 text-slate-400" />
                  Jam Pelajaran
                </label>
                <Input
                  value={jamPelajaran}
                  onChange={(e) => setJamPelajaran(e.target.value)}
                  placeholder="Contoh: 1 - 3"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50 focus-visible:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Materi Pembelajaran / TP</label>
              <textarea
                value={materi}
                onChange={(e) => setMateri(e.target.value)}
                placeholder="Tuliskan materi atau Tujuan Pembelajaran yang dilaksanakan..."
                className="min-h-[130px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Metode Pembelajaran</label>
                <Input
                  value={metode}
                  onChange={(e) => setMetode(e.target.value)}
                  placeholder="Contoh: Diskusi, PBL, Demonstrasi"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50 focus-visible:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Catatan / Refleksi</label>
                <Input
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Catatan khusus pembelajaran..."
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50 focus-visible:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-[24px] bg-blue-50/70 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-blue-900">Siap menyimpan jurnal?</p>
                <p className="mt-1 text-xs text-blue-700">
                  Absensi siswa tidak akan ikut tersimpan pada dokumen jurnal.
                </p>
              </div>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="h-12 rounded-2xl bg-blue-600 px-7 font-bold shadow-sm hover:bg-blue-700"
              >
                {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Simpan Jurnal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
