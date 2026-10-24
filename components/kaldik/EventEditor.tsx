'use client';
import { useMemo, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { EVENT_TYPES, EventType, KaldikDoc, KegiatanDoc, formatRange, fromISO, newId } from '@/lib/kaldik/model';

const TYPE_LABEL: Record<EventType, string> = {
  libur: 'Libur', upacara: 'Upacara', rapor: 'Rapor', tes: 'Tes / Akademik', kegiatan: 'Kegiatan',
};

interface FormState { id: string | null; activity: string; type: EventType; start: string; end: string; noClass: boolean }
const blankForm: FormState = { id: null, activity: '', type: 'kegiatan', start: '', end: '', noClass: false };

export default function EventEditor({ doc, onSave, onClose }: {
  doc: KaldikDoc;
  onSave: (doc: KaldikDoc) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<KaldikDoc>(doc);
  const [form, setForm] = useState<FormState>(blankForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const sorted = useMemo(() => [...draft.kegiatan].sort((a, b) => a.start.localeCompare(b.start)), [draft.kegiatan]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(doc);

  const submitForm = () => {
    if (!form.activity.trim()) return setFormError('Nama kegiatan wajib diisi.');
    if (!form.start) return setFormError('Tanggal mulai wajib diisi.');
    const end = form.end || form.start;
    if (end < form.start) return setFormError('Tanggal selesai tidak boleh sebelum tanggal mulai.');
    setFormError('');

    const item: KegiatanDoc = {
      id: form.id ?? newId(), activity: form.activity.trim(), type: form.type,
      start: form.start, end, noClass: form.noClass,
    };
    setDraft((d) => ({
      ...d,
      kegiatan: form.id ? d.kegiatan.map((k) => (k.id === form.id ? item : k)) : [...d.kegiatan, item],
    }));
    setForm(blankForm);
  };

  const editItem = (k: KegiatanDoc) =>
    setForm({ id: k.id, activity: k.activity, type: k.type, start: k.start, end: k.end === k.start ? '' : k.end, noClass: k.noClass });

  const removeItem = (id: string) => {
    setDraft((d) => ({ ...d, kegiatan: d.kegiatan.filter((k) => k.id !== id) }));
    if (form.id === id) setForm(blankForm);
  };

  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await onSave(draft);
      onClose();
    } catch (e) {
      setSaveError('Gagal menyimpan. Periksa koneksi dan izin akun Anda, lalu coba lagi.');
      setSaving(false);
    }
  };

  const close = () => {
    if (dirty && !window.confirm('Perubahan belum disimpan. Tutup tanpa menyimpan?')) return;
    onClose();
  };

  const input = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Edit kalender pendidikan">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-[1.75rem]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit kalender {draft.label}</h2>
            <p className="mt-0.5 text-xs text-slate-500">Perubahan baru tersimpan setelah Anda menekan Simpan perubahan.</p>
          </div>
          <button type="button" onClick={close} aria-label="Tutup" className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid flex-1 gap-6 overflow-y-auto p-5 lg:grid-cols-[22rem_1fr]">
          {/* Form */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800">{form.id ? 'Ubah kegiatan' : 'Tambah kegiatan'}</h3>

            <label className="block text-xs font-semibold text-slate-600">
              Nama kegiatan
              <input className={`${input} mt-1 font-normal`} value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} placeholder="Contoh: Penilaian Akhir Semester" />
            </label>

            <label className="block text-xs font-semibold text-slate-600">
              Jenis
              <select
                className={`${input} mt-1 font-normal`}
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value as EventType;
                  setForm({ ...form, type, noClass: type === 'libur' ? true : form.noClass });
                }}
              >
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-600">
                Tanggal mulai
                <input type="date" className={`${input} mt-1 font-normal`} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Tanggal selesai
                <input type="date" className={`${input} mt-1 font-normal`} value={form.end} min={form.start || undefined} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </label>
            </div>
            <p className="-mt-1 text-xs text-slate-500">Kosongkan tanggal selesai untuk kegiatan satu hari.</p>

            <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-700" checked={form.noClass} onChange={(e) => setForm({ ...form, noClass: e.target.checked })} />
              <span>
                <b className="block text-slate-900">Tanpa pembelajaran</b>
                Hari ini tidak dihitung sebagai hari efektif. Libur otomatis tercentang.
              </span>
            </label>

            {formError && <p className="text-xs font-semibold text-rose-600" role="alert">{formError}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={submitForm} className="flex-1 rounded-xl bg-[#0b3d33] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0f5244]">
                {form.id ? 'Terapkan perubahan' : 'Tambahkan'}
              </button>
              {form.id && (
                <button type="button" onClick={() => { setForm(blankForm); setFormError(''); }} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                  Batal
                </button>
              )}
            </div>

            <fieldset className="border-t border-dashed border-slate-200 pt-4">
              <legend className="mb-2 text-sm font-bold text-slate-800">Hari sekolah per pekan</legend>
              <div className="grid grid-cols-2 gap-2">
                {([5, 6] as const).map((n) => (
                  <label key={n} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-semibold ${draft.hariSekolah === n ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-600'}`}>
                    <input type="radio" name="hari" className="sr-only" checked={draft.hariSekolah === n} onChange={() => setDraft({ ...draft, hariSekolah: n })} />
                    {n} hari {n === 5 ? '(Sen–Jum)' : '(Sen–Sab)'}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">Dipakai untuk menghitung hari dan pekan efektif secara otomatis.</p>
            </fieldset>
          </section>

          {/* Daftar */}
          <section>
            <h3 className="mb-3 text-sm font-bold text-slate-800">Daftar kegiatan ({sorted.length})</h3>
            {sorted.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                Belum ada kegiatan. Tambahkan lewat form di samping.
              </p>
            ) : (
              <ul className="space-y-2">
                {sorted.map((k) => (
                  <li key={k.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${form.id === k.id ? 'border-emerald-600 bg-emerald-50/50' : 'border-slate-200'}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-slate-900">{k.activity}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatRange(fromISO(k.start), fromISO(k.end))} · {TYPE_LABEL[k.type]}{k.noClass ? ' · tanpa pembelajaran' : ''}
                      </p>
                    </div>
                    <button type="button" onClick={() => editItem(k)} aria-label={`Ubah ${k.activity}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => removeItem(k.id)} aria-label={`Hapus ${k.activity}`} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-rose-600" role="alert">{saveError}</p>
          <div className="flex gap-2">
            <button type="button" onClick={close} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200">Tutup</button>
            <button type="button" onClick={save} disabled={saving || !dirty} className="rounded-xl bg-[#0b3d33] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0f5244] disabled:opacity-40">
              {saving ? 'Menyimpan…' : 'Simpan perubahan'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
