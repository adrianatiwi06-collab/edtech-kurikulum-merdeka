import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '@/lib/firebase'; // ← sesuaikan dengan lokasi inisialisasi Firebase di project Anda
import { kegiatanKaldik2026_2027 } from '@/lib/kegiatanKaldik'; // data lama, hanya untuk bawaan/seed awal
import { KaldikDoc, normalizeType, legacyToDoc, startYearOf, yearLabel } from './model';

const COLLECTION = 'kaldik';

/** Daftar id tahun pelajaran yang sudah tersimpan, urut naik. */
export async function listYears(): Promise<string[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => d.id).sort();
}

/** Baca satu tahun pelajaran. Mengembalikan null jika belum ada. */
export async function loadYear(id: string): Promise<KaldikDoc | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  const startYear = Number(data.startYear) || startYearOf(id);
  return {
    id,
    startYear,
    label: data.label || yearLabel(startYear),
    hariSekolah: data.hariSekolah === 6 ? 6 : 5,
    kegiatan: Array.isArray(data.kegiatan)
      ? data.kegiatan.map((k: any) => ({
          id: String(k.id),
          start: String(k.start),
          end: String(k.end || k.start),
          activity: String(k.activity ?? ''),
          type: normalizeType(k.type),
          noClass: !!k.noClass,
        }))
      : [],
  };
}

/** Simpan (timpa) satu tahun pelajaran. */
export async function saveYear(d: KaldikDoc): Promise<void> {
  await setDoc(doc(db, COLLECTION, d.id), {
    label: d.label,
    startYear: d.startYear,
    hariSekolah: d.hariSekolah,
    kegiatan: d.kegiatan,
    updatedAt: serverTimestamp(),
  });
}

/** Data bawaan 2026/2027 dari file statis lama, dipakai selama belum ada di Firebase. */
export function fallbackDoc(): { doc: KaldikDoc; skipped: string[] } {
  return legacyToDoc(kegiatanKaldik2026_2027 as any[], 2026);
}

/**
 * Admin = email login ada di NEXT_PUBLIC_KALDIK_ADMINS (pisahkan dengan koma).
 * Ini hanya untuk menampilkan tombol edit. Keamanan sebenarnya ada di Firestore Rules.
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const admins = (process.env.NEXT_PUBLIC_KALDIK_ADMINS || '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return onAuthStateChanged(getAuth(), (user) => {
      setIsAdmin(!!user?.email && admins.includes(user.email.toLowerCase()));
    });
  }, []);
  return isAdmin;
}
