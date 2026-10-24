/**
 * Model kalender pendidikan: tipe data, konversi, dan seluruh perhitungan.
 * File ini murni (tanpa React/Firebase) sehingga mudah diuji.
 */

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export type EventType = 'libur' | 'upacara' | 'rapor' | 'tes' | 'kegiatan';
export const EVENT_TYPES: EventType[] = ['libur', 'upacara', 'rapor', 'tes', 'kegiatan'];
export type SemesterId = 1 | 2;

/** Bentuk data yang disimpan di Firestore (satu dokumen per tahun pelajaran). */
export interface KegiatanDoc {
  id: string;
  start: string;       // 'YYYY-MM-DD'
  end: string;         // 'YYYY-MM-DD' (sama dengan start untuk kegiatan satu hari)
  activity: string;
  type: EventType;
  noClass: boolean;    // true = tidak ada pembelajaran, mengurangi hari efektif
}
export interface KaldikDoc {
  id: string;          // '2026-2027'
  label: string;       // '2026/2027'
  startYear: number;   // 2026
  hariSekolah: 5 | 6;  // jumlah hari sekolah per pekan
  kegiatan: KegiatanDoc[];
}

/** Bentuk siap-tampil. */
export interface DateRange { start: Date; end: Date }
export interface Kegiatan {
  id: string; date: string; activity: string; type: EventType; noClass: boolean; range: DateRange | null;
}
export interface DayCell { day: number | null; dow: number; events: Kegiatan[] }
export interface SemesterCfg {
  name: string; sub: string; rangeLabel: string; start: Date; end: Date;
  months: { year: number; month: number }[];
}
export interface SummaryRow {
  bulan: string; catatan: string; jumlahHariEfektif: number; pekan: number;
}

/* ── Utilitas tanggal ──────────────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const dayKey = (y: number, m: number, d: number) => `${y}-${m}-${d}`;
export const yearId = (startYear: number) => `${startYear}-${startYear + 1}`;
export const yearLabel = (startYear: number) => `${startYear}/${startYear + 1}`;
export const startYearOf = (id: string) => Number(id.split('-')[0]);

export function formatRange(start: Date, end: Date): string {
  const full = (d: Date) => `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  if (start.getTime() === end.getTime()) return full(start);
  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()}–${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
    }
    return `${start.getDate()} ${MONTH_NAMES[start.getMonth()]} – ${full(end)}`;
  }
  return `${full(start)} – ${full(end)}`;
}

export function emptyDoc(startYear: number): KaldikDoc {
  return { id: yearId(startYear), label: yearLabel(startYear), startYear, hariSekolah: 5, kegiatan: [] };
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

/** Salin ke tahun pelajaran lain: tanggal digeser sebagai titik awal, lalu admin menyesuaikan. */
export function copyToYear(doc: KaldikDoc, targetStartYear: number): KaldikDoc {
  const delta = targetStartYear - doc.startYear;
  const shift = (iso: string) => {
    const d = fromISO(iso);
    return toISO(new Date(d.getFullYear() + delta, d.getMonth(), d.getDate()));
  };
  const next = emptyDoc(targetStartYear);
  next.hariSekolah = doc.hariSekolah;
  next.kegiatan = doc.kegiatan.map((k) => ({ ...k, id: newId(), start: shift(k.start), end: shift(k.end) }));
  return next;
}

/* ── Migrasi dari data lama (teks bebas seperti "13-15 Juli 2026") ─────── */

const MONTH_LOOKUP: Record<string, number> = { nopember: 10 };
MONTH_NAMES.forEach((name, index) => { MONTH_LOOKUP[name.toLowerCase()] = index; });

export function parseDateRange(raw: string): DateRange | null {
  const text = raw
    .toLowerCase()
    .replace(/(?:^|\s)(?:s\.d\.?|s\/d|sd)(?=\s)/g, ' - ')
    .replace(/\b(?:sampai dengan|sampai|hingga)\b/g, ' - ')
    .replace(/[–—]/g, '-');

  const parsed = text
    .split('-').map((p) => p.trim()).filter(Boolean)
    .map((part) => {
      const m = part.match(/(\d{1,2})(?:\s+([a-z]+))?(?:\s+(\d{4}))?/);
      if (!m) return null;
      return { d: Number(m[1]), m: m[2] !== undefined ? MONTH_LOOKUP[m[2]] : undefined, y: m[3] ? Number(m[3]) : undefined };
    })
    .filter((p): p is { d: number; m: number | undefined; y: number | undefined } => p !== null);

  if (parsed.length === 0) return null;
  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  if (last.m === undefined || last.y === undefined) return null;

  const startMonth = first.m ?? last.m;
  const startYear = first.y ?? (startMonth > last.m ? last.y - 1 : last.y);
  let start = new Date(startYear, startMonth, first.d);
  let end = new Date(last.y, last.m, last.d);
  if (end < start) [start, end] = [end, start];
  return { start, end };
}

export function normalizeType(type?: string): EventType {
  return EVENT_TYPES.includes(type as EventType) ? (type as EventType) : 'kegiatan';
}

/** Ubah data statis lama menjadi dokumen baru. Item yang tanggalnya tidak terbaca dilaporkan lewat `skipped`. */
export function legacyToDoc(
  raw: { date: string; activity: string; type?: string }[],
  startYear: number,
): { doc: KaldikDoc; skipped: string[] } {
  const doc = emptyDoc(startYear);
  const skipped: string[] = [];
  raw.forEach((item) => {
    const range = parseDateRange(item.date);
    if (!range) { skipped.push(`${item.date}: ${item.activity}`); return; }
    const type = normalizeType(item.type);
    doc.kegiatan.push({
      id: newId(), start: toISO(range.start), end: toISO(range.end),
      activity: item.activity, type, noClass: type === 'libur',
    });
  });
  return { doc, skipped };
}

/* ── Model turunan ─────────────────────────────────────────────────────── */

export function buildModel(doc: KaldikDoc) {
  const y = doc.startYear;

  const SEMESTERS: Record<SemesterId, SemesterCfg> = {
    1: {
      name: 'Semester 1', sub: 'Ganjil', rangeLabel: `Juli – Desember ${y}`,
      start: new Date(y, 6, 1), end: new Date(y, 11, 31),
      months: [7, 8, 9, 10, 11, 12].map((month) => ({ year: y, month })),
    },
    2: {
      name: 'Semester 2', sub: 'Genap', rangeLabel: `Januari – Juni ${y + 1}`,
      start: new Date(y + 1, 0, 1), end: new Date(y + 1, 5, 30),
      months: [1, 2, 3, 4, 5, 6].map((month) => ({ year: y + 1, month })),
    },
  };

  const KEGIATAN: Kegiatan[] = doc.kegiatan
    .map((k) => {
      const start = fromISO(k.start);
      const end = fromISO(k.end || k.start);
      const range = end < start ? { start: end, end: start } : { start, end };
      return {
        id: k.id, activity: k.activity, type: normalizeType(k.type), noClass: !!k.noClass,
        range, date: formatRange(range.start, range.end),
      };
    })
    .sort((a, b) => a.range!.start.getTime() - b.range!.start.getTime());

  const EVENT_MAP = new Map<string, Kegiatan[]>();
  KEGIATAN.forEach((item) => {
    const cursor = new Date(item.range!.start);
    for (let i = 0; i < 400 && cursor <= item.range!.end; i++) {
      const key = dayKey(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
      EVENT_MAP.set(key, [...(EVENT_MAP.get(key) ?? []), item]);
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const LIBUR_DAYS = Array.from(EVENT_MAP.values()).filter((list) => list.some((e) => e.type === 'libur')).length;

  /** Hari efektif = hari sekolah (Sen–Jum atau Sen–Sab) dikurangi hari yang punya kegiatan bertanda "tanpa pembelajaran". */
  const lastSchoolDow = doc.hariSekolah === 6 ? 6 : 5;
  const rows: Record<SemesterId, SummaryRow[]> = { 1: [], 2: [] };
  ([1, 2] as SemesterId[]).forEach((sem) => {
    SEMESTERS[sem].months.forEach(({ year, month }) => {
      let hari = 0;
      let off = 0;
      const total = new Date(year, month, 0).getDate();
      for (let d = 1; d <= total; d++) {
        const dow = new Date(year, month - 1, d).getDay();
        if (dow < 1 || dow > lastSchoolDow) continue;
        if ((EVENT_MAP.get(dayKey(year, month, d)) ?? []).some((e) => e.noClass)) off++;
        else hari++;
      }
      rows[sem].push({
        bulan: MONTH_NAMES[month - 1],
        catatan: off > 0 ? `${off} hari libur atau tanpa pembelajaran` : '',
        jumlahHariEfektif: hari,
        pekan: Math.round((hari / doc.hariSekolah) * 10) / 10,
      });
    });
  });

  const rowsOfSemester = (sem: SemesterId) => rows[sem];
  const effectiveTotal = (sem: SemesterId) => rows[sem].reduce((s, r) => s + r.jumlahHariEfektif, 0);

  const inSemester = (item: Kegiatan, sem: SemesterId) =>
    !!item.range && item.range.start <= SEMESTERS[sem].end && item.range.end >= SEMESTERS[sem].start;

  const buildWeeks = (year: number, month: number, padToWeeks = 0): DayCell[][] => {
    const first = new Date(year, month - 1, 1).getDay();
    const total = new Date(year, month, 0).getDate();
    const cells: DayCell[] = [];
    for (let i = 0; i < first; i++) cells.push({ day: null, dow: i, events: [] });
    for (let d = 1; d <= total; d++) {
      cells.push({ day: d, dow: (first + d - 1) % 7, events: EVENT_MAP.get(dayKey(year, month, d)) ?? [] });
    }
    while (cells.length % 7 !== 0) cells.push({ day: null, dow: cells.length % 7, events: [] });
    const weeks: DayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    while (weeks.length < padToWeeks) {
      weeks.push(Array.from({ length: 7 }, (_, i) => ({ day: null, dow: i, events: [] })));
    }
    return weeks;
  };

  const countEventsInMonth = (year: number, month: number) => {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return KEGIATAN.filter((k) => k.range && k.range.start <= end && k.range.end >= start).length;
  };

  return {
    doc, SEMESTERS, KEGIATAN, EVENT_MAP, LIBUR_DAYS,
    rowsOfSemester, effectiveTotal, inSemester, buildWeeks, countEventsInMonth,
  };
}

export type Model = ReturnType<typeof buildModel>;
