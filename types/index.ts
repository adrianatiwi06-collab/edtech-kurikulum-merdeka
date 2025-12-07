export interface LearningGoal {
  id: string;
  user_id: string;
  chapter: string;
  tp: string;
  semester: number;
  grade: string;
  cpReference: string;
  created_at: string;
  subject?: string;
  isRaporFormat?: boolean; // true jika dibuat dengan toggle 100 karakter
}

export interface QuestionBank {
  id: string;
  user_id: string;
  subject: string;
  examTitle: string;
  duration: number;
  tp_ids: string[];
  grade?: string;  // Added for display purposes
  kelas?: string;  // Alternative field name
  
  // TP Mapping for each question (for TP analysis)
  question_tp_mapping?: Array<{
    question_number: number;
    question_type: 'PG' | 'Essay';
    tp_id: string;
    tp_text: string;
  }>;
  
  questions: {
    multipleChoice: MultipleChoiceQuestion[];
    essay: EssayQuestion[];
  };
  created_at: string;
}

export interface MultipleChoiceQuestion {
  questionNumber: number;
  question: string;
  options: { [key: string]: string };
  correctAnswer: string;
  weight: number;
  relatedTP?: string;
  wordCount?: number;
  imageDescription?: string;
}

export interface EssayQuestion {
  questionNumber: number;
  question: string;
  weight: number;
  rubric?: string;
  relatedTP?: string;
  wordCount?: number;
  imageDescription?: string;
}

export interface Class {
  id: string;
  user_id: string;
  name: string;
  grade: string;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  nisn: string;
  created_at: string;
}

export interface Grade {
  id: string;
  user_id: string;
  subject: string;
  exam_title: string;
  exam_name: string;
  class_id: string;
  class_name: string;
  question_bank_id?: string;  // For Bank Soal mode
  exam_template_id?: string;  // For Template mode
  
  // TP Mapping (copied from QuestionBank or ExamTemplate for TP analysis)
  tp_mapping?: Array<{
    question_number: number;
    question_type: 'PG' | 'Essay';
    tp_id: string;
    tp_text: string;
  }>;
  
  grades: StudentGrade[];
  is_finalized: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentGrade {
  studentId: string;
  studentName: string;
  mcAnswers: string[];
  essayScores: number[];
  totalScore: number;
}

export interface UserProfile {
  email: string;
  displayName: string;
  createdAt: string;
}

// Template Ujian interfaces
export interface ExamTemplate {
  id: string;
  user_id: string;
  exam_name: string;
  exam_type: 'PAS' | 'PTS' | 'PAT' | 'Ulangan' | 'Kuis';
  grade: string;
  subject: string;
  semester: 1 | 2;
  
  // TP Mapping
  tp_ids: string[];
  tp_details: Array<{
    tp_id: string;
    chapter: string;
    tp_text: string;
    question_numbers: number[];  // Which questions measure this TP
  }>;
  
  // Question Config
  multiple_choice: {
    count: number;
    weight: number;
    answer_keys: string[];  // Array of correct answers (A, B, C, D, E)
    tp_mapping: { [questionNumber: number]: string };  // {1: "tp_id_1", 2: "tp_id_2"}
  };
  
  essay: {
    count: number;
    weight: number;
    tp_mapping: { [questionNumber: number]: string };
  };
  
  total_questions: number;
  max_score: number;
  
  created_at: string;
  updated_at: string;
}

// TP Achievement Analysis interfaces
export interface TPAchievementAnalysis {
  id: string;
  user_id: string;
  exam_template_id: string;
  exam_name: string;
  class_id: string;
  class_name: string;
  student_id: string;
  student_name: string;
  
  tp_analysis: Array<{
    tp_id: string;
    tp_text: string;
    chapter: string;
    questions: Array<{
      number: number;
      type: 'PG' | 'Isian';
      max_score: number;
      student_score: number;
      is_correct?: boolean;  // For PG only
    }>;
    total_score: number;
    max_possible_score: number;
    percentage: number;  // 0-100
    achievement_level: 'Belum Berkembang' | 'Mulai Berkembang' | 'Berkembang Sesuai Harapan' | 'Sangat Berkembang';
  }>;
  
  overall_score: number;
  overall_percentage: number;
  
  created_at: string;
}
