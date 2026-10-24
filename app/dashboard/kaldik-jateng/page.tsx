'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText,
  Flag,
  ListChecks,
  Pencil,
  Plus,
  Printer,
  Search,
  SearchX,
  Sparkles,
  Sun,
  X,
  FileUp,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import EventEditor from '@/components/kaldik/EventEditor';
import {
  DAY_NAMES, EVENT_TYPES, MONTH_NAMES, buildModel, copyToYear, emptyDoc, startYearOf, yearId,
  type EventType, type KaldikDoc, type Kegiatan, type Model, type SemesterId,
} from '@/lib/kaldik/model';
import { fallbackDoc, listYears, loadYear, saveYear, useIsAdmin } from '@/lib/kaldik/store';
// Impor action untuk ekstrak Kaldik via AI
import { extractKaldikFromDocument } from './actions'; 

/* ────────────────────────────────────────────────────────────────────────────
   Konstanta & tipe
──────────────────────────────────────────────────────────────────────────── */

type TabId = 'ringkasan' | 'kalender' | 'kegiatan';
type PrintScope = 1 | 2 | 'all';

interface TypeMeta {
  label: string;
  bg: string;      // latar sel / chip
  fg: string;      // warna teks
  border: string;  // garis tepi lembut
  solid: string;   // warna penuh (titik, aksen)
  icon: LucideIcon;
}

const TYPE_ORDER: EventType[] = EVENT_TYPES;

const TYPE_META: Record<EventType, TypeMeta> = {
  libur:    { label: 'Libur',          bg: '#ffe4e6', fg: '#9f1239', border: '#fda4af', solid: '#e11d48', icon: Sun },
  upacara:  { label: 'Upacara',        bg: '#e0f2fe', fg: '#075985', border: '#7dd3fc', solid: '#0284c7', icon: Flag },
  rapor:    { label: 'Rapor',          bg: '#fef3c7', fg: '#92400e', border: '#fcd34d', solid: '#d97706', icon: FileText },
  tes:      { label: 'Tes / Akademik', bg: '#ede9fe', fg: '#5b21b6', border: '#c4b5fd', solid: '#7c3aed', icon: Pencil },
  kegiatan: { label: 'Kegiatan',       bg: '#d1fae5', fg: '#065f46', border: '#6ee7b7', solid: '#059669', icon: Sparkles },
};

const KaldikContext = createContext<Model | null>(null);
function useModel(): Model {
  const model = useContext(KaldikContext);
  if (!model) throw new Error('KaldikContext belum disediakan');
  return model;
}

/* ────────────────────────────────────────────────────────────────────────────
   Helper kalender
──────────────────────────────────────────────────────────────────────────── */

/** Jenis yang menentukan warna sel. Jika ada filter legenda, hanya jenis itu yang menyala. */
function topType(events: Kegiatan[], only?: EventType | null): EventType | null {
  if (events.length === 0) return null;
  if (only) return events.some((e) => e.type === only) ? only : null;
  return TYPE_ORDER.find((t) => events.some((e) => e.type === t)) ?? null;
}

function dateBadge(item: Kegiatan) {
  if (!item.range) return { top: '–', bottom: '' };
  const { start, end } = item.range;
  const sameDay = start.getTime() === end.getTime();
  const top = sameDay ? String(start.getDate()) : `${start.getDate()}–${end.getDate()}`;
  const bottom = MONTH_NAMES[start.getMonth()].slice(0, 3);
  return { top, bottom };
}

function groupByMonth(items: Kegiatan[]) {
  const groups: { label: string; items: Kegiatan[] }[] = [];
  items.forEach((item) => {
    const label = item.range
      ? `${MONTH_NAMES[item.range.start.getMonth()]} ${item.range.start.getFullYear()}`
      : 'Tanggal lainnya';
    const group = groups.find((g) => g.label === label);
    if (group) group.items.push(item);
    else groups.push({ label, items: [item] });
  });
  return groups;
}

/* ────────────────────────────────────────────────────────────────────────────
   Komponen layar
──────────────────────────────────────────────────────────────────────────── */

function MonthCard({ year, month, today, highlight }: {
  year: number; month: number; today: Date | null; highlight: EventType | null;
}) {
  const { buildWeeks, countEventsInMonth } = useModel();
  const weeks = buildWeeks(year, month);
  const totalDays = new Date(year, month, 0).getDate();
  const eventCount = countEventsInMonth(year, month);

  return (
    <section className="relative min-w-0 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-shadow hover:z-20 hover:shadow-[0_18px_40px_-24px_rgba(6,78,59,0.35)] focus-within:z-20 sm:p-5">
      <header className="mb-4 flex items-end justify-between gap-3 border-b border-dashed border-slate-200 pb-3">
        <div>
          <h3 className="kd-display text-[1.65rem] font-semibold leading-none text-[#0b3d33]">{MONTH_NAMES[month - 1]}</h3>
          <p className="mt-1.5 text-xs text-slate-500">
            {totalDays} hari{eventCount > 0 ? `, ${eventCount} kegiatan` : ''}
          </p>
        </div>
        <span className="kd-display text-lg text-slate-300">{year}</span>
      </header>

      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold">
        {DAY_NAMES.map((name, i) => (
          <span key={name} className={i === 0 ? 'text-rose-500' : 'text-slate-400'}>
            <span className="hidden sm:inline">{name.slice(0, 3)}</span>
            <span className="sm:hidden">{name.slice(0, 1)}</span>
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.map((week, weekIdx) =>
          week.map((cell, i) => {
            if (cell.day === null) return <div key={`${weekIdx}-${i}`} aria-hidden="true" />;

            const type = topType(cell.events, highlight);
            const meta = type ? TYPE_META[type] : null;
            const isToday = !!today && today.getFullYear() === year && today.getMonth() === month - 1 && today.getDate() === cell.day;
            const distinct = TYPE_ORDER.filter((t) => cell.events.some((e) => e.type === t)).slice(0, 3);
            const hasEvents = cell.events.length > 0;

            const tipX = i <= 1 ? 'left-0' : i >= 5 ? 'right-0' : 'left-1/2 -translate-x-1/2';
            const tipY = weekIdx === 0 ? 'top-full mt-2' : 'bottom-full mb-2';

            return (
              <div
                key={`${weekIdx}-${i}`}
                tabIndex={hasEvents ? 0 : -1}
                aria-label={`${cell.day} ${MONTH_NAMES[month - 1]} ${year}${hasEvents ? ': ' + cell.events.map((e) => e.activity).join('; ') : ''}`}
                className={`group relative flex aspect-square items-center justify-center rounded-xl text-[13px] transition-colors ${
                  isToday ? 'outline outline-2 outline-offset-2 outline-[#0b3d33]' : 'outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400'
                } ${meta ? 'font-bold' : cell.dow === 0 ? 'text-rose-500/80 hover:bg-slate-100' : cell.dow === 6 ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-700 hover:bg-slate-100'}`}
                style={meta ? { background: meta.bg, color: meta.fg, boxShadow: `inset 0 0 0 1px ${meta.border}` } : undefined}
              >
                <span>{cell.day}</span>

                {hasEvents && (
                  <span className="absolute bottom-[3px] flex gap-0.5" aria-hidden="true">
                    {distinct.map((t) => (
                      <span key={t} className="h-1 w-1 rounded-full" style={{ background: TYPE_META[t].solid }} />
                    ))}
                  </span>
                )}

                {hasEvents && (
                  <div
                    role="tooltip"
                    className={`pointer-events-none invisible absolute z-30 w-60 rounded-2xl bg-[#0b2a24] p-3 text-left font-normal text-white opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100 ${tipX} ${tipY}`}
                  >
                    <p className="mb-2 text-[11px] text-emerald-200/80">
                      {DAY_NAMES[cell.dow]}, {cell.day} {MONTH_NAMES[month - 1]} {year}
                    </p>
                    <ul className="space-y-2">
                      {cell.events.map((e, idx) => (
                        <li key={idx} className="flex gap-2 text-xs leading-snug">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_META[e.type].solid }} />
                          <span>
                            {e.activity}
                            <span className="block text-[11px] text-white/50">{e.date}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          }),
        )}
      </div>
    </section>
  );
}

function TypeChip({ type }: { type: EventType }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: meta.bg, color: meta.fg }}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function EventRow({ item }: { item: Kegiatan }) {
  const meta = TYPE_META[item.type];
  const badge = dateBadge(item);
  return (
    <li className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3 pr-4">
      <div
        className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl leading-none"
        style={{ background: meta.bg, color: meta.fg, boxShadow: `inset 0 0 0 1px ${meta.border}` }}
      >
        <span className="kd-display text-lg font-bold">{badge.top}</span>
        <span className="mt-1 text-[10px] font-semibold">{badge.bottom}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-slate-900">{item.activity}</p>
        <p className="mt-0.5 text-xs text-slate-500">{item.date}</p>
      </div>
      <TypeChip type={item.type} />
    </li>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Lembar cetak (A4 landscape) — dirender lewat portal ke <body>
──────────────────────────────────────────────────────────────────────────── */

function PrintHeader({ sem }: { sem: SemesterId }) {
  const { SEMESTERS, doc } = useModel();
  const cfg = SEMESTERS[sem];
  return (
    <div className="kp-head">
      <div>
        <div className="kp-kicker">Kalender pendidikan</div>
        <h1 className="kp-title">Provinsi Jawa Tengah, Tahun Pelajaran {doc.label}</h1>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span className="kp-pill">{cfg.name} ({cfg.sub})</span>
        <div className="kp-sub">{cfg.rangeLabel}</div>
      </div>
    </div>
  );
}

function PrintFooter({ printedAt }: { printedAt: string }) {
  return (
    <div className="kp-foot">
      <span>Acuan hari efektif, libur, dan kegiatan untuk penyusunan Prota dan Promes.</span>
      <span>Dicetak {printedAt}</span>
    </div>
  );
}

function PrintSheet({ scope }: { scope: PrintScope }) {
  const { SEMESTERS, KEGIATAN, inSemester, rowsOfSemester, buildWeeks, effectiveTotal } = useModel();
  const sems: SemesterId[] = scope === 'all' ? [1, 2] : [scope];
  const printedAt = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const pages = sems.flatMap((sem) => {
    const cfg = SEMESTERS[sem];
    const list = KEGIATAN.filter((k) => inSemester(k, sem));
    const rows = rowsOfSemester(sem);

    return [
      <div className="kp-page" key={`cal-${sem}`}>
        <PrintHeader sem={sem} />
        <div className="kp-months">
          {cfg.months.map(({ year, month }) => (
            <div className="kp-month" key={`${year}-${month}`}>
              <div className="kp-mhead">
                <span className="kp-mname">{MONTH_NAMES[month - 1]}</span>
                <span className="kp-myear">{year}</span>
              </div>
              <div className="kp-dow">
                {DAY_NAMES.map((n) => <span key={n}>{n.slice(0, 3)}</span>)}
              </div>
              {buildWeeks(year, month, 6).map((week, wi) => (
                <div className="kp-week" key={wi}>
                  {week.map((cell, ci) => {
                    const type = topType(cell.events);
                    const meta = type ? TYPE_META[type] : null;
                    const cls = ['kp-cell', cell.dow === 0 ? 'sun' : '', cell.dow === 0 || cell.dow === 6 ? 'we' : '', meta ? 'ev' : '']
                      .filter(Boolean).join(' ');
                    return (
                      <div
                        key={ci}
                        className={cls}
                        style={meta ? { background: meta.bg, color: meta.fg, boxShadow: `inset 0 0 0 0.25mm ${meta.border}` } : undefined}
                      >
                        {cell.day ?? ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="kp-legend">
          {TYPE_ORDER.map((t) => (
            <span key={t}>
              <i style={{ background: TYPE_META[t].bg, boxShadow: `inset 0 0 0 0.3mm ${TYPE_META[t].border}` }} />
              {TYPE_META[t].label}
            </span>
          ))}
          <span><i style={{ background: '#f8fafc', boxShadow: 'inset 0 0 0 0.3mm #cbd5e1' }} />Sabtu / Minggu</span>
        </div>
        <PrintFooter printedAt={printedAt} />
      </div>,

      <div className="kp-page" key={`list-${sem}`}>
        <PrintHeader sem={sem} />
        <h2 className="kp-h2">Daftar kegiatan ({list.length})</h2>
        <div className="kp-list">
          {list.map((item, idx) => {
            const meta = TYPE_META[item.type];
            return (
              <div className="kp-item" key={idx}>
                <div className="kp-date">{item.date}</div>
                <div className="kp-act">{item.activity}</div>
                <span className="kp-tag" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
              </div>
            );
          })}
        </div>
        {rows.length > 0 && (
          <>
            <h2 className="kp-h2" style={{ marginTop: '6mm' }}>
              Rekap hari efektif ({effectiveTotal(sem)} hari)
            </h2>
            <div className="kp-recap">
              {rows.map((row, idx) => (
                <div key={idx}>
                  <b>{row.jumlahHariEfektif}</b>
                  <span>{row.bulan}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <PrintFooter printedAt={printedAt} />
      </div>,
    ];
  });

  return <div id="kaldik-print-root">{pages}</div>;
}

/* Gaya global: font, dan seluruh aturan cetak */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

.kd-root { font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif; }
.kd-display, #kaldik-print-root .kp-title, #kaldik-print-root .kp-mname { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; }

@page { size: A4 landscape; margin: 8mm; }

#kaldik-print-root { display: none; color: #0f172a; font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif; }
#kaldik-print-root .kp-page { break-after: page; page-break-after: always; }
#kaldik-print-root .kp-page:last-child { break-after: auto; page-break-after: auto; }

#kaldik-print-root .kp-head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 0.6mm solid #0b3d33; padding-bottom: 2.5mm; margin-bottom: 4mm; }
#kaldik-print-root .kp-kicker { font-size: 8pt; font-weight: 600; color: #047857; }
#kaldik-print-root .kp-title { font-size: 16pt; font-weight: 700; margin: 0.5mm 0 0; line-height: 1.15; }
#kaldik-print-root .kp-pill { display: inline-block; background: #0b3d33; color: #fff; border-radius: 99px; padding: 1.4mm 4mm; font-size: 8.5pt; font-weight: 700; }
#kaldik-print-root .kp-sub { font-size: 7.5pt; color: #475569; margin-top: 1mm; }

#kaldik-print-root .kp-months { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
#kaldik-print-root .kp-month { border: 0.25mm solid #cbd5e1; border-radius: 2.5mm; overflow: hidden; break-inside: avoid; }
#kaldik-print-root .kp-mhead { background: #0b3d33; color: #fff; padding: 1.8mm 3mm; display: flex; justify-content: space-between; align-items: baseline; }
#kaldik-print-root .kp-mname { font-size: 11pt; font-weight: 700; }
#kaldik-print-root .kp-myear { font-size: 7.5pt; opacity: 0.75; }
#kaldik-print-root .kp-dow, #kaldik-print-root .kp-week { display: grid; grid-template-columns: repeat(7, 1fr); }
#kaldik-print-root .kp-dow span { font-size: 6.5pt; font-weight: 700; text-align: center; padding: 1mm 0; background: #f1f5f9; color: #475569; }
#kaldik-print-root .kp-dow span:first-child { color: #e11d48; }
#kaldik-print-root .kp-cell { height: 9mm; display: flex; align-items: center; justify-content: center; font-size: 8.5pt; border-top: 0.2mm solid #e8edf3; border-right: 0.2mm solid #e8edf3; }
#kaldik-print-root .kp-cell:nth-child(7n) { border-right: 0; }
#kaldik-print-root .kp-cell.we { background: #f8fafc; color: #64748b; }
#kaldik-print-root .kp-cell.sun { color: #e11d48; }
#kaldik-print-root .kp-cell.ev { font-weight: 700; }

#kaldik-print-root .kp-legend { display: flex; flex-wrap: wrap; gap: 2mm 6mm; margin-top: 4mm; font-size: 7.5pt; color: #334155; }
#kaldik-print-root .kp-legend span { display: inline-flex; align-items: center; gap: 1.6mm; }
#kaldik-print-root .kp-legend i { display: inline-block; width: 4mm; height: 4mm; border-radius: 1mm; }

#kaldik-print-root .kp-h2 { font-size: 10pt; font-weight: 700; margin: 0 0 2mm; color: #0b3d33; }
#kaldik-print-root .kp-list { column-count: 2; column-gap: 8mm; }
#kaldik-print-root .kp-item { break-inside: avoid; display: flex; gap: 3mm; align-items: flex-start; padding: 1.8mm 0; border-bottom: 0.2mm dashed #cbd5e1; }
#kaldik-print-root .kp-date { width: 27mm; flex-shrink: 0; font-weight: 700; font-size: 8pt; }
#kaldik-print-root .kp-act { flex: 1; font-size: 8pt; line-height: 1.35; }
#kaldik-print-root .kp-tag { font-size: 6.5pt; font-weight: 700; padding: 0.5mm 2mm; border-radius: 9px; white-space: nowrap; }
#kaldik-print-root .kp-recap { display: grid; grid-template-columns: repeat(6, 1fr); gap: 2.5mm; }
#kaldik-print-root .kp-recap div { border: 0.25mm solid #cbd5e1; border-radius: 2mm; padding: 2mm 3mm; display: flex; flex-direction: column; }
#kaldik-print-root .kp-recap b { font-size: 13pt; color: #0b3d33; }
#kaldik-print-root .kp-recap span { font-size: 7.5pt; color: #475569; }
#kaldik-print-root .kp-foot { margin-top: 4mm; font-size: 6.5pt; color: #64748b; display: flex; justify-content: space-between; }

@media print {
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
  body > *:not(#kaldik-print-root) { display: none !important; }
  #kaldik-print-root { display: block !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;

/* ────────────────────────────────────────────────────────────────────────────
   Halaman utama
──────────────────────────────────────────────────────────────────────────── */

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'ringkasan', label: 'Ringkasan pekan efektif', icon: ClipboardList },
  { id: 'kalender', label: 'Kalender visual', icon: CalendarDays },
  { id: 'kegiatan', label: 'Daftar kegiatan', icon: ListChecks },
];

interface ViewProps {
  years: string[]; yearId: string; onYearChange: (id: string) => void;
  isAdmin: boolean; persisted: boolean; loading: boolean; error: string;
  onEdit: () => void; onNewYear: () => void; onPersist: () => void;
  doc: KaldikDoc; setDoc: (doc: KaldikDoc) => void;
}

function KaldikView({ years, yearId: currentYearId, onYearChange, isAdmin, persisted, loading, error, onEdit, onNewYear, onPersist, doc, setDoc }: ViewProps) {
  const { SEMESTERS, KEGIATAN, LIBUR_DAYS, inSemester, rowsOfSemester, effectiveTotal } = useModel();
  const [activeTab, setActiveTab] = useState<TabId>('kalender');
  const [semester, setSemester] = useState<SemesterId>(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState<'all' | EventType>('all');
  const [highlight, setHighlight] = useState<EventType | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [printScope, setPrintScope] = useState<PrintScope>('all');
  const [today, setToday] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);

  // State dan Ref untuk fitur Impor PDF/Excel via AI
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Tanggal "hari ini" dihitung di klien agar tidak memicu hydration mismatch.
  useEffect(() => {
    setToday(new Date());
    setMounted(true);
  }, []);

  // Pilih semester yang sedang berjalan setiap kali tahun pelajaran berganti.
  useEffect(() => {
    const now = new Date();
    setSemester(now >= SEMESTERS[2].start && now <= SEMESTERS[2].end ? 2 : 1);
    setHighlight(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  const semesterList = useMemo(() => KEGIATAN.filter((k) => inSemester(k, semester)), [semester, KEGIATAN]);

  const typeCounts = useMemo(() => {
    const counts: Record<EventType, number> = { libur: 0, upacara: 0, rapor: 0, tes: 0, kegiatan: 0 };
    semesterList.forEach((k) => { counts[k.type] += 1; });
    return counts;
  }, [semesterList]);

  const visibleSemesterList = highlight ? semesterList.filter((k) => k.type === highlight) : semesterList;

  const filteredKegiatan = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return KEGIATAN.filter((k) => {
      const matchKeyword = !q || k.activity.toLowerCase().includes(q) || k.date.toLowerCase().includes(q);
      return matchKeyword && (filterType === 'all' || k.type === filterType);
    });
  }, [searchKeyword, filterType, KEGIATAN]);

  const nextEvent = useMemo(() => {
    if (!today) return null;
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return KEGIATAN.find((k) => k.range && k.range.end >= startOfToday) ?? null;
  }, [today, KEGIATAN]);

  const totalEffective = effectiveTotal(1) + effectiveTotal(2);

  const handlePrint = (scope: PrintScope) => {
    setMenuOpen(false);
    setPrintScope(scope);

    // Judul dokumen dipakai browser sebagai nama file PDF default.
    const previousTitle = document.title;
    const scopeLabel = scope === 'all' ? 'Setahun penuh' : `${SEMESTERS[scope].name} ${SEMESTERS[scope].sub}`;
    document.title = `Kalender Pendidikan Jawa Tengah ${doc.id} - ${scopeLabel}`;
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);

    // Beri waktu React merender lembar cetak sebelum dialog dibuka.
    window.setTimeout(() => window.print(), 150);
  };

  // Fungsi untuk menangani file PDF/Excel yang diunggah
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      // Convert file ke Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = (reader.result as string).split(',')[1];
        
        // Kirim ke server action AI
        const result = await extractKaldikFromDocument(base64String, file.type, doc.label);
        
        if (result.success && result.data) {
          // Gabungkan kegiatan lama dengan hasil AI baru ke dalam state doc
          const mergedDoc = {
            ...doc,
            kegiatan: [...doc.kegiatan, ...result.data]
          };
          
          // Perbarui state doc dan langsung buka editor
          setDoc(mergedDoc);
          onEdit(); 
          alert(`Berhasil mengekstrak ${result.data.length} kegiatan! Silakan periksa hasilnya dan klik "Simpan perubahan" di layar editor.`);
        } else {
          alert(result.error);
        }
        setIsExtracting(false);
      };
    } catch (error) {
      alert('Terjadi kesalahan saat memproses file.');
      setIsExtracting(false);
    }
    
    // Reset input file agar file yang sama bisa diunggah lagi jika perlu
    e.target.value = '';
  };

  const printOptions: { scope: PrintScope; title: string; desc: string }[] = [
    { scope: 1, title: 'Semester 1 (Ganjil)', desc: `${SEMESTERS[1].rangeLabel}, 2 halaman` },
    { scope: 2, title: 'Semester 2 (Genap)', desc: `${SEMESTERS[2].rangeLabel}, 2 halaman` },
    { scope: 'all', title: 'Satu tahun pelajaran', desc: 'Kedua semester, 4 halaman' },
  ];

  const cfg = SEMESTERS[semester];

  return (
    <div className="kd-root min-h-screen bg-[#f3f5f4] px-3 py-5 text-slate-900 sm:px-5 md:px-8 md:py-8">
      <style>{GLOBAL_CSS}</style>

      <div className="mx-auto max-w-[1440px] space-y-5">
        {/* ── HERO ─────────────────────────────────────────────── */}
        <header className="relative rounded-[2rem] bg-[#0b3d33] text-white">
          <div
            className="absolute inset-0 overflow-hidden rounded-[2rem]"
            aria-hidden="true"
            style={{
              backgroundImage:
                'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.5px), radial-gradient(700px 320px at 100% 0%, rgba(52,211,153,0.28), transparent 65%)',
              backgroundSize: '20px 20px, 100% 100%',
            }}
          />

          <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-1 text-sm font-medium text-emerald-200/90">Referensi resmi Dinas Pendidikan</p>
                <label htmlFor="kd-year" className="sr-only">Tahun pelajaran</label>
                <select
                  id="kd-year"
                  value={currentYearId}
                  onChange={(e) => onYearChange(e.target.value)}
                  disabled={loading}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white outline-none ring-1 ring-inset ring-white/25 focus-visible:ring-2 focus-visible:ring-white [&>option]:text-slate-900"
                >
                  {years.map((id) => <option key={id} value={id}>Tahun pelajaran {id.replace('-', '/')}</option>)}
                </select>
                {isAdmin && (
                  <>
                    <button type="button" onClick={onEdit} disabled={loading || isExtracting} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#0b3d33] hover:bg-emerald-50 disabled:opacity-50">
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit kalender
                    </button>

                    {/* Tombol Impor AI Tersembunyi */}
                    <input 
                      type="file" 
                      accept=".pdf,image/png,image/jpeg,.csv" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                    />
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={loading || isExtracting} 
                      className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                    >
                      {isExtracting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {isExtracting ? 'Mengekstrak AI...' : 'Impor File Kaldik'}
                    </button>

                    <button type="button" onClick={onNewYear} disabled={loading || isExtracting} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/25 hover:bg-white/20 disabled:opacity-50">
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Tahun baru
                    </button>
                  </>
                )}
                {loading && <span className="text-xs text-emerald-200/80">Memuat…</span>}
              </div>
              {error && <p className="mt-3 text-xs font-semibold text-amber-200" role="alert">{error}</p>}
              {isAdmin && !persisted && !loading && (
                <p className="mt-3 max-w-xl rounded-xl bg-amber-300/15 px-3 py-2 text-xs leading-5 text-amber-100">
                  Data tahun ini masih bawaan aplikasi dan belum tersimpan di Firebase.{' '}
                  <button type="button" onClick={onPersist} className="font-bold underline underline-offset-2 hover:text-white">Simpan ke Firebase</button>
                </p>
              )}
              <h1 className="kd-display mt-3 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                Kalender Pendidikan Jawa Tengah
                <span className="block text-emerald-300/90">Tahun Pelajaran {doc.label}</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-emerald-50/75">
                Acuan hari efektif, pekan efektif, libur, dan kegiatan untuk menyusun Prota dan Promes.
              </p>

              <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <div>
                  <dt className="text-emerald-200/70">Hari efektif</dt>
                  <dd className="kd-display text-2xl font-semibold">{totalEffective || '–'}</dd>
                </div>
                <div>
                  <dt className="text-emerald-200/70">Hari libur tercatat</dt>
                  <dd className="kd-display text-2xl font-semibold">{LIBUR_DAYS}</dd>
                </div>
                <div>
                  <dt className="text-emerald-200/70">Kegiatan</dt>
                  <dd className="kd-display text-2xl font-semibold">{KEGIATAN.length}</dd>
                </div>
              </dl>
            </div>

            <div className="flex flex-col gap-4 lg:w-80">
              {nextEvent && (
                <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
                  <p className="text-xs text-emerald-200/80">Kegiatan berikutnya</p>
                  <p className="mt-1.5 text-sm font-semibold leading-snug">{nextEvent.activity}</p>
                  <p className="mt-1 text-xs text-emerald-100/70">{nextEvent.date}</p>
                </div>
              )}

              {/* Tombol cetak */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-bold text-[#0b3d33] transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Cetak atau simpan PDF
                  <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-40 mt-2 w-full min-w-[19rem] rounded-2xl bg-white p-2 text-slate-800 shadow-2xl ring-1 ring-slate-200"
                    >
                      {printOptions.map((opt) => (
                        <button
                          key={String(opt.scope)}
                          type="button"
                          role="menuitem"
                          onClick={() => handlePrint(opt.scope)}
                          className="flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition hover:bg-emerald-50"
                        >
                          <span className="text-sm font-semibold">{opt.title}</span>
                          <span className="text-xs text-slate-500">{opt.desc}</span>
                        </button>
                      ))}
                      <p className="border-t border-slate-100 px-3 pb-1.5 pt-2.5 text-xs leading-5 text-slate-500">
                        Di dialog cetak, pilih <b className="font-semibold text-slate-700">Simpan sebagai PDF</b> pada tujuan printer. Format kertas A4 lanskap sudah diatur otomatis.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── TAB ──────────────────────────────────────────────── */}
        <nav aria-label="Tampilan" className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
                  active ? 'bg-[#0b3d33] text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* ── RINGKASAN ────────────────────────────────────────── */}
        {activeTab === 'ringkasan' && (
          <div className="grid gap-5 md:grid-cols-2">
            {([1, 2] as SemesterId[]).map((sem) => {
              const rows = rowsOfSemester(sem);
              const max = Math.max(1, ...rows.map((r) => Number(r.jumlahHariEfektif) || 0));
              return (
                <section key={sem} className="rounded-[1.75rem] border border-slate-200 bg-white p-6">
                  <div className="mb-5 flex items-end justify-between gap-3 border-b border-dashed border-slate-200 pb-4">
                    <div>
                      <h2 className="kd-display text-2xl font-semibold text-[#0b3d33]">
                        {SEMESTERS[sem].name} ({SEMESTERS[sem].sub})
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">{SEMESTERS[sem].rangeLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="kd-display text-3xl font-semibold leading-none text-[#0b3d33]">{effectiveTotal(sem)}</p>
                      <p className="mt-1 text-xs text-slate-500">hari efektif</p>
                    </div>
                  </div>

                  <ul className="space-y-4">
                    {rows.map((row, idx) => {
                      const value = Number(row.jumlahHariEfektif) || 0;
                      return (
                        <li key={idx}>
                          <div className="mb-1.5 flex items-baseline justify-between gap-3">
                            <span className="text-sm font-semibold text-slate-800">{row.bulan}</span>
                            <span className="text-sm font-bold text-[#0b3d33]">{row.jumlahHariEfektif} hari <span className="font-medium text-slate-400">· {row.pekan} pekan</span></span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(value / max) * 100}%` }} />
                          </div>
                          {row.catatan && <p className="mt-1.5 text-xs text-slate-500">{row.catatan}</p>}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        {/* ── KALENDER VISUAL ──────────────────────────────────── */}
        {activeTab === 'kalender' && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
              <div role="tablist" aria-label="Pilih semester" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 lg:w-[26rem]">
                {([1, 2] as SemesterId[]).map((sem) => {
                  const active = semester === sem;
                  return (
                    <button
                      key={sem}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSemester(sem)}
                      className={`rounded-xl px-4 py-2.5 text-left transition ${active ? 'bg-white shadow-sm' : 'hover:bg-white/60'}`}
                    >
                      <span className={`block text-sm font-bold ${active ? 'text-[#0b3d33]' : 'text-slate-600'}`}>
                        {SEMESTERS[sem].name} ({SEMESTERS[sem].sub})
                      </span>
                      <span className="block text-xs text-slate-500">{SEMESTERS[sem].rangeLabel}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sorot jenis kegiatan">
                {TYPE_ORDER.map((t) => {
                  const meta = TYPE_META[t];
                  const Icon = meta.icon;
                  const active = highlight === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setHighlight(active ? null : t)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition"
                      style={{
                        background: active ? meta.solid : meta.bg,
                        color: active ? '#fff' : meta.fg,
                        boxShadow: `inset 0 0 0 1px ${active ? meta.solid : meta.border}`,
                        opacity: highlight && !active ? 0.55 : 1,
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {meta.label}
                      <span className="rounded-full bg-white/60 px-1.5 text-[10px]" style={active ? { background: 'rgba(255,255,255,0.25)' } : undefined}>
                        {typeCounts[t]}
                      </span>
                    </button>
                  );
                })}
                {highlight && (
                  <button
                    type="button"
                    onClick={() => setHighlight(null)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cfg.months.map(({ year, month }) => (
                <MonthCard key={`${year}-${month}`} year={year} month={month} today={today} highlight={highlight} />
              ))}
            </div>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="kd-display text-2xl font-semibold text-[#0b3d33]">
                  Kegiatan {cfg.name} ({cfg.sub})
                </h2>
                <p className="text-xs text-slate-500">
                  {visibleSemesterList.length} kegiatan{highlight ? `, jenis ${TYPE_META[highlight].label.toLowerCase()}` : ''}
                </p>
              </div>

              {visibleSemesterList.length > 0 ? (
                <ul className="grid gap-2.5 lg:grid-cols-2">
                  {visibleSemesterList.map((item, idx) => <EventRow key={idx} item={item} />)}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">
                  Belum ada kegiatan untuk pilihan ini. Pilih semester atau jenis lain.
                </p>
              )}
            </section>
          </div>
        )}

        {/* ── DAFTAR KEGIATAN ──────────────────────────────────── */}
        {activeTab === 'kegiatan' && (
          <div className="space-y-5">
            <div className="space-y-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 sm:p-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Cari nama kegiatan atau tanggal"
                  aria-label="Cari kegiatan"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter jenis">
                {(['all', ...TYPE_ORDER] as const).map((t) => {
                  const active = filterType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilterType(t)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        active ? 'bg-[#0b3d33] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {t === 'all' ? 'Semua jenis' : TYPE_META[t].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredKegiatan.length > 0 ? (
              <div className="space-y-6">
                {groupByMonth(filteredKegiatan).map((group) => (
                  <section key={group.label}>
                    <h2 className="kd-display mb-3 px-1 text-xl font-semibold text-[#0b3d33]">{group.label}</h2>
                    <ul className="grid gap-2.5 lg:grid-cols-2">
                      {group.items.map((item, idx) => <EventRow key={idx} item={item} />)}
                    </ul>
                  </section>
                ))}
                <p className="text-center text-xs text-slate-500">Total {filteredKegiatan.length} kegiatan</p>
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-10 text-center">
                <SearchX className="mx-auto mb-3 h-8 w-8 text-slate-300" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-700">Tidak ada kegiatan yang cocok</p>
                <p className="mt-1 text-xs text-slate-500">Coba kata kunci lain atau ubah filter jenis.</p>
                <button
                  type="button"
                  onClick={() => { setSearchKeyword(''); setFilterType('all'); }}
                  className="mt-4 rounded-full bg-[#0b3d33] px-4 py-2 text-xs font-bold text-white hover:bg-[#0f5244]"
                >
                  Hapus pencarian
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lembar cetak: hanya terlihat saat print, dipasang langsung di <body> */}
      {mounted && createPortal(<PrintSheet scope={printScope} />, document.body)}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Pemuat data (Firebase) + penyedia model
──────────────────────────────────────────────────────────────────────────── */

export default function KaldikJatengPage() {
  const isAdmin = useIsAdmin();
  const [years, setYears] = useState<string[]>([]);
  const [currentYearId, setCurrentYearId] = useState('');
  const [doc, setDoc] = useState<KaldikDoc>(() => emptyDoc(2026));
  const [persisted, setPersisted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  const model = useMemo(() => buildModel(doc), [doc]);

  const openYear = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    let found: KaldikDoc | null = null;
    try {
      found = await loadYear(id);
    } catch {
      setError('Gagal memuat dari Firebase. Menampilkan data yang tersedia di aplikasi.');
    }
    if (found) {
      setDoc(found);
      setPersisted(true);
    } else {
      setDoc(id === '2026-2027' ? fallbackDoc().doc : emptyDoc(startYearOf(id)));
      setPersisted(false);
    }
    setCurrentYearId(id);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      let ids: string[] = [];
      try {
        ids = await listYears();
      } catch {
        setError('Gagal memuat daftar tahun pelajaran dari Firebase.');
      }
      // Tahun bawaan tetap tersedia sampai disimpan ke Firebase.
      const list = Array.from(new Set(['2026-2027', ...ids])).sort();
      const now = new Date();
      const schoolYear = yearId(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);
      setYears(list);
      await openYear(list.includes(schoolYear) ? schoolYear : list[list.length - 1]);
    })();
  }, [openYear]);

  const handleSave = async (next: KaldikDoc) => {
    await saveYear(next);
    setDoc(next);
    setPersisted(true);
    setYears((ys) => Array.from(new Set([...ys, next.id])).sort());
    setCurrentYearId(next.id);
  };

  const handleNewYear = async () => {
    const latest = Math.max(...years.map(startYearOf), doc.startYear);
    const target = latest + 1;
    const label = `${target}/${target + 1}`;
    if (!window.confirm(`Buat tahun pelajaran ${label}? Kegiatan dari ${doc.label} akan disalin dengan tanggal digeser, lalu Anda bisa menyesuaikannya.`)) return;
    try {
      await handleSave(copyToYear(doc, target));
      setEditing(true);
    } catch {
      setError('Gagal membuat tahun pelajaran baru. Periksa izin akun Anda.');
    }
  };

  const handlePersist = async () => {
    try {
      await handleSave(doc);
    } catch {
      setError('Gagal menyimpan ke Firebase. Periksa izin akun Anda.');
    }
  };

  return (
    <KaldikContext.Provider value={model}>
      <KaldikView
        years={years} yearId={currentYearId} onYearChange={openYear}
        isAdmin={isAdmin} persisted={persisted} loading={loading} error={error}
        onEdit={() => setEditing(true)} onNewYear={handleNewYear} onPersist={handlePersist}
        doc={doc} setDoc={setDoc}
      />
      {editing && <EventEditor key={doc.id} doc={doc} onSave={handleSave} onClose={() => setEditing(false)} />}
    </KaldikContext.Provider>
  );
}