export type DayOfWeek = 'Понедельник' | 'Вторник' | 'Среда' | 'Четверг' | 'Пятница' | 'Суббота' | 'Воскресенье';

export interface Subject {
  id: string;
  name: string;
  teacherName?: string;
  totalHours?: number;
}

export interface ScheduleSettings {
  subjects: Subject[];
  classesPerDay: number;
  classDuration: number; // in minutes
  days: DayOfWeek[];
  shortBreak: number; // in minutes
  longBreak: number; // in minutes
  longBreakAfter: number; // number of classes before long break
  startTime: string; // "HH:mm"
}

export interface ClassSession {
  id: string;
  number: number;
  startTime: string;
  endTime: string;
  subject: Subject | null;
  type: 'class' | 'short-break' | 'long-break';
}

export interface DaySchedule {
  day: DayOfWeek;
  sessions: ClassSession[];
}

export interface Substitution {
  id: string;
  sickTeacherName: string;
  replacementSubjectId: string | 'cancelled';
  dateApplied: number;
}

export interface Group {
  id: string;
  name: string;
  subjects: Subject[];
  settings: ScheduleSettings;
  schedule: DaySchedule[] | null;
  substitutions: Substitution[];
  lastUpdate: number;
}
