import { DayOfWeek, Subject, ScheduleSettings, DaySchedule, ClassSession } from '../types';

export function generateSchedule(settings: ScheduleSettings): DaySchedule[] {
  const {
    subjects,
    classesPerDay,
    classDuration,
    days,
    shortBreak,
    longBreak,
    longBreakAfter,
    startTime,
  } = settings;

  // Flatten available subjects into a pool to distribute
  // We want to use each subject proportionally to its totalHours if specified
  const totalSlots = days.length * classesPerDay;
  let subjectPool: Subject[] = [];
  
  // Calculate total hours across all subjects to use as weights
  const totalHoursSum = subjects.reduce((sum, s) => sum + (s.totalHours || 1), 0);
  
  if (totalHoursSum > 0) {
    // Proportional distribution based on hours
    subjects.forEach(subject => {
      const weight = subject.totalHours || 1;
      const count = Math.max(1, Math.round((weight / totalHoursSum) * totalSlots));
      for (let i = 0; i < count; i++) {
        subjectPool.push(subject);
      }
    });

    // Shuffle and trim/pad pool to exact size
    subjectPool = subjectPool.sort(() => Math.random() - 0.5);
    
    while (subjectPool.length < totalSlots) {
      const randomSub = subjects[Math.floor(Math.random() * subjects.length)];
      subjectPool.push(randomSub);
    }
    subjectPool = subjectPool.slice(0, totalSlots);
  } else {
    // Fallback if no subjects
    while (subjectPool.length < totalSlots) {
      const shuffled = [...subjects].sort(() => Math.random() - 0.5);
      subjectPool = [...subjectPool, ...shuffled];
    }
    subjectPool = subjectPool.slice(0, totalSlots);
  }

  // Smart distribution: avoid same subject twice in a row in a day if possible
  const schedule: DaySchedule[] = [];
  let poolIndex = 0;

  for (const day of days) {
    const sessions: ClassSession[] = [];
    let currentTime = timeToMinutes(startTime);
    let daySubjects: Subject[] = [];

    for (let i = 1; i <= classesPerDay; i++) {
        // Try to pick a subject that wasn't just picked
        let pickedSubject: Subject | null = null;
        let lastSubject = daySubjects[daySubjects.length - 1];
        
        // Find a candidate from the remaining pool
        let candidateIndex = -1;
        for (let j = poolIndex; j < subjectPool.length; j++) {
            if (!lastSubject || subjectPool[j].id !== lastSubject.id) {
                candidateIndex = j;
                break;
            }
        }

        if (candidateIndex !== -1) {
            // Swap candidate to current poolIndex
            [subjectPool[poolIndex], subjectPool[candidateIndex]] = [subjectPool[candidateIndex], subjectPool[poolIndex]];
            pickedSubject = subjectPool[poolIndex];
        } else {
            // No choice but to repeat or just take next
            pickedSubject = subjectPool[poolIndex];
        }
        
        daySubjects.push(pickedSubject);
        poolIndex++;

        const startStr = minutesToTime(currentTime);
        currentTime += classDuration;
        const endStr = minutesToTime(currentTime);

        sessions.push({
            id: `${day}-${i}`,
            number: i,
            startTime: startStr,
            endTime: endStr,
            subject: pickedSubject,
            type: 'class'
        });

        // Add breaks
        if (i < classesPerDay) {
            const isLongBreak = i % longBreakAfter === 0;
            const breakDuration = isLongBreak ? longBreak : shortBreak;
            
            // Note: In some systems breaks are separate rows, here we just adjust time for next class
            // or we could add them as sessions. Let's add them as sessions for the table.
            const bStart = minutesToTime(currentTime);
            currentTime += breakDuration;
            const bEnd = minutesToTime(currentTime);

            sessions.push({
                id: `${day}-break-${i}`,
                number: 0,
                startTime: bStart,
                endTime: bEnd,
                subject: null,
                type: isLongBreak ? 'long-break' : 'short-break'
            });
        }
    }

    schedule.push({ day, sessions });
  }

  return schedule;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}
