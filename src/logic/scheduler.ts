import { DayOfWeek, Subject, ScheduleSettings, DaySchedule, ClassSession, Group } from '../types';

interface SchedulerOptions extends ScheduleSettings {
  subjects: Subject[];
  otherGroups?: Group[];
}

export function generateSchedule(options: SchedulerOptions): DaySchedule[] {
  const {
    subjects,
    classesPerDay,
    classDuration,
    days,
    shortBreak,
    longBreak,
    longBreakAfter,
    startTime,
    otherGroups = []
  } = options;

  // Helper to check for room occupancy across other groups
  const isRoomOccupied = (dayIndex: number, sessionNum: number, room: string): boolean => {
    if (!room) return false;
    return otherGroups.some(group => {
      if (!group.schedule || !group.schedule[dayIndex]) return false;
      // We look for a session that is a class and has the same session number (index)
      const sessionInOtherGroup = group.schedule[dayIndex].sessions.find(s => s.number === sessionNum && s.type === 'class');
      return sessionInOtherGroup?.subject?.room === room;
    });
  };

  const totalSlots = days.length * classesPerDay;
  let subjectPool: Subject[] = [];
  
  const totalHoursSum = subjects.reduce((sum, s) => sum + (s.totalHours || 1), 0);
  
  if (totalHoursSum > 0) {
    subjects.forEach(subject => {
      const weight = subject.totalHours || 1;
      const count = Math.max(1, Math.round((weight / totalHoursSum) * totalSlots));
      for (let i = 0; i < count; i++) {
        subjectPool.push(subject);
      }
    });

    subjectPool = subjectPool.sort(() => Math.random() - 0.5);
    
    while (subjectPool.length < totalSlots) {
      const randomSub = subjects[Math.floor(Math.random() * subjects.length)];
      subjectPool.push(randomSub);
    }
    subjectPool = subjectPool.slice(0, totalSlots);
  } else {
    while (subjectPool.length < totalSlots) {
      const shuffled = [...subjects].sort(() => Math.random() - 0.5);
      subjectPool = [...subjectPool, ...shuffled];
    }
    subjectPool = subjectPool.slice(0, totalSlots);
  }

  const schedule: DaySchedule[] = [];
  let poolIndex = 0;

  days.forEach((day, dayIdx) => {
    const sessions: ClassSession[] = [];
    let currentTime = timeToMinutes(startTime);
    let daySubjects: Subject[] = [];

    for (let i = 1; i <= classesPerDay; i++) {
        let pickedSubject: Subject | null = null;
        let lastSubject = daySubjects[daySubjects.length - 1];
        
        let candidateIndex = -1;
        // Try multiple candidates to find one that fits (no room conflict and not consecutive if possible)
        for (let j = 0; j < subjectPool.length; j++) {
            const idx = (poolIndex + j) % subjectPool.length;
            const sub = subjectPool[idx];
            
            const isConsecutive = lastSubject && sub.id === lastSubject.id;
            const isRoomConflict = sub.room && isRoomOccupied(dayIdx, i, sub.room);
            
            if (!isConsecutive && !isRoomConflict) {
                candidateIndex = idx;
                break;
            }
        }

        // If no ideal candidate, try just ignoring consecutive check but keeping room constraint
        if (candidateIndex === -1) {
            for (let j = 0; j < subjectPool.length; j++) {
                const idx = (poolIndex + j) % subjectPool.length;
                const sub = subjectPool[idx];
                if (!sub.room || !isRoomOccupied(dayIdx, i, sub.room)) {
                    candidateIndex = idx;
                    break;
                }
            }
        }

        if (candidateIndex !== -1) {
            pickedSubject = subjectPool[candidateIndex];
            // Swap to maintain pool diversity if needed, or just track poolIndex
            poolIndex = (candidateIndex + 1) % subjectPool.length;
        } else {
            pickedSubject = subjectPool[poolIndex % subjectPool.length];
            poolIndex++;
        }
        
        daySubjects.push(pickedSubject);

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

        if (i < classesPerDay) {
            const isLongBreak = i % longBreakAfter === 0;
            const breakDuration = isLongBreak ? longBreak : shortBreak;
            
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
  });

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
