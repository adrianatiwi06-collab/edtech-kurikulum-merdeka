'use client';

import {
  useMemo,
  useState,
} from 'react';

import {
  useAuth,
} from '@/contexts/AuthContext';

import {
  db,
} from '@/lib/firebase';

import {
  addDoc,
  collection,
} from 'firebase/firestore';

import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from 'framer-motion';

import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit2,
  FileText,
  FileUp,
  FolderOpen,
  GraduationCap,
  Info,
  Loader2,
  MoveRight,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  X,
  WandSparkles,
} from 'lucide-react';

import {
  Button,
} from '@/components/ui/button';

import {
  Input,
} from '@/components/ui/input';

import {
  Card,
} from '@/components/ui/card';

import {
  QuotaMonitor,
} from '@/components/QuotaMonitor';

import {
  toast,
} from 'sonner';

/* =========================================================
   TYPES
========================================================= */

interface TPItem {
  chapter: string;
  tps: string[];
  selected: boolean[];
}

interface GeneratedTP {
  semester1: TPItem[];
  semester2: TPItem[];
}

type Step =
  | 'source'
  | 'context'
  | 'settings';

/* =========================================================
   ANIMATION
========================================================= */

const sectionVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 14,
    scale: 0.985,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const listVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.045,
    },
  },
};

/* =========================================================
   COMPONENT
========================================================= */

export default function GenerateTPPage() {
  const {
    user,
  } = useAuth();

  const reduceMotion = useReducedMotion();

  /* =======================================================
     FORM STATE
  ======================================================= */

  const [inputMethod, setInputMethod] =
    useState<'text' | 'pdf'>('text');

  const [textContent, setTextContent] =
    useState('');

  const [grade, setGrade] =
    useState('');

  const [subject, setSubject] =
    useState('');

  const [cpReference, setCpReference] =
    useState('');

  const [pdfFile, setPdfFile] =
    useState<File | null>(null);

  const [semesterSelection, setSemesterSelection] =
    useState('both');

  const [materiPokok, setMateriPokok] =
    useState('');

  const [maxLength100, setMaxLength100] =
    useState(false);

  /* =======================================================
     PROCESS STATE
  ======================================================= */

  const [loading, setLoading] =
    useState(false);

  const [loadingMessage, setLoadingMessage] =
    useState('');

  const [generatedTP, setGeneratedTP] =
    useState<GeneratedTP | null>(null);

  const [error, setError] =
    useState('');

  /* =======================================================
     EDIT STATE
  ======================================================= */

  const [editingChapter, setEditingChapter] =
    useState<string | null>(null);

  const [editChapterName, setEditChapterName] =
    useState('');

  const [editingTP, setEditingTP] =
    useState<{
      semester: number;
      chapterIdx: number;
      tpIdx: number;
    } | null>(null);

  const [editTPText, setEditTPText] =
    useState('');

  /* =======================================================
     CURRENT STEP
  ======================================================= */

  const currentStep: Step = generatedTP
    ? 'settings'
    : inputMethod === 'pdf' || inputMethod === 'text'
      ? cpReference
        ? 'settings'
        : grade
          ? 'context'
          : 'source'
      : 'source';

  /* =======================================================
     SUBJECTS
  ======================================================= */

  const sdSubjects = [
    'Pendidikan Agama Islam',
    'Pendidikan Agama Kristen',
    'Pendidikan Agama Katolik',
    'Pendidikan Agama Hindu',
    'Pendidikan Agama Buddha',
    'Pendidikan Agama Khonghucu',
    'Pendidikan Pancasila',
    'Bahasa Indonesia',
    'Matematika',
    'IPAS (Ilmu Pengetahuan Alam dan Sosial)',
    'Pendidikan Jasmani Olahraga dan Kesehatan (PJOK)',
    'Seni dan Budaya',
    'Bahasa Inggris',
    'Bahasa Daerah',
    'Seni Rupa',
    'Seni Musik',
    'Seni Tari',
    'Seni Teater',
  ];

  const isSD =
    grade &&
    parseInt(grade) >= 1 &&
    parseInt(grade) <= 6;

  /* =======================================================
     COUNTERS
  ======================================================= */

  const selectedCount =
    generatedTP?.semester1.reduce(
      (total, chapter) =>
        total +
        chapter.selected.filter(Boolean).length,
      0
    ) || 0;

  const selectedCountSemester2 =
    generatedTP?.semester2.reduce(
      (total, chapter) =>
        total +
        chapter.selected.filter(Boolean).length,
      0
    ) || 0;

  const totalTP =
    generatedTP
      ? generatedTP.semester1.reduce(
          (total, chapter) =>
            total + chapter.tps.length,
          0
        ) +
        generatedTP.semester2.reduce(
          (total, chapter) =>
            total + chapter.tps.length,
          0
        )
      : 0;

  const selectedTotal =
    selectedCount +
    selectedCountSemester2;

  /* =======================================================
     STEP
  ======================================================= */

  const steps = [
    {
      id: 'source',
      number: 1,
      title: 'Sumber Materi',
      description: 'Teks atau PDF',
    },
    {
      id: 'context',
      number: 2,
      title: 'Konteks',
      description: 'Kelas & CP',
    },
    {
      id: 'settings',
      number: 3,
      title: 'Generate',
      description: 'Preferensi AI',
    },
  ];

  /* =======================================================
     GENERATE
  ======================================================= */

  const handleGenerate = async () => {
    if (!user) {
      setError('User tidak ditemukan');
      return;
    }

    if (!grade || !cpReference) {
      setError(
        'Mohon lengkapi kelas/fase dan referensi CP.'
      );
      return;
    }

    if (isSD && !subject) {
      setError(
        'Mohon pilih mata pelajaran untuk kelas SD.'
      );
      return;
    }

    if (
      inputMethod === 'text' &&
      !textContent.trim()
    ) {
      setError(
        'Mohon masukkan teks materi pembelajaran.'
      );
      return;
    }

    if (
      inputMethod === 'pdf' &&
      !pdfFile
    ) {
      setError(
        'Mohon upload file PDF.'
      );
      return;
    }

    if (
      cpReference.trim().length < 50
    ) {
      setError(
        'Referensi CP minimal 50 karakter.'
      );
      return;
    }

    if (
      inputMethod === 'text' &&
      textContent.trim().length < 100
    ) {
      setError(
        'Materi pembelajaran minimal 100 karakter.'
      );
      return;
    }

    if (
      pdfFile &&
      pdfFile.size >
        10 * 1024 * 1024
    ) {
      setError(
        'Ukuran PDF maksimal 10 MB.'
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      let pdfBase64 = '';

      if (inputMethod === 'pdf') {
        setLoadingMessage(
          'Membaca file PDF...'
        );

        const arrayBuffer =
          await pdfFile!.arrayBuffer();

        const bytes =
          new Uint8Array(
            arrayBuffer
          );

        let binary = '';

        for (
          let index = 0;
          index < bytes.length;
          index++
        ) {
          binary += String.fromCharCode(
            bytes[index]
          );
        }

        pdfBase64 =
          btoa(binary);

        setLoadingMessage(
          'PDF berhasil dibaca, sedang menganalisis...'
        );
      } else {
        setLoadingMessage(
          'Sedang menganalisis materi...'
        );
      }

      const token =
        await user.getIdToken();

      setLoadingMessage(
        'AI sedang menyusun Tujuan Pembelajaran...'
      );

      const response =
        await fetch(
          '/api/generate-tp',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
              Authorization:
                `Bearer ${token}`,
            },
            body: JSON.stringify({
              textContent:
                inputMethod === 'text'
                  ? textContent
                  : '',
              pdfBase64,
              grade,
              subject:
                isSD
                  ? subject
                  : '',
              cpReference,
              maxLength100,
              semesterSelection,
              materiPokok,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        if (result.quotaInfo) {
          setError(
            `${result.error}\n\n💡 Saran: ${result.quotaInfo.suggestion}`
          );
        } else {
          throw new Error(
            result.error ||
              'Gagal generate TP'
          );
        }

        return;
      }

      if (!result.success) {
        setError(
          result.error ||
            'Gagal generate TP'
        );

        return;
      }

      const processedData: GeneratedTP = {
        semester1:
          (result.data.semester1 || []).map(
            (item: any) => ({
              ...item,
              selected:
                item.tps.map(
                  () => true
                ),
            })
          ),

        semester2:
          (result.data.semester2 || []).map(
            (item: any) => ({
              ...item,
              selected:
                item.tps.map(
                  () => true
                ),
            })
          ),
      };

      setGeneratedTP(
        processedData
      );

      toast.success(
        'Tujuan Pembelajaran berhasil dibuat',
        {
          description:
            'Review hasil AI sebelum menyimpan ke database.',
        }
      );

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch (err: any) {
      setError(
        err?.message ||
          'Terjadi kesalahan saat generate TP.'
      );
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  /* =======================================================
     TP SELECTION
  ======================================================= */

  const toggleTPSelection = (
    semester: 1 | 2,
    chapterIdx: number,
    tpIdx: number
  ) => {
    if (!generatedTP) return;

    const semesterKey =
      semester === 1
        ? 'semester1'
        : 'semester2';

    const updated: GeneratedTP =
      structuredClone(
        generatedTP
      );

    updated[semesterKey][
      chapterIdx
    ].selected[tpIdx] =
      !updated[semesterKey][
        chapterIdx
      ].selected[tpIdx];

    setGeneratedTP(
      updated
    );
  };

  /* =======================================================
     EDIT CHAPTER
  ======================================================= */

  const handleEditChapter = (
    semester: 1 | 2,
    chapterIdx: number
  ) => {
    if (!generatedTP) return;

    const semesterKey =
      semester === 1
        ? 'semester1'
        : 'semester2';

    const chapter =
      generatedTP[
        semesterKey
      ][chapterIdx];

    setEditingChapter(
      `${semester}-${chapterIdx}`
    );

    setEditChapterName(
      chapter.chapter
    );
  };

  const saveChapterEdit = (
    semester: 1 | 2,
    chapterIdx: number
  ) => {
    if (!generatedTP) return;

    const semesterKey =
      semester === 1
        ? 'semester1'
        : 'semester2';

    const updated: GeneratedTP =
      structuredClone(
        generatedTP
      );

    updated[
      semesterKey
    ][chapterIdx].chapter =
      editChapterName.trim() ||
      updated[
        semesterKey
      ][chapterIdx].chapter;

    setGeneratedTP(
      updated
    );

    setEditingChapter(null);
  };

  /* =======================================================
     EDIT TP
  ======================================================= */

  const handleEditTP = (
    semester: 1 | 2,
    chapterIdx: number,
    tpIdx: number
  ) => {
    if (!generatedTP) return;

    const semesterKey =
      semester === 1
        ? 'semester1'
        : 'semester2';

    const tp =
      generatedTP[
        semesterKey
      ][chapterIdx]
        .tps[tpIdx];

    setEditingTP({
      semester,
      chapterIdx,
      tpIdx,
    });

    setEditTPText(tp);
  };

  const saveTPEdit = () => {
    if (
      !generatedTP ||
      !editingTP
    ) {
      return;
    }

    const semesterKey =
      editingTP.semester === 1
        ? 'semester1'
        : 'semester2';

    const updated: GeneratedTP =
      structuredClone(
        generatedTP
      );

    updated[
      semesterKey
    ][
      editingTP.chapterIdx
    ].tps[
      editingTP.tpIdx
    ] =
      editTPText.trim();

    setGeneratedTP(
      updated
    );

    setEditingTP(null);
  };

  /* =======================================================
     DELETE TP
  ======================================================= */

  const deleteTP = (
    semester: 1 | 2,
    chapterIdx: number,
    tpIdx: number
  ) => {
    if (!generatedTP) return;

    const confirmed =
      window.confirm(
        'Hapus TP ini?'
      );

    if (!confirmed) {
      return;
    }

    const semesterKey =
      semester === 1
        ? 'semester1'
        : 'semester2';

    const updated: GeneratedTP =
      structuredClone(
        generatedTP
      );

    updated[
      semesterKey
    ][chapterIdx].tps.splice(
      tpIdx,
      1
    );

    updated[
      semesterKey
    ][chapterIdx].selected.splice(
      tpIdx,
      1
    );

    if (
      updated[
        semesterKey
      ][chapterIdx].tps.length ===
      0
    ) {
      updated[
        semesterKey
      ].splice(
        chapterIdx,
        1
      );
    }

    setGeneratedTP(
      updated
    );
  };

  /* =======================================================
     DELETE CHAPTER
  ======================================================= */

  const deleteChapter = (
    semester: 1 | 2,
    chapterIdx: number
  ) => {
    if (!generatedTP) return;

    const semesterKey =
      semester === 1
        ? 'semester1'
        : 'semester2';

    const chapter =
      generatedTP[
        semesterKey
      ][chapterIdx];

    const confirmed =
      window.confirm(
        `Hapus bab "${chapter.chapter}" beserta ${chapter.tps.length} TP di dalamnya?`
      );

    if (!confirmed) {
      return;
    }

    const updated: GeneratedTP =
      structuredClone(
        generatedTP
      );

    updated[
      semesterKey
    ].splice(
      chapterIdx,
      1
    );

    setGeneratedTP(
      updated
    );
  };

  /* =======================================================
     MOVE CHAPTER
  ======================================================= */

  const moveChapter = (
    fromSemester: 1 | 2,
    chapterIdx: number,
    toSemester: 1 | 2
  ) => {
    if (
      !generatedTP ||
      fromSemester ===
        toSemester
    ) {
      return;
    }

    const fromKey =
      fromSemester === 1
        ? 'semester1'
        : 'semester2';

    const toKey =
      toSemester === 1
        ? 'semester1'
        : 'semester2';

    const chapter =
      generatedTP[fromKey][
        chapterIdx
      ];

    const confirmed =
      window.confirm(
        `Pindahkan bab "${chapter.chapter}" dari Semester ${fromSemester} ke Semester ${toSemester}?`
      );

    if (!confirmed) {
      return;
    }

    const updated: GeneratedTP =
      structuredClone(
        generatedTP
      );

    updated[
      fromKey
    ].splice(
      chapterIdx,
      1
    );

    updated[
      toKey
    ].push(chapter);

    setGeneratedTP(
      updated
    );
  };

  /* =======================================================
     SAVE DATABASE
  ======================================================= */

  const handleSaveToDatabase =
    async () => {
      if (
        !user ||
        !generatedTP
      ) {
        return;
      }

      if (
        selectedTotal === 0
      ) {
        setError(
          'Pilih minimal satu TP untuk disimpan.'
        );
        return;
      }

      setLoading(true);
      setError('');

      try {
        const selectedTPs: any[] =
          [];

        generatedTP.semester1.forEach(
          (chapter) => {
            chapter.tps.forEach(
              (
                tp,
                index
              ) => {
                if (
                  chapter.selected[
                    index
                  ]
                ) {
                  selectedTPs.push({
                    chapter:
                      chapter.chapter,
                    tp,
                    semester:
                      1,
                    grade,
                    subject:
                      isSD
                        ? subject
                        : '',
                    cpReference,
                  });
                }
              }
            );
          }
        );

        generatedTP.semester2.forEach(
          (chapter) => {
            chapter.tps.forEach(
              (
                tp,
                index
              ) => {
                if (
                  chapter.selected[
                    index
                  ]
                ) {
                  selectedTPs.push({
                    chapter:
                      chapter.chapter,
                    tp,
                    semester:
                      2,
                    grade,
                    subject:
                      isSD
                        ? subject
                        : '',
                    cpReference,
                  });
                }
              }
            );
          }
        );

        for (
          const tpData of selectedTPs
        ) {
          await addDoc(
            collection(
              db,
              'learning_goals'
            ),
            {
              ...tpData,
              user_id:
                user.uid,
              created_at:
                new Date().toISOString(),
              isRaporFormat:
                maxLength100,
            }
          );
        }

        toast.success(
          'Tujuan Pembelajaran tersimpan',
          {
            description:
              `${selectedTPs.length} TP berhasil disimpan ke database.`,
          }
        );

        setGeneratedTP(null);
        setTextContent('');
        setGrade('');
        setSubject('');
        setCpReference('');
        setMateriPokok('');
        setPdfFile(null);
        setError('');
      } catch (err: any) {
        setError(
          err?.message ||
            'Gagal menyimpan ke database.'
        );
      } finally {
        setLoading(false);
      }
    };

  /* =======================================================
     RESET
  ======================================================= */

  const resetGeneration =
    () => {
      setGeneratedTP(null);
      setError('');
      setLoadingMessage('');
      setEditingChapter(null);
      setEditingTP(null);

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    };

  /* =======================================================
     UTILITIES
  ======================================================= */

  const progress =
    Math.min(
      100,
      Math.round(
        (cpReference.length /
          50) *
          100
      )
    );

  const inputProgress =
    Math.min(
      100,
      Math.round(
        (textContent.length /
          100) *
          100
      )
    );

  const semesterItems =
    useMemo(() => {
      if (!generatedTP) {
        return [];
      }

      const semester1 =
        generatedTP.semester1;

      const semester2 =
        generatedTP.semester2;

      return [
        {
          semester: 1,
          chapters:
            semester1.length,
          tpCount:
            semester1.reduce(
              (total, item) =>
                total +
                item.tps.length,
              0
            ),
          selected:
            semester1.reduce(
              (total, item) =>
                total +
                item.selected.filter(
                  Boolean
                ).length,
              0
            ),
        },
        {
          semester: 2,
          chapters:
            semester2.length,
          tpCount:
            semester2.reduce(
              (total, item) =>
                total +
                item.tps.length,
              0
            ),
          selected:
            semester2.reduce(
              (total, item) =>
                total +
                item.selected.filter(
                  Boolean
                ).length,
              0
            ),
        },
      ];
    }, [
      generatedTP,
    ]);

  /* =======================================================
     RENDER SEMESTER
  ======================================================= */

  const renderSemesterSection = (
    semester: 1 | 2
  ) => {
    if (!generatedTP) {
      return null;
    }

    const semesterKey =
      semester === 1
        ? 'semester1'
        : 'semester2';

    const items =
      generatedTP[
        semesterKey
      ];

    return (
      <motion.section
        variants={
          reduceMotion
            ? undefined
            : sectionVariants
        }
        initial={
          reduceMotion
            ? false
            : 'hidden'
        }
        whileInView={
          reduceMotion
            ? undefined
            : 'visible'
        }
        viewport={{
          once: true,
          amount: 0.1,
        }}
        className="rounded-[30px] border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.05)]"
      >
        <div className="border-b border-slate-100 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <BookOpen className="h-5 w-5" />
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Semester {semester}
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  {items.length}{' '}
                  bab ·{' '}
                  {items.reduce(
                    (total, chapter) =>
                      total +
                      chapter.tps.length,
                    0
                  )}{' '}
                  TP
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                {
                  semesterItems.find(
                    (item) =>
                      item.semester ===
                      semester
                  )?.selected
                }{' '}
                dipilih
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
                {items.length} bab
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
              <p className="text-sm font-semibold text-slate-500">
                Belum ada bab pada semester ini.
              </p>
            </div>
          ) : (
            items.map(
              (
                chapter,
                chapterIdx
              ) => (
                <motion.div
                  key={`${semester}-${chapterIdx}-${chapter.chapter}`}
                  initial={
                    reduceMotion
                      ? false
                      : {
                          opacity: 0,
                          y: 10,
                        }
                  }
                  whileInView={
                    reduceMotion
                      ? undefined
                      : {
                          opacity: 1,
                          y: 0,
                        }
                  }
                  viewport={{
                    once: true,
                  }}
                  transition={{
                    duration: 0.35,
                  }}
                  className="overflow-hidden rounded-[24px] border border-slate-200"
                >
                  {/* CHAPTER HEADER */}
                  <div className="flex flex-col gap-3 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    {editingChapter ===
                    `${semester}-${chapterIdx}` ? (
                      <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                        <Input
                          value={
                            editChapterName
                          }
                          onChange={(
                            event
                          ) =>
                            setEditChapterName(
                              event.target.value
                            )
                          }
                          className="flex-1 rounded-xl border-slate-200"
                          autoFocus
                        />

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              saveChapterEdit(
                                semester,
                                chapterIdx
                              )
                            }
                            className="rounded-xl"
                          >
                            <Check className="mr-1.5 h-4 w-4" />
                            Simpan
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setEditingChapter(
                                null
                              )
                            }
                            className="rounded-xl"
                          >
                            Batal
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-xs font-black text-blue-600 shadow-sm">
                            {chapterIdx +
                              1}
                          </div>

                          <div>
                            <h4 className="font-bold text-slate-900">
                              {chapter.chapter}
                            </h4>

                            <p className="mt-1 text-xs text-slate-400">
                              {chapter.tps.length}{' '}
                              TP pada bab ini
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              moveChapter(
                                semester,
                                chapterIdx,
                                semester ===
                                  1
                                  ? 2
                                  : 1
                              )
                            }
                            className="rounded-xl"
                            title={`Pindah ke Semester ${
                              semester ===
                              1
                                ? 2
                                : 1
                            }`}
                          >
                            <MoveRight className="mr-1.5 h-4 w-4" />

                            S
                            {semester ===
                            1
                              ? 2
                              : 1}
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              handleEditChapter(
                                semester,
                                chapterIdx
                              )
                            }
                            className="rounded-xl text-slate-500 hover:bg-white"
                            title="Edit nama bab"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              deleteChapter(
                                semester,
                                chapterIdx
                              )
                            }
                            className="rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600"
                            title="Hapus bab"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* TP LIST */}
                  <motion.div
                    variants={
                      reduceMotion
                        ? undefined
                        : listVariants
                    }
                    initial={
                      reduceMotion
                        ? false
                        : 'hidden'
                    }
                    animate={
                      reduceMotion
                        ? undefined
                        : 'visible'
                    }
                    className="divide-y divide-slate-100"
                  >
                    {chapter.tps.map(
                      (
                        tp,
                        tpIdx
                      ) => {
                        const selected =
                          chapter.selected[
                            tpIdx
                          ];

                        const isEditing =
                          editingTP?.semester ===
                            semester &&
                          editingTP?.chapterIdx ===
                            chapterIdx &&
                          editingTP?.tpIdx ===
                            tpIdx;

                        return (
                          <motion.div
                            key={`${semester}-${chapterIdx}-${tpIdx}`}
                            variants={
                              reduceMotion
                                ? undefined
                                : {
                                    hidden: {
                                      opacity: 0,
                                      x: -6,
                                    },
                                    visible: {
                                      opacity: 1,
                                      x: 0,
                                    },
                                  }
                            }
                            className={`group flex items-start gap-3 p-4 transition-colors ${
                              selected
                                ? 'bg-white'
                                : 'bg-slate-50/50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                toggleTPSelection(
                                  semester,
                                  chapterIdx,
                                  tpIdx
                                )
                              }
                              className={`
                                mt-0.5
                                flex
                                h-5
                                w-5
                                shrink-0
                                items-center
                                justify-center
                                rounded-md
                                border
                                transition-all
                                ${
                                  selected
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-slate-300 bg-white text-transparent'
                                }
                              `}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>

                            {isEditing ? (
                              <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <textarea
                                  value={
                                    editTPText
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setEditTPText(
                                      event.target.value
                                    )
                                  }
                                  rows={4}
                                  autoFocus
                                  className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                                />

                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={
                                      saveTPEdit
                                    }
                                    className="rounded-xl"
                                  >
                                    <Check className="mr-1.5 h-4 w-4" />
                                    Simpan perubahan
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setEditingTP(
                                        null
                                      )
                                    }
                                    className="rounded-xl"
                                  >
                                    Batal
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`text-sm leading-6 ${
                                      selected
                                        ? 'text-slate-700'
                                        : 'text-slate-400 line-through'
                                    }`}
                                  >
                                    {tp}
                                  </p>

                                  {maxLength100 && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <span
                                        className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                          tp.length <=
                                          100
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-red-50 text-red-700'
                                        }`}
                                      >
                                        {tp.length}{' '}
                                        karakter
                                      </span>

                                      {tp.length >
                                        100 && (
                                        <span className="text-[10px] font-semibold text-red-500">
                                          Melebihi batas 100 karakter
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() =>
                                      handleEditTP(
                                        semester,
                                        chapterIdx,
                                        tpIdx
                                      )
                                    }
                                    className="rounded-xl text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                    title="Edit TP"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>

                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() =>
                                      deleteTP(
                                        semester,
                                        chapterIdx,
                                        tpIdx
                                      )
                                    }
                                    className="rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
                                    title="Hapus TP"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </>
                            )}
                          </motion.div>
                        );
                      }
                    )}
                  </motion.div>
                </motion.div>
              )
            )
          )}
        </div>
      </motion.section>
    );
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <motion.div
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
            }
      }
      animate={
        reduceMotion
          ? undefined
          : {
              opacity: 1,
            }
      }
      className="space-y-7"
    >

      {/* ===================================================
          PAGE HEADER
      ================================================== */}

      <motion.section
        variants={
          reduceMotion
            ? undefined
            : sectionVariants
        }
        initial={
          reduceMotion
            ? false
            : 'hidden'
        }
        animate={
          reduceMotion
            ? undefined
            : 'visible'
        }
        className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] sm:p-8"
      >
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-60 w-60 rounded-full bg-violet-100/50 blur-3xl" />

        <div className="relative">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                <Sparkles className="h-3.5 w-3.5" />
                AI Teaching Workspace
              </div>

              <h1 className="max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Generate Tujuan Pembelajaran
                <span className="block bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">
                  dengan bantuan AI
                </span>
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Ubah materi pembelajaran menjadi
                Tujuan Pembelajaran yang lebih terstruktur,
                relevan, dan siap direview.
              </p>
            </div>

            <div className="min-w-[220px]">
              <QuotaMonitor />
            </div>
          </div>

          {/* STEP INDICATOR */}
          {!generatedTP && (
            <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
              {steps.map(
                (step, index) => {
                  const active =
                    step.id ===
                    currentStep;

                  const completed =
                    index <
                    steps.findIndex(
                      (item) =>
                        item.id ===
                        currentStep
                    );

                  return (
                    <motion.div
                      key={step.id}
                      whileHover={
                        reduceMotion
                          ? undefined
                          : {
                              y: -2,
                            }
                      }
                      className={`rounded-2xl border p-4 transition-all ${
                        active
                          ? 'border-blue-200 bg-blue-50'
                          : completed
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black ${
                            active
                              ? 'bg-blue-600 text-white'
                              : completed
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white text-slate-400'
                          }`}
                        >
                          {completed ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            step.number
                          )}
                        </div>

                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {step.title}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-400">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </motion.section>

      {/* ===================================================
          GENERATED RESULT
      ================================================== */}

      {generatedTP ? (
        <motion.div
          initial={
            reduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 20,
                }
          }
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: 1,
                  y: 0,
                }
          }
          className="space-y-6"
        >

          {/* RESULT HEADER */}
          <section className="rounded-[30px] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Generate selesai
                </div>

                <h2 className="mt-4 text-2xl font-black text-slate-950 sm:text-3xl">
                  Review hasil Tujuan Pembelajaran
                </h2>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
                    Kelas {grade}
                  </span>

                  {isSD &&
                    subject && (
                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
                        {subject}
                      </span>
                    )}

                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
                    {semesterSelection ===
                    'both'
                      ? 'Semester 1 & 2'
                      : semesterSelection ===
                          'semester1'
                        ? 'Semester 1'
                        : 'Semester 2'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
                  <p className="text-2xl font-black text-slate-900">
                    {totalTP}
                  </p>

                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    Total TP
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
                  <p className="text-2xl font-black text-emerald-600">
                    {selectedTotal}
                  </p>

                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    Dipilih
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
                  <p className="text-2xl font-black text-blue-600">
                    {semesterItems[0]?.chapters +
                      semesterItems[1]?.chapters}
                  </p>

                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    Bab
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
                  <p className="text-2xl font-black text-violet-600">
                    {maxLength100
                      ? '≤100'
                      : 'AI'}
                  </p>

                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    Format
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ERRORS */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: -6,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -6,
                }}
                className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700 whitespace-pre-line"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* SEMESTERS */}
          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            {(semesterSelection ===
              'both' ||
              semesterSelection ===
                'semester1') &&
              renderSemesterSection(
                1
              )}

            {(semesterSelection ===
              'both' ||
              semesterSelection ===
                'semester2') &&
              renderSemesterSection(
                2
              )}
          </div>

          {/* ACTION BAR */}
          <div className="sticky bottom-4 z-20">
            <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 px-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {selectedTotal} TP siap disimpan
                  </p>

                  <p className="text-[10px] text-slate-400">
                    Anda dapat mengedit kembali sebelum menyimpan.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={
                    resetGeneration
                  }
                  disabled={loading}
                  className="rounded-xl"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Baru
                </Button>

                <Button
                  size="lg"
                  onClick={
                    handleSaveToDatabase
                  }
                  disabled={
                    loading ||
                    selectedTotal ===
                      0
                  }
                  className="rounded-xl bg-slate-950 hover:bg-slate-800"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Simpan TP Terpilih
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <>
          {/* =================================================
              FORM WORKSPACE
          ================================================= */}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">

            {/* LEFT */}
            <motion.div
              variants={
                reduceMotion
                  ? undefined
                  : sectionVariants
              }
              initial={
                reduceMotion
                  ? false
                  : 'hidden'
              }
              animate={
                reduceMotion
                  ? undefined
                  : 'visible'
              }
              className="space-y-6"
            >

              {/* SOURCE */}
              <Card className="overflow-hidden rounded-[30px] border-slate-200 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
                <div className="border-b border-slate-100 p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        Langkah 1
                      </p>

                      <h2 className="mt-1 text-xl font-black text-slate-900">
                        Sumber materi
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Pilih bagaimana AI mendapatkan materi.
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <motion.button
                      type="button"
                      whileHover={
                        reduceMotion
                          ? undefined
                          : {
                              y: -2,
                            }
                      }
                      whileTap={
                        reduceMotion
                          ? undefined
                          : {
                              scale: 0.98,
                            }
                      }
                      onClick={() =>
                        setInputMethod(
                          'text'
                        )
                      }
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        inputMethod ===
                        'text'
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                        inputMethod ===
                        'text'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        <BookOpen className="h-5 w-5" />
                      </div>

                      <p className="text-sm font-bold text-slate-800">
                        Input Teks
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        Paste materi langsung ke editor.
                      </p>
                    </motion.button>

                    <motion.button
                      type="button"
                      whileHover={
                        reduceMotion
                          ? undefined
                          : {
                              y: -2,
                            }
                      }
                      whileTap={
                        reduceMotion
                          ? undefined
                          : {
                              scale: 0.98,
                            }
                      }
                      onClick={() =>
                        setInputMethod(
                          'pdf'
                        )
                      }
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        inputMethod ===
                        'pdf'
                          ? 'border-violet-300 bg-violet-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                        inputMethod ===
                        'pdf'
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        <FileUp className="h-5 w-5" />
                      </div>

                      <p className="text-sm font-bold text-slate-800">
                        Upload PDF
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        Upload modul atau bahan ajar.
                      </p>
                    </motion.button>
                  </div>
                </div>

                <div className="p-6">
                  <AnimatePresence mode="wait">
                    {inputMethod ===
                    'text' ? (
                      <motion.div
                        key="text"
                        initial={
                          reduceMotion
                            ? false
                            : {
                                opacity: 0,
                                y: 8,
                              }
                        }
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        exit={
                          reduceMotion
                            ? undefined
                            : {
                                opacity: 0,
                                y: -8,
                              }
                        }
                        className="space-y-4"
                      >
                        <div className="flex items-end justify-between gap-4">
                          <label className="text-sm font-bold text-slate-700">
                            Materi pembelajaran *
                          </label>

                          <span
                            className={`text-[10px] font-bold ${
                              inputProgress >=
                              100
                                ? 'text-emerald-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {textContent.length}{' '}
                            karakter
                          </span>
                        </div>

                        <textarea
                          value={
                            textContent
                          }
                          onChange={(
                            event
                          ) =>
                            setTextContent(
                              event.target.value
                            )
                          }
                          rows={15}
                          placeholder={`Contoh struktur:

BAB / TOPIK:
Operasi Bilangan

MATERI POKOK:
- Penjumlahan bilangan bulat
- Pengurangan bilangan bulat

URAIAN:
Jelaskan konsep, contoh, dan penerapannya...

LATIHAN:
Contoh soal atau aktivitas...`}
                          className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                        />

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">
                            Disarankan minimal 100 karakter.
                          </span>

                          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                            <motion.div
                              animate={{
                                width: `${inputProgress}%`,
                              }}
                              className="h-full rounded-full bg-blue-600"
                            />
                          </div>
                        </div>

                        {textContent.length >
                          10000 && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-700">
                            Materi cukup panjang.
                            Sistem akan melakukan pemrosesan
                            sesuai kebutuhan agar lebih hemat quota.
                          </div>
                        )}

                        <details className="group rounded-2xl border border-slate-200 bg-white">
                          <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-xs font-bold text-slate-600">
                            <span>
                              Tips menulis materi
                            </span>

                            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                          </summary>

                          <div className="border-t border-slate-100 px-4 pb-4 pt-3 text-xs leading-5 text-slate-500">
                            <ul className="list-disc space-y-1 pl-4">
                              <li>
                                Identifikasi bab atau topik utama.
                              </li>

                              <li>
                                Sertakan konsep-konsep kunci.
                              </li>

                              <li>
                                Tambahkan contoh konkret bila ada.
                              </li>

                              <li>
                                Gunakan sub-topik jika materi cukup panjang.
                              </li>
                            </ul>
                          </div>
                        </details>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="pdf"
                        initial={
                          reduceMotion
                            ? false
                            : {
                                opacity: 0,
                                y: 8,
                              }
                        }
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        exit={
                          reduceMotion
                            ? undefined
                            : {
                                opacity: 0,
                                y: -8,
                              }
                        }
                        className="space-y-4"
                      >
                        <label className="text-sm font-bold text-slate-700">
                          File PDF *
                        </label>

                        <label className="group flex cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center transition-all hover:border-violet-300 hover:bg-violet-50">
                          <motion.div
                            whileHover={
                              reduceMotion
                                ? undefined
                                : {
                                    y: -4,
                                    scale: 1.05,
                                  }
                            }
                            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm"
                          >
                            <UploadCloud className="h-7 w-7" />
                          </motion.div>

                          <p className="text-sm font-bold text-slate-700">
                            {pdfFile
                              ? pdfFile.name
                              : 'Klik untuk memilih PDF'}
                          </p>

                          <p className="mt-2 text-xs leading-5 text-slate-400">
                            Maksimal 10 MB · Disarankan PDF berbasis teks
                          </p>

                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={(
                              event
                            ) =>
                              setPdfFile(
                                event.target
                                  .files?.[0] ||
                                  null
                              )
                            }
                          />
                        </label>

                        {pdfFile && (
                          <div className="flex items-center justify-between rounded-2xl border border-violet-100 bg-violet-50 p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-violet-600">
                                <FileText className="h-5 w-5" />
                              </div>

                              <div>
                                <p className="max-w-[260px] truncate text-sm font-bold text-slate-700">
                                  {pdfFile.name}
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  {(
                                    pdfFile.size /
                                    (1024 * 1024)
                                  ).toFixed(
                                    2
                                  )}{' '}
                                  MB
                                </p>
                              </div>
                            </div>

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setPdfFile(
                                  null
                                )
                              }
                              className="rounded-xl text-slate-400 hover:bg-white hover:text-red-500"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}

                        <details className="group rounded-2xl border border-slate-200 bg-white">
                          <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-xs font-bold text-slate-600">
                            <span>
                              Rekomendasi PDF
                            </span>

                            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                          </summary>

                          <div className="border-t border-slate-100 px-4 pb-4 pt-3 text-xs leading-5 text-slate-500">
                            <ul className="list-disc space-y-1 pl-4">
                              <li>
                                Maksimal 10 MB.
                              </li>

                              <li>
                                Gunakan heading dan sub-heading yang jelas.
                              </li>

                              <li>
                                PDF berbasis teks lebih disarankan.
                              </li>

                              <li>
                                Upload per bab bila materinya sangat panjang.
                              </li>
                            </ul>
                          </div>
                        </details>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Card>

              {/* CONTEXT */}
              <Card className="rounded-[30px] border-slate-200 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
                <div className="p-6">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        Langkah 2
                      </p>

                      <h2 className="mt-1 text-xl font-black text-slate-900">
                        Konteks pembelajaran
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Tentukan konteks agar AI membuat TP lebih relevan.
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">
                        Kelas / Fase *
                      </label>

                      <select
                        value={grade}
                        onChange={(
                          event
                        ) =>
                          setGrade(
                            event.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                      >
                        <option value="">
                          Pilih Kelas / Fase
                        </option>

                        <optgroup label="Fase A">
                          <option value="1">
                            Kelas 1 SD
                          </option>
                          <option value="2">
                            Kelas 2 SD
                          </option>
                        </optgroup>

                        <optgroup label="Fase B">
                          <option value="3">
                            Kelas 3 SD
                          </option>
                          <option value="4">
                            Kelas 4 SD
                          </option>
                        </optgroup>

                        <optgroup label="Fase C">
                          <option value="5">
                            Kelas 5 SD
                          </option>
                          <option value="6">
                            Kelas 6 SD
                          </option>
                        </optgroup>
                      </select>

                      <p className="mt-2 text-[11px] leading-5 text-slate-400">
                        Fase A: sangat sederhana ·
                        Fase B: sederhana ·
                        Fase C: menengah
                      </p>
                    </div>

                    {isSD && (
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-700">
                          Mata Pelajaran *
                        </label>

                        <select
                          value={
                            subject
                          }
                          onChange={(
                            event
                          ) =>
                            setSubject(
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                        >
                          <option value="">
                            Pilih Mata Pelajaran
                          </option>

                          {sdSubjects.map(
                            (
                              subj
                            ) => (
                              <option
                                key={
                                  subj
                                }
                                value={
                                  subj
                                }
                              >
                                {
                                  subj
                                }
                              </option>
                            )
                          )}
                        </select>

                        <p className="mt-2 text-[11px] text-slate-400">
                          Mata pelajaran wajib untuk kelas SD.
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">
                        Semester
                      </label>

                      <select
                        value={
                          semesterSelection
                        }
                        onChange={(
                          event
                        ) =>
                          setSemesterSelection(
                            event.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                      >
                        <option value="both">
                          Semester 1 & 2
                        </option>

                        <option value="semester1">
                          Semester 1
                        </option>

                        <option value="semester2">
                          Semester 2
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">
                        Materi Pokok
                        <span className="ml-1 font-normal text-slate-400">
                          (opsional)
                        </span>
                      </label>

                      <Input
                        value={
                          materiPokok
                        }
                        onChange={(
                          event
                        ) =>
                          setMateriPokok(
                            event.target.value
                          )
                        }
                        placeholder="Contoh: bilangan bulat, pecahan, statistik"
                        className="h-auto rounded-2xl border-slate-200 bg-slate-50 px-4 py-3"
                      />

                      <p className="mt-2 text-[11px] text-slate-400">
                        {materiPokok.length}{' '}
                        / 500 karakter
                      </p>
                    </div>
                  </div>

                  {/* CP */}
                  <div className="mt-5">
                    <div className="mb-2 flex items-end justify-between gap-4">
                      <label className="text-sm font-bold text-slate-700">
                        Referensi Capaian Pembelajaran (CP) *
                      </label>

                      <span
                        className={`text-[10px] font-bold ${
                          cpReference.length >=
                          50
                            ? 'text-emerald-600'
                            : 'text-slate-400'
                        }`}
                      >
                        {cpReference.length}{' '}
                        / 2000
                      </span>
                    </div>

                    <textarea
                      value={
                        cpReference
                      }
                      onChange={(
                        event
                      ) =>
                        setCpReference(
                          event.target.value
                        )
                      }
                      rows={7}
                      placeholder={`Contoh:
- Siswa mampu memahami dan menganalisis teks narasi.
- Siswa mampu menyelesaikan operasi hitung dalam konteks kehidupan sehari-hari.
- Siswa mampu menjelaskan konsep dan menerapkannya.`}
                      className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                    />

                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[11px] text-slate-400">
                        Minimal 50 karakter agar konteks AI cukup kuat.
                      </p>

                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          animate={{
                            width: `${progress}%`,
                          }}
                          className={`h-full rounded-full ${
                            progress >=
                            100
                              ? 'bg-emerald-500'
                              : 'bg-blue-600'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* FORMAT RAPOR */}
                  <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <button
                      type="button"
                      onClick={() =>
                        setMaxLength100(
                          (value) =>
                            !value
                        )
                      }
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          maxLength100
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-blue-300 bg-white'
                        }`}
                      >
                        {maxLength100 && (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-bold text-blue-900">
                          Batasi TP maksimal 100 karakter
                        </p>

                        <p className="mt-1 text-xs leading-5 text-blue-700/80">
                          Cocok untuk format rapor atau dokumen
                          yang memerlukan TP lebih ringkas.
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* TIPS */}
                  <details className="group mt-5 rounded-2xl border border-slate-200 bg-white">
                    <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-xs font-bold text-slate-600">
                      <span className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-500" />
                        Tips menulis CP yang baik
                      </span>

                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </summary>

                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 text-xs leading-5 text-slate-500">
                      <ul className="list-disc space-y-1 pl-4">
                        <li>
                          Fokus pada kompetensi yang dapat diukur.
                        </li>

                        <li>
                          Hindari kata kerja generik.
                        </li>

                        <li>
                          Sertakan konteks penerapan.
                        </li>

                        <li>
                          CP dapat terdiri dari beberapa poin kompetensi yang terkait.
                        </li>

                        <li>
                          Rujuk CP sesuai fase dan mata pelajaran yang digunakan.
                        </li>
                      </ul>
                    </div>
                  </details>
                </div>
              </Card>
            </motion.div>

            {/* RIGHT */}
            <motion.div
              variants={
                reduceMotion
                  ? undefined
                  : sectionVariants
              }
              initial={
                reduceMotion
                  ? false
                  : 'hidden'
              }
              animate={
                reduceMotion
                  ? undefined
                  : 'visible'
              }
              transition={{
                delay: 0.08,
              }}
              className="space-y-6"
            >

              {/* AI SETTINGS */}
              <Card className="rounded-[30px] border-slate-200 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
                <div className="p-6">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        Langkah 3
                      </p>

                      <h2 className="mt-1 text-xl font-black text-slate-900">
                        Preferensi AI
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Sistem akan menggunakan data di sebelah kiri sebagai konteks generate.
                      </p>
                    </div>

                    <motion.div
                      animate={
                        reduceMotion
                          ? undefined
                          : {
                              y: [0, -4, 0],
                            }
                      }
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"
                    >
                      <WandSparkles className="h-5 w-5" />
                    </motion.div>
                  </div>

                  <div className="space-y-4">

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                          <Target className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            Konteks otomatis
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            AI akan mempertimbangkan kelas, mata pelajaran,
                            CP, materi pokok, dan sumber materi.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                        Ringkasan konfigurasi
                      </p>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-slate-500">
                            Sumber
                          </span>

                          <span className="text-xs font-bold text-slate-800">
                            {inputMethod ===
                            'pdf'
                              ? 'PDF'
                              : 'Teks'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-slate-500">
                            Kelas
                          </span>

                          <span className="text-xs font-bold text-slate-800">
                            {grade
                              ? `Kelas ${grade}`
                              : 'Belum dipilih'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-slate-500">
                            Semester
                          </span>

                          <span className="text-xs font-bold text-slate-800">
                            {semesterSelection ===
                            'both'
                              ? '1 & 2'
                              : semesterSelection ===
                                  'semester1'
                                ? '1'
                                : '2'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-slate-500">
                            Format TP
                          </span>

                          <span className="text-xs font-bold text-slate-800">
                            {maxLength100
                              ? 'Maks. 100 karakter'
                              : 'Lengkap'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-amber-500 shadow-sm">
                          <Sparkles className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="text-sm font-bold text-amber-900">
                            AI Quality Tip
                          </p>

                          <p className="mt-1 text-xs leading-5 text-amber-800/80">
                            Semakin jelas CP dan materi pokok,
                            semakin fokus hasil TP yang dihasilkan.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ERROR */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{
                          opacity: 0,
                          y: -6,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        exit={{
                          opacity: 0,
                          y: -6,
                        }}
                        className="mt-5 whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* GENERATE */}
                  <motion.button
                    type="button"
                    whileHover={
                      reduceMotion
                        ? undefined
                        : {
                            y: -2,
                            scale: 1.01,
                          }
                    }
                    whileTap={
                      reduceMotion
                        ? undefined
                        : {
                            scale: 0.985,
                          }
                    }
                    disabled={loading}
                    onClick={
                      handleGenerate
                    }
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-xl shadow-slate-200 transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        {loadingMessage ||
                          'AI sedang bekerja...'}
                      </>
                    ) : (
                      <>
                        <WandSparkles className="h-5 w-5" />
                        {inputMethod ===
                        'pdf'
                          ? 'Generate dari PDF'
                          : 'Generate dari Teks'}

                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </motion.button>
                </div>
              </Card>

              {/* AI PROCESSING */}
              <AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: 10,
                      scale: 0.98,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      y: -10,
                    }}
                    className="overflow-hidden rounded-[30px] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200">
                        <motion.div
                          animate={{
                            rotate: 360,
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'linear',
                          }}
                        >
                          <Sparkles className="h-6 w-6" />
                        </motion.div>

                        <motion.span
                          animate={{
                            scale: [
                              1,
                              1.2,
                              1,
                            ],
                          }}
                          transition={{
                            duration: 1.6,
                            repeat: Infinity,
                          }}
                          className="absolute inset-0 rounded-2xl border border-violet-300"
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900">
                          AI sedang memproses materi
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {loadingMessage ||
                            'Menganalisis konteks pembelajaran...'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-violet-100">
                      <motion.div
                        animate={{
                          x: [
                            '-100%',
                            '100%',
                          ],
                        }}
                        transition={{
                          duration: 1.6,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        className="h-full w-1/2 rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-500"
                      />
                    </div>

                    {inputMethod ===
                      'pdf' && (
                      <p className="mt-3 text-[11px] text-violet-700/70">
                        PDF sedang dibaca dan dianalisis. Proses dapat membutuhkan sedikit waktu.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </>
      )}
    </motion.div>
  );
}