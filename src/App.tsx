import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  BookOpen, 
  Settings2, 
  CheckCircle2, 
  ChevronRight, 
  Plus, 
  Trash2, 
  BrainCircuit,
  Printer,
  Download,
  Users,
  Search,
  Hash,
  MessageSquare,
  MoreVertical
} from 'lucide-react';
import { DayOfWeek, Subject, ScheduleSettings, DaySchedule, Group } from './types';
import { generateSchedule } from './logic/scheduler';
import { exportScheduleToPDF } from './logic/pdfExport';

const DAYS: DayOfWeek[] = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница'];

const DEFAULT_SUBJECTS: Subject[] = [
  { id: '1', name: 'Математика', teacherName: 'Лобачевский Н.И.', totalHours: 72 },
  { id: '2', name: 'Физика', teacherName: 'Ландау Л.Д.', totalHours: 54 },
  { id: '3', name: 'Программирование', teacherName: 'Касперский Е.В.', totalHours: 108 },
  { id: '4', name: 'Английский', teacherName: 'Булгаков М.А.', totalHours: 36 },
  { id: '5', name: 'История', teacherName: 'Ключевский В.О.', totalHours: 36 },
];

const DEFAULT_SETTINGS: ScheduleSettings = {
  subjects: [],
  classesPerDay: 4,
  classDuration: 90,
  days: DAYS,
  shortBreak: 10,
  longBreak: 30,
  longBreakAfter: 2,
  startTime: '08:30',
};

export default function App() {
  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem('edu_sync_groups');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration: Ensure substitutions exist
        return parsed.map((g: any) => ({
          ...g,
          substitutions: g.substitutions || []
        }));
      } catch (e) {
        console.error('Failed to parse saved groups', e);
      }
    }
    return [
      {
        id: 'default-1',
        name: 'ПО-31',
        subjects: [
          { id: 'po-1', name: 'Программирование', teacherName: 'Иванов И.И.', totalHours: 108 },
          { id: 'po-2', name: 'Информатика', teacherName: 'Петров П.П.', totalHours: 72 },
          { id: 'po-3', name: 'Математика', teacherName: 'Сидоров С.С.', totalHours: 72 },
          { id: 'po-4', name: 'Физика', teacherName: 'Иванов И.И.', totalHours: 54 },
          { id: 'po-5', name: 'Английский', teacherName: 'Смирнова А.А.', totalHours: 36 },
        ],
        settings: { ...DEFAULT_SETTINGS },
        schedule: null,
        substitutions: [],
        lastUpdate: Date.now()
      },
      {
        id: 'default-2',
        name: 'ЖТ-22',
        subjects: [
          { id: 'zt-1', name: 'Правила ЖД движения', teacherName: 'Васильев В.В.', totalHours: 90 },
          { id: 'zt-2', name: 'Техника безопасности', teacherName: 'Васильев В.В.', totalHours: 36 },
          { id: 'zt-3', name: 'Устройство локомотива', teacherName: 'Карпов К.К.', totalHours: 72 },
          { id: 'zt-4', name: 'История ЖД', teacherName: 'Морозов М.М.', totalHours: 18 },
          { id: 'zt-5', name: 'Охрана труда', teacherName: 'Карпов К.К.', totalHours: 36 },
        ],
        settings: { ...DEFAULT_SETTINGS },
        schedule: null,
        substitutions: [],
        lastUpdate: Date.now()
      }
    ];
  });
  
  const [activeGroupId, setActiveGroupId] = useState<string>(() => {
    const saved = localStorage.getItem('edu_sync_active_id');
    if (saved && groups.some(g => g.id === saved)) return saved;
    return groups[0]?.id || 'default-1';
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectTeacher, setNewSubjectTeacher] = useState('');
  const [newSubjectHours, setNewSubjectHours] = useState<number>(36);
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddGroup, setShowAddGroup] = useState(false);

  // Substitution state
  const [sickTeacher, setSickTeacher] = useState('');
  const [replacementSubId, setReplacementSubId] = useState('');

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem('edu_sync_groups', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem('edu_sync_active_id', activeGroupId);
  }, [activeGroupId]);

  const handleExportPDF = async () => {
    if (!activeGroup.schedule || isExporting) return;
    setIsExporting(true);
    try {
      await exportScheduleToPDF(activeGroup);
    } catch (error) {
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];

  const applySubstitution = () => {
    if (!sickTeacher || !replacementSubId || !activeGroup.schedule) return;

    let replacementSubject: Subject | undefined;
    if (replacementSubId !== 'cancelled') {
      replacementSubject = activeGroup.subjects.find(s => s.id === replacementSubId);
    }
    
    const newSchedule = activeGroup.schedule.map(day => ({
      ...day,
      sessions: day.sessions.map(session => {
        if (session.subject && session.subject.teacherName === sickTeacher) {
          if (replacementSubId === 'cancelled') {
            return {
              ...session,
              subject: undefined,
              type: 'short-break'
            };
          } else if (replacementSubject) {
            return {
              ...session,
              subject: { ...replacementSubject }
            };
          }
        }
        return session;
      })
    }));

    updateActiveGroup({ 
      schedule: newSchedule,
      substitutions: [
        ...(activeGroup.substitutions || []),
        { 
          id: Date.now().toString(), 
          sickTeacherName: sickTeacher, 
          replacementSubjectId: replacementSubId, 
          dateApplied: Date.now() 
        }
      ]
    });
    
    setSickTeacher('');
    setReplacementSubId('');
  };

  // Initial generation for groups that don't have one
  useEffect(() => {
    const updatedGroups = groups.map(group => {
      if (!group.schedule) {
        return {
          ...group,
          schedule: generateSchedule({ ...group.settings, subjects: group.subjects }),
          substitutions: group.substitutions || []
        };
      }
      return group;
    });
    setGroups(updatedGroups);
  }, []);

  // Helper to update active group state
  const updateActiveGroup = (updates: Partial<Group>) => {
    setGroups(groups.map(g => g.id === activeGroupId ? { ...g, ...updates, lastUpdate: Date.now() } : g));
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const result = generateSchedule({ ...activeGroup.settings, subjects: activeGroup.subjects });
      updateActiveGroup({ schedule: result });
      setIsGenerating(false);
    }, 800);
  };

  const addSubject = () => {
    if (!newSubjectName.trim()) return;
    const newSub: Subject = {
      id: Date.now().toString(),
      name: newSubjectName.trim(),
      teacherName: newSubjectTeacher.trim() || undefined,
      totalHours: newSubjectHours || undefined,
    };
    updateActiveGroup({ subjects: [...activeGroup.subjects, newSub] });
    setNewSubjectName('');
    setNewSubjectTeacher('');
    setNewSubjectHours(36);
  };

  const removeSubject = (id: string) => {
    updateActiveGroup({ subjects: activeGroup.subjects.filter(s => s.id !== id) });
  };

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup: Group = {
      id: Date.now().toString(),
      name: newGroupName.trim(),
      subjects: [...DEFAULT_SUBJECTS],
      settings: { ...DEFAULT_SETTINGS },
      schedule: null,
      substitutions: [],
      lastUpdate: Date.now()
    };
    setGroups([...groups, newGroup]);
    setActiveGroupId(newGroup.id);
    setNewGroupName('');
    setShowAddGroup(false);
  };

  const removeGroup = (id: string) => {
    if (groups.length === 1) return;
    const newGroups = groups.filter(g => g.id !== id);
    setGroups(newGroups);
    if (activeGroupId === id) {
      setActiveGroupId(newGroups[0].id);
    }
  };

  return (
    <div className="flex h-screen bg-bg-base text-[#E0E0E0] font-sans selection:bg-accent selection:text-black overflow-hidden">
      
      {/* Telegram-style Sidebar */}
      <aside className="w-80 border-r border-border-dim bg-[#0a0a0a] flex flex-col shrink-0">
        <div className="p-6 border-b border-border-dim flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-accent p-2 rounded-lg">
              <BrainCircuit className="text-black w-5 h-5" />
            </div>
            <h1 className="text-lg font-serif italic text-accent tracking-tighter">ScheduleMate</h1>
          </div>
          <button 
            onClick={() => setShowAddGroup(true)}
            className="p-2 hover:bg-bg-active rounded-full transition-colors text-accent"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/40" />
            <input 
              type="text" 
              placeholder="Поиск групп..." 
              className="w-full bg-bg-card border border-border-dim rounded-lg py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-accent transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {showAddGroup && (
            <div className="p-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <input 
                autoFocus
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGroup()}
                onBlur={() => {
                  if (newGroupName.trim()) {
                    addGroup();
                  } else {
                    setShowAddGroup(false);
                  }
                }}
                placeholder="Название новой группы..."
                className="w-full bg-accent text-black font-bold text-xs p-3 rounded uppercase tracking-widest placeholder:text-black/50 outline-none"
              />
            </div>
          )}

          <div className="px-2 space-y-1 mt-2">
            {groups.map(group => (
              <button
                key={group.id}
                onClick={() => setActiveGroupId(group.id)}
                className={`w-full group flex items-center justify-between p-3 rounded-xl transition-all ${
                  activeGroupId === group.id 
                    ? 'bg-accent text-black shadow-lg shadow-accent/10' 
                    : 'text-muted hover:bg-bg-active hover:text-[#E0E0E0]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    activeGroupId === group.id ? 'bg-black/10' : 'bg-bg-card border border-border-dim'
                  }`}>
                    {group.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold uppercase tracking-widest leading-none mb-1">{group.name}</div>
                    <div className={`text-[10px] font-medium opacity-50 ${activeGroupId === group.id ? 'text-black' : ''}`}>
                      {group.subjects.length} предметов
                    </div>
                  </div>
                </div>
                {activeGroupId !== group.id && (
                  <Trash2 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGroup(group.id);
                    }}
                    className="w-4 h-4 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all" 
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 border-t border-border-dim text-[9px] font-bold uppercase tracking-[0.2em] text-muted/40">
            Статус: Работает
          </div>
          <div className="p-6 border-t border-border-dim text-[9px] font-bold uppercase tracking-[0.2em] text-accent/60">
            © 2024 ScheduleMate AI
          </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Sub-header for active group */}
        <header className="h-20 border-b border-border-dim flex items-center justify-between px-8 bg-bg-base/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <h2 className="text-lg font-serif italic text-[#E0E0E0] lowercase tracking-tight">#{activeGroup.name.toLowerCase()}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted">Конфигурация группы активна</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-accent text-black px-6 py-2.5 rounded-none text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-white transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <div className="w-3 h-3 border border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <Settings2 className="w-3 h-3" />
              )}
              {isGenerating ? 'ВЫЧИСЛЕНИЕ...' : 'СГЕНЕРИРОВАТЬ СЕТКУ'}
            </button>
            <button className="p-2 hover:bg-bg-active rounded-full transition-colors text-muted">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#050505]">
          <main className="max-w-7xl mx-auto px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-16">
            
            {/* Control Column */}
            <div className="lg:col-span-4 space-y-12">
              <section className="animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="flex items-center gap-2 mb-8 border-l-2 border-accent pl-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent">Реестр предметов</h2>
                </div>
                
                <div className="space-y-4">
                  <div className="flex flex-col gap-3">
                    <input 
                      type="text"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSubject()}
                      placeholder="Название предмета..."
                      className="w-full bg-bg-card border border-border-dim px-4 py-4 text-xs font-medium text-[#E0E0E0] focus:outline-none focus:border-accent transition-all placeholder:text-muted/30 uppercase tracking-widest"
                    />
                    <input 
                      type="text"
                      value={newSubjectTeacher}
                      onChange={(e) => setNewSubjectTeacher(e.target.value)}
                      placeholder="Имя преподавателя (опционально)..."
                      className="w-full bg-bg-card border border-border-dim px-4 py-4 text-xs font-medium text-[#E0E0E0] focus:outline-none focus:border-accent transition-all placeholder:text-muted/30 uppercase tracking-widest"
                    />
                    <div className="flex gap-3">
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[8px] font-bold uppercase text-muted/40 tracking-widest">Всего часов</label>
                        <input 
                          type="number"
                          value={newSubjectHours}
                          onChange={(e) => setNewSubjectHours(parseInt(e.target.value) || 0)}
                          className="w-full bg-bg-card border border-border-dim px-4 py-3 text-[10px] font-mono text-accent focus:outline-none focus:border-accent"
                        />
                      </div>
                      <button 
                        onClick={addSubject}
                        className="bg-accent text-black px-6 py-3 hover:bg-white transition-all shrink-0 font-bold text-xs self-end h-[42px]"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#0c0c0c] border border-border-dim overflow-hidden divide-y divide-border-dim/50">
                    {activeGroup.subjects.map((sub) => (
                      <motion.div 
                        layout
                        key={sub.id} 
                        className="px-5 py-4 flex flex-col gap-1 group hover:bg-bg-active transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="text-[11px] font-bold uppercase tracking-widest">{sub.name}</span>
                          </div>
                          <button 
                            onClick={() => removeSubject(sub.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-accent transition-all font-mono text-[9px] font-bold uppercase tracking-widest"
                          >
                            Удалить
                          </button>
                        </div>
                        <div className="flex items-center gap-4 pl-5">
                          <span className="text-[9px] text-muted font-medium uppercase tracking-tight">
                            {sub.teacherName || 'Нет имени'}
                          </span>
                          <span className="text-[9px] text-accent font-mono">
                            {sub.totalHours || 0}Ч
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="animate-in fade-in slide-in-from-left-4 duration-500 delay-100">
                <div className="flex items-center gap-2 mb-8 border-l-2 border-muted/50 pl-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted/60">Системные параметры</h2>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-8">
                    <div>
                      <label className="text-[9px] font-bold uppercase text-muted/40 tracking-[0.2em] mb-3 block">Пар в день</label>
                      <input 
                        type="number"
                        value={activeGroup.settings.classesPerDay}
                        onChange={(e) => updateActiveGroup({ settings: {...activeGroup.settings, classesPerDay: parseInt(e.target.value) || 1} })}
                        className="w-full bg-bg-card border border-border-dim px-4 py-3 text-xs font-mono text-accent focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase text-muted/40 tracking-[0.2em] mb-3 block">Длительность пары</label>
                      <input 
                        type="number"
                        value={activeGroup.settings.classDuration}
                        onChange={(e) => updateActiveGroup({ settings: {...activeGroup.settings, classDuration: parseInt(e.target.value) || 1} })}
                        className="w-full bg-bg-card border border-border-dim px-4 py-3 text-xs font-mono text-accent focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <label className="text-[9px] font-bold uppercase text-muted/40 tracking-[0.2em] mb-3 block">Начало</label>
                      <input 
                        type="time"
                        value={activeGroup.settings.startTime}
                        onChange={(e) => updateActiveGroup({ settings: {...activeGroup.settings, startTime: e.target.value} })}
                        className="w-full bg-bg-card border border-border-dim px-4 py-3 text-xs font-mono text-accent focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase text-muted/40 tracking-[0.2em] mb-3 block">Большая перемена</label>
                      <input 
                        type="number"
                        value={activeGroup.settings.longBreak}
                        onChange={(e) => updateActiveGroup({ settings: {...activeGroup.settings, longBreak: parseInt(e.target.value) || 0} })}
                        className="w-full bg-bg-card border border-border-dim px-4 py-3 text-xs font-mono text-accent focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Substitution Section */}
              <section className="animate-in fade-in slide-in-from-left-4 duration-500 delay-200">
                <div className="flex items-center gap-2 mb-8 border-l-2 border-red-500 pl-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-500">Замена преподавателя</h2>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted/40 tracking-[0.2em] mb-3 block">Заболевший учитель</label>
                    <select 
                      value={sickTeacher}
                      onChange={(e) => setSickTeacher(e.target.value)}
                      className="w-full bg-bg-card border border-border-dim px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted focus:outline-none focus:border-accent appearance-none cursor-pointer"
                    >
                      <option value="">Выберите учителя...</option>
                      {Array.from(new Set(activeGroup.subjects.map(s => s.teacherName).filter(Boolean))).map(teacher => (
                        <option key={teacher as string} value={teacher as string}>{teacher}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted/40 tracking-[0.2em] mb-3 block">Замена</label>
                    <select 
                      value={replacementSubId}
                      onChange={(e) => setReplacementSubId(e.target.value)}
                      className="w-full bg-bg-card border border-border-dim px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted focus:outline-none focus:border-accent appearance-none cursor-pointer"
                    >
                      <option value="">Выберите действие...</option>
                      <option value="cancelled" className="text-red-500 font-bold italic">ОТМЕНИТЬ ВСЕ ЗАНЯТИЯ</option>
                      {activeGroup.subjects.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name} ({sub.teacherName || 'Без имени'})</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    onClick={applySubstitution}
                    disabled={!sickTeacher || !replacementSubId}
                    className="w-full bg-red-500/10 border border-red-500 text-red-500 px-6 py-3 rounded-none text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    Применить замену
                  </button>

                  {/* List of active substitutions */}
                  {activeGroup.substitutions?.length > 0 && (
                    <div className="mt-8 space-y-3">
                      <h3 className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted/40">Активные протоколы</h3>
                      {activeGroup.substitutions.map(sub => (
                        <div key={sub.id} className="flex items-center justify-between bg-red-500/5 border border-red-500/20 p-3 rounded text-[9px] font-bold uppercase tracking-widest">
                          <span className="text-red-500">{sub.sickTeacherName}</span>
                          <span className="text-muted">➔</span>
                          <span className="text-accent truncate ml-2">
                            {sub.replacementSubjectId === 'cancelled' ? 'ОТМЕНЕНО' : activeGroup.subjects.find(s => s.id === sub.replacementSubjectId)?.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Display Column */}
            <div className="lg:col-span-8">
              <AnimatePresence mode="wait">
                {activeGroup.schedule ? (
                  <motion.div 
                    key={`${activeGroup.id}-schedule`}
                    id="schedule-to-export"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-20 p-8 pt-4"
                  >
                    <section className="border-b border-border-dim pb-16">
                      <div className="text-[9px] font-bold uppercase tracking-[0.5em] text-accent mb-8">Журнал расписания</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                        <div>
                          <h3 className="text-3xl font-serif italic mb-6 leading-tight">Отчет по оптимизации</h3>
                          <p className="text-xs text-muted leading-relaxed font-medium tracking-tight">
                            Алгоритм успешно распределил предметы для группы <span className="text-[#E0E0E0]">{activeGroup.name}</span>. Система применила циклическую балансировку для минимизации когнитивной нагрузки.
                          </p>
                        </div>
                        <div className="space-y-8 pr-4">
                          <div className="flex gap-6 items-start">
                            <span className="text-[10px] font-mono text-accent bg-accent/10 px-2 py-1">01</span>
                            <p className="text-[10px] font-bold tracking-[0.1em] text-muted uppercase leading-relaxed">Разнообразие обеспечено через инъекцию псевдорандомизированного пула.</p>
                          </div>
                          <div className="flex gap-6 items-start">
                            <span className="text-[10px] font-mono text-accent bg-accent/10 px-2 py-1">02</span>
                            <p className="text-[10px] font-bold tracking-[0.1em] text-muted uppercase leading-relaxed">Интервальные узлы размещены на индексах сессий (2, 4).</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    {activeGroup.schedule.map((day, dIdx) => (
                      <section key={day.day} className="animate-in fade-in slide-in-from-bottom-6 duration-700" style={{ animationDelay: `${dIdx * 150}ms` }}>
                        <div className="mb-10 flex items-center justify-between">
                          <h2 className="text-sm font-serif italic uppercase tracking-[0.5em] text-accent font-normal">{day.day}</h2>
                          <div className="h-px bg-border-dim flex-1 mx-8 opacity-30"></div>
                          <span className="text-[9px] font-mono text-muted/30">DATE_REF: {dIdx + 1}/05</span>
                        </div>

                        <div className="space-y-3">
                          {day.sessions.map((session) => {
                            const isBreak = session.type !== 'class';
                            return (
                              <div 
                                key={session.id}
                                className={`group grid grid-cols-12 items-center gap-6 py-6 px-10 transition-all ${
                                  isBreak 
                                    ? 'bg-transparent border-y border-dashed border-border-dim/30 my-4 opacity-50' 
                                    : 'bg-bg-card border-l-2 border-transparent hover:border-accent hover:bg-bg-active shadow-sm'
                                }`}
                              >
                                <div className="col-span-3">
                                  <div className="font-mono text-[11px] text-muted font-bold tracking-widest uppercase">
                                    {session.startTime} — {session.endTime}
                                  </div>
                                </div>

                                <div className="col-span-6">
                                  {session.subject ? (
                                    <div className="flex items-center gap-4">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold tracking-[0.15em] uppercase text-[#E0E0E0]">{session.subject.name}</span>
                                        {session.subject.teacherName && (
                                          <span className="text-[9px] text-muted font-medium uppercase tracking-tight mt-1">{session.subject.teacherName}</span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-3">
                                      <Hash className="w-3 h-3 text-accent" />
                                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent italic">
                                        {session.type === 'long-break' ? 'Большая перемена' : 'Обычная перемена'}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="col-span-3 text-right">
                                  {!isBreak && (
                                    <span className="text-[9px] font-mono text-muted/40 uppercase tracking-[0.2em] font-bold">
                                      Пара_{session.number}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </motion.div>
                ) : (
                  <div className="h-[70vh] border border-dashed border-border-dim/50 flex flex-col items-center justify-center text-center px-16 space-y-8 bg-bg-card/30">
                    <div className="relative">
                      <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full"></div>
                      <BrainCircuit className="w-16 h-16 text-accent relative z-10 opacity-20" />
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-3xl font-serif italic leading-none">Требуется генерация расписания</h3>
                      <p className="text-muted text-[10px] font-bold uppercase tracking-[0.3em] max-w-sm mx-auto leading-relaxed">
                        Данные для группы <span className="text-accent">#{activeGroup.name.toLowerCase()}</span> идентифицированы. Сгенерируйте сетку для финализации распределения.
                      </p>
                    </div>
                    <button 
                      onClick={handleGenerate}
                      className="border border-accent text-accent px-8 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-accent hover:text-black transition-all"
                    >
                      Рассчитать оптимальную сетку
                    </button>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </main>

          {/* Contextual Action Bar (Fixed Bottom) */}
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-bg-card/80 backdrop-blur-xl border border-border-dim px-6 py-4 rounded-full shadow-2xl z-50">
             <button 
              onClick={() => window.print()}
              className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-accent transition-colors px-4 border-r border-border-dim"
            >
              <Printer className="w-4 h-4" />
              <span>Печать</span>
            </button>
            <div className="flex items-center gap-6 px-4">
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                 <span className="text-[9px] font-bold text-muted uppercase tracking-widest">Активно: {activeGroup.name}</span>
              </div>
              <div className="text-[9px] font-bold text-muted uppercase tracking-widest opacity-50">
                {activeGroup.subjects.length} Предметов
              </div>
            </div>
            <button 
              onClick={handleExportPDF}
              disabled={isExporting || !activeGroup.schedule}
              className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest bg-accent text-black px-6 py-2 rounded-full hover:bg-white transition-all disabled:opacity-50"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isExporting ? 'Создание...' : 'Скачать PDF'}</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1f1f1f;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #C5A059;
        }
        @media print {
          aside { display: none !important; }
          .fixed { display: none !important; }
          header { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .lg\\:col-span-4 { display: none !important; }
          .lg\\:col-span-8 { width: 100% !important; grid-column: span 12 / span 12 !important; }
          body { background: white !important; color: black !important; }
          .bg-bg-card { background: white !important; border: 1px solid #ddd !important; }
          .text-muted { color: #666 !important; }
          .text-accent { color: black !important; border-color: #000 !important; }
          .bg-bg-active { background: #f0f0f0 !important; }
        }
      `}</style>
    </div>
  );
}
