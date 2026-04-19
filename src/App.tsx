/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Music, 
  Timer, 
  Settings, 
  Calendar, 
  ChevronRight, 
  CheckCircle2, 
  TrendingUp,
  LayoutDashboard,
  CirclePlay,
  RotateCcw,
  Plus
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';

import { cn, formatTime, getTodayKeys } from './lib/utils';
import { PracticeSession, Category, CATEGORIES, KEYS, Key } from './types';
import { Metronome, Tuner } from './components/Tools';

// Constants
const MODES_STUDY_SCALES = ['Maggiore', 'Minore Melodica', 'Minore Armonica', 'Doppia Armonica', 'Diminuita', 'Messiaen'];
const PROGRESSIONS = [
  '2-5-1-6',
  '2-b3o-1/3-6',
  '2-5-1-4-7-3-6-6dominant',
  '1-b2o-2-b3o-1/3-6-2-5',
  '1-1/3-4-#4-1/5-6-2-5'
];

// Mock/Initial Goals
const DEFAULT_GOALS: Record<Category, number> = {
  'Progressions': 30,
  'Modes Study': 15,
  'Quartals': 20,
  'Upper Structures': 15,
  'Vocabulary': 20
};

export default function App() {
  const [sessions, setSessions] = useState<PracticeSession[]>(() => {
    const saved = localStorage.getItem('maestroflow_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'timer' | 'history' | 'tools' | 'settings' | 'focus_selection' | 'key_details'>('dashboard');
  const [selectedKey, setSelectedKey] = useState<Key | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category>('Progressions');
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_GOALS['Progressions'] * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_GOALS['Progressions'] * 60);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | undefined>(undefined);
  const [selectedProgression, setSelectedProgression] = useState(() => {
    const saved = localStorage.getItem('maestroflow_selected_progression');
    return saved || PROGRESSIONS[0];
  });
  const [hasStartedAnySession, setHasStartedAnySession] = useState(() => {
    const saved = localStorage.getItem('maestroflow_has_started');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('maestroflow_selected_progression', selectedProgression);
  }, [selectedProgression]);

  useEffect(() => {
    if (sessions.length > 0 && !hasStartedAnySession) {
      setHasStartedAnySession(true);
      localStorage.setItem('maestroflow_has_started', 'true');
    }
  }, [sessions, hasStartedAnySession]);

  useEffect(() => {
    localStorage.setItem('maestroflow_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      handleCompleteSession();
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const handleStartTimer = (category: Category, subCategory?: string) => {
    setSelectedCategory(category);
    setSelectedSubCategory(subCategory);
    setTimeLeft(DEFAULT_GOALS[category] * 60);
    setIsRunning(true);
    setActiveTab('timer');
  };

  const [intensity, setIntensity] = useState(3);

  const handleCompleteSession = () => {
    const duration = Math.round((DEFAULT_GOALS[selectedCategory] * 60 - timeLeft) / 60);
    // Log at least something if they finished
    const sessionDuration = timeLeft === 0 ? DEFAULT_GOALS[selectedCategory] : duration;
    
    if (sessionDuration < 1 && timeLeft > 0) return; 

    const newSession: PracticeSession = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      category: selectedCategory,
      subCategory: selectedSubCategory,
      duration: sessionDuration || 1,
      intensity: intensity,
      key: selectedCategory === 'Progressions' 
        ? getTodayKeys(new Date())[0] as Key 
        : (selectedKey || undefined)
    };

    setSessions([newSession, ...sessions]);
    setIsRunning(false);
    setTimeLeft(DEFAULT_GOALS[selectedCategory] * 60);
    setIntensity(3);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(DEFAULT_GOALS[selectedCategory] * 60);
  };

  // Stats
  const todaySessions = useMemo(() => 
    sessions.filter(s => isSameDay(new Date(s.date), new Date())),
    [sessions]
  );

  const statsByCategory = useMemo(() => {
    return CATEGORIES.map(cat => ({
      name: cat,
      value: todaySessions.filter(s => s.category === cat).reduce((acc, s) => acc + s.duration, 0),
      target: DEFAULT_GOALS[cat]
    }));
  }, [todaySessions]);

  const keysProgress = useMemo(() => {
    const MASTERY_HOURS_PER_KEY = 10000;
    const MASTERY_MINUTES_PER_KEY = MASTERY_HOURS_PER_KEY * 60;
    
    return KEYS.map(key => {
      const totalMinutes = sessions.filter(s => s.key === key).reduce((acc, s) => acc + s.duration, 0);
      const hours = (totalMinutes / 60).toFixed(1);
      return { 
        key, 
        hours, 
        percentage: Math.min((totalMinutes / MASTERY_MINUTES_PER_KEY) * 100, 100) 
      }; 
    });
  }, [sessions]);

  const skillsTotalProgress = useMemo(() => {
    const MASTERY_HOURS = 120000;
    const MASTERY_MINUTES = MASTERY_HOURS * 60;
    
    return CATEGORIES.map(cat => {
      const doneTotal = sessions.filter(s => s.category === cat).reduce((acc, s) => acc + s.duration, 0);
      return { 
        name: cat, 
        percentage: Math.min((doneTotal / MASTERY_MINUTES) * 100, 100) 
      };
    });
  }, [sessions]);

  const weekProgress = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      const daySessions = sessions.filter(s => isSameDay(new Date(s.date), day));
      return {
        name: format(day, 'EEE'),
        total: daySessions.reduce((acc, s) => acc + s.duration, 0)
      };
    });
  }, [sessions]);

  const todayKeys = getTodayKeys(new Date());

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-amber-500/30 overflow-x-hidden">
      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 h-full w-24 bg-zinc-900 border-r border-glass hidden md:flex flex-col items-center py-10 z-50">
        <div className="mb-16">
          <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center border border-glass accent-glow group cursor-pointer transition-all hover:border-amber-500/50">
            <Music className="text-amber-500 w-7 h-7 group-hover:scale-110 transition-transform" />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-10">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "p-4 rounded-2xl transition-all relative group",
              activeTab === 'dashboard' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap uppercase tracking-widest font-bold">Home</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "p-4 rounded-2xl transition-all relative group",
              activeTab === 'history' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Calendar className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap uppercase tracking-widest font-bold">Riepilogo</span>
          </button>
          <button 
            onClick={() => setActiveTab('tools')}
            className={cn(
              "p-4 rounded-2xl transition-all relative group",
              activeTab === 'tools' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Music className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap uppercase tracking-widest font-bold">Tempo & Tuner</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "p-4 rounded-2xl transition-all relative group",
              activeTab === 'settings' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Settings className="w-6 h-6" />
            <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap uppercase tracking-widest font-bold">Impostazioni</span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-6 mt-auto">
          <div className="flex flex-col items-center gap-2 group relative">
            <Calendar className="w-5 h-5 text-zinc-600 hover:text-amber-500 transition-colors pointer-events-auto" />
            <span className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap uppercase tracking-widest font-bold">
              {format(new Date(), 'MMM d')}
            </span>
          </div>
          
          <button className="p-4 text-zinc-500 hover:text-zinc-300 transition-all">
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </nav>

      <main className="min-h-screen flex flex-col items-center w-full relative">
        {/* Header */}
        <header className="w-full px-6 md:px-32 py-6 md:py-8 border-b border-glass flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-md z-40">
          <div className="space-y-1">
            <h1 className="text-amber-500 font-black tracking-tighter text-xl md:text-2xl uppercase">STUDIO PRACTICE.</h1>
            <p className="text-[9px] md:text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500 font-bold">
              Precision Practice System • v1.0
            </p>
          </div>

          <div className="hidden md:flex items-center gap-4">
             {skillsTotalProgress.map(skill => (
               <div key={skill.name} className="flex flex-col items-center px-4 border-r border-glass last:border-0">
                  <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold mb-1">{skill.name}</span>
                  <span className="text-xs font-mono text-zinc-300">{skill.percentage.toFixed(4)}%</span>
               </div>
             ))}
          </div>
        </header>

        <section className="w-full max-w-7xl px-6 md:px-32 py-10 pb-32 md:pb-16 transition-all">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-12 gap-8 w-[320px] mx-auto"
              >
                {/* Top: Key Mastery */}
                <div className="col-span-12 space-y-10 w-[320px]">
                  <div className="bg-zinc-900 p-8 rounded-[2rem] border border-glass accent-glow w-[320px]">
                    <h3 className="flex items-center gap-3 text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-8">
                      <Music className="w-4 h-4 text-amber-500" /> 12 Keys Progress
                    </h3>
                    <div className="grid grid-cols-4 gap-4">
                       {keysProgress.map(kp => (
                         <button 
                           key={kp.key} 
                           onClick={() => {
                             setSelectedKey(kp.key as Key);
                             setActiveTab('key_details');
                           }}
                           className="flex flex-col items-center group cursor-pointer"
                         >
                            <div className="w-10 h-10 rounded-full border border-glass flex items-center justify-center relative overflow-hidden transition-all group-hover:border-amber-500/50">
                               <div className="absolute bottom-0 left-0 right-0 bg-amber-500/20 transition-all duration-700" style={{ height: `${kp.percentage}%` }} />
                               <span className="relative z-10 text-[10px] font-mono font-bold text-zinc-300 group-hover:text-amber-500">{kp.key}</span>
                            </div>
                            <span className="text-[8px] font-mono text-zinc-600 mt-2 transition-colors group-hover:text-zinc-400">{kp.hours}h</span>
                         </button>
                       ))}
                    </div>
                  </div>
                </div>

                {/* Left Column: Focus for today */}
                <div className="col-span-12 lg:col-span-8 space-y-10 w-[320px]">
                  <button 
                    onClick={() => setActiveTab('focus_selection')}
                    className="w-full bg-zinc-900 hover:bg-zinc-800/80 transition-all text-zinc-200 p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-glass relative overflow-hidden accent-glow min-h-[200px] flex items-center justify-center group"
                  >
                    <div className="relative z-10 text-center w-full">
                      <span className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-amber-500 font-black group-hover:text-amber-400 transition-colors">Today's Focus</span>
                      {!hasStartedAnySession ? (
                        <p className="text-zinc-600 text-[10px] uppercase tracking-widest mt-4 font-bold group-hover:text-zinc-400">Configure Practice Slot</p>
                      ) : (
                        <div className="mt-6 space-y-2">
                          <h2 className="text-2xl md:text-3xl font-light text-white tracking-tight break-words px-4">
                            {selectedProgression}
                          </h2>
                          <div className="flex items-center justify-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-amber-500/40" />
                            <span className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 font-bold">Active Module</span>
                            <span className="w-1 h-1 rounded-full bg-amber-500/40" />
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Background Graphic */}
                    <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none translate-x-12 translate-y-12 transition-transform group-hover:scale-110">
                      <Music className="w-80 h-80" />
                    </div>
                  </button>
                </div>

                {/* Right Column: Key Mastery & Skills */}
                <div className="col-span-12 lg:col-span-4 space-y-8">
                  <div className="bg-zinc-900 p-8 rounded-[2rem] border border-glass accent-glow w-[320px]">
                    <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-8">Skill Proficiency</h3>
                    <div className="space-y-6 w-[255px]">
                       {skillsTotalProgress.map(skill => (
                         <div key={skill.name} className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold">
                               <span className="text-zinc-500">{skill.name}</span>
                               <span className="text-amber-500">{skill.percentage.toFixed(4)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${skill.percentage}%` }}
                                 className="h-full bg-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                               />
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                  
                  <div className="bg-zinc-800/20 p-6 rounded-2xl border border-glass text-center italic text-xs text-zinc-500 border-dashed w-[320px]">
                    "Improvise not just with notes, but with your focus."
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'focus_selection' && (
              <motion.div 
                key="focus_selection"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-2xl mx-auto space-y-12 py-10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-light text-white tracking-tight">Practice Focus</h2>
                    <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-1 font-bold">Select your current harmonic challenge</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className="p-4 bg-zinc-900 border border-glass rounded-2xl text-zinc-500 hover:text-zinc-200 transition-all"
                  >
                    <ChevronRight className="w-6 h-6 rotate-180" />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="bg-zinc-900 border border-glass p-8 rounded-[2.5rem] accent-glow">
                    <h3 className="text-amber-500 text-[10px] uppercase tracking-[0.3em] font-black mb-8">Selected Progressions</h3>
                    <div className="grid grid-cols-1 gap-4">
                      {PROGRESSIONS.map(prog => (
                        <button 
                          key={prog}
                          onClick={() => {
                            setSelectedProgression(prog);
                            handleStartTimer('Progressions', prog);
                          }}
                          className={cn(
                            "p-6 rounded-3xl border transition-all text-left group",
                            selectedProgression === prog 
                              ? "bg-amber-500 border-amber-500 text-black shadow-xl shadow-amber-500/20" 
                              : "bg-zinc-800 border-glass text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl font-light">{prog}</span>
                            <CirclePlay className={cn("w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity", selectedProgression === prog && "opacity-100")} />
                          </div>
                          <p className={cn("text-[9px] uppercase tracking-widest mt-2 font-bold", selectedProgression === prog ? "text-black/60" : "text-zinc-600")}>
                            Harmonic Flow Engine
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-zinc-800/10 p-8 rounded-[2.5rem] border border-glass border-dashed text-center">
                    <p className="text-zinc-500 text-xs italic">More modules coming soon...</p>
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'timer' && (
              <motion.div 
                key="timer"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-3xl mx-auto pt-12"
              >
                <div className="bg-zinc-900 border border-glass p-8 md:p-16 rounded-[2.5rem] md:rounded-[4rem] accent-glow relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(timeLeft / (DEFAULT_GOALS[selectedCategory] * 60)) * 100}%` }}
                        className="h-full bg-amber-500 shadow-[0_0_10px_#f59e0b]"
                      />
                   </div>

                   <div className="relative z-10 text-center max-w-md mx-auto">
                     <span className="text-amber-500 font-mono text-[9px] md:text-[10px] tracking-[0.4em] uppercase mb-4 md:mb-6 block font-bold">Active Practice Transmission</span>
                     <h2 className="text-3xl md:text-5xl font-light text-white mb-2 tracking-tight">{selectedCategory}</h2>
                     {selectedSubCategory && (
                       <p className="text-amber-500 font-mono text-[10px] md:text-xs tracking-widest uppercase mb-6 font-bold">{selectedSubCategory}</p>
                     )}
                     {selectedCategory === 'Progressions' && (
                       <span className="px-4 md:px-5 py-1 md:py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-10 md:mb-16 inline-block">
                        Harmonic Focus: {getTodayKeys(new Date()).join(' & ')}
                       </span>
                     )}

                     {selectedCategory === 'Modes Study' && (
                       <div className="flex flex-wrap justify-center gap-2 mb-8">
                         {MODES_STUDY_SCALES.map((scale) => (
                           <button
                             key={scale}
                             onClick={() => setSelectedSubCategory(scale)}
                             className={cn(
                               "px-4 py-1.5 rounded-full text-[9px] uppercase tracking-widest font-bold transition-all border",
                               selectedSubCategory === scale 
                                 ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20"
                                 : "bg-zinc-800/50 border-glass text-zinc-500 hover:text-zinc-300"
                             )}
                           >
                             {scale}
                           </button>
                         ))}
                       </div>
                     )}
                     
                     <div className="my-10 md:my-20 flex items-center justify-center">
                       <div className="relative">
                         {/* Radial Track decoration */}
                         <div className="absolute inset-0 -m-4 md:-m-12 border border-zinc-800 rounded-full" />
                         <div className="absolute inset-0 -m-6 md:-m-20 border border-dashed border-zinc-700/50 rounded-full animate-spin-slow" />
                         
                         <span className="text-6xl md:text-[10rem] font-light text-white leading-none tracking-tighter tabular-nums drop-shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                           {formatTime(timeLeft)}
                         </span>
                       </div>
                     </div>

                     <div className="mt-12 flex flex-col items-center gap-6">
                       <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-black">Session Intensity Scale</span>
                       <div className="flex gap-3">
                         {[1, 2, 3, 4, 5].map((level) => (
                           <button
                             key={level}
                             onClick={() => setIntensity(level)}
                             className={cn(
                               "w-12 h-12 rounded-2xl flex items-center justify-center font-mono text-sm transition-all border group relative overflow-hidden",
                               intensity === level 
                                 ? "bg-amber-500 border-amber-500 text-black shadow-xl shadow-amber-500/20" 
                                 : "border-glass text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                             )}
                           >
                             <span className="relative z-10">{level}</span>
                             {intensity === level && (
                               <motion.div layoutId="intensity-orb" className="absolute inset-0 bg-white/20" />
                             )}
                           </button>
                         ))}
                       </div>
                     </div>

                     <div className="flex items-center justify-center gap-10 mt-20">
                       <button 
                         onClick={resetTimer}
                         className="p-5 rounded-3xl border border-glass text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all group"
                       >
                         <RotateCcw className="w-7 h-7 group-active:rotate-180 transition-transform duration-500" />
                       </button>
                       
                       <button 
                        onClick={() => setIsRunning(!isRunning)}
                        className={cn(
                          "px-16 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs transition-all scale-100 active:scale-95 shadow-2xl",
                          isRunning ? "bg-white text-zinc-900" : "bg-amber-500 text-black hover:bg-amber-400"
                        )}
                       >
                         {isRunning ? 'Interrupt' : 'Transmit'}
                       </button>
                       
                       <button 
                         onClick={handleCompleteSession}
                         className="p-5 rounded-3xl border border-glass text-zinc-500 hover:text-amber-500 hover:bg-zinc-800 transition-all"
                       >
                         <CheckCircle2 className="w-7 h-7" />
                       </button>
                     </div>
                   </div>
                </div>

                {/* Integrated Utilities for practice */}
                <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                   <Metronome />
                   <Tuner />
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-4xl mx-auto"
              >
                <div className="flex items-center justify-between mb-8 md:mb-12 px-2">
                  <div className="space-y-1">
                    <h2 className="text-3xl md:text-4xl font-light text-white tracking-tight">Practice Narrative</h2>
                    <p className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">Weekly Performance Logs</p>
                  </div>
                  <div className="bg-zinc-900 px-4 md:px-6 py-2 md:py-3 border border-glass rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 accent-glow">
                    {sessions.length} Logs
                  </div>
                </div>

                <div className="space-y-4">
                  {sessions.length === 0 ? (
                    <div className="bg-zinc-900 p-20 rounded-[3rem] border border-dashed border-glass text-center">
                      <Music className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
                      <p className="text-zinc-500 text-sm italic font-serif">No study logs detected. Data acquisition required.</p>
                      <button 
                        onClick={() => setActiveTab('dashboard')}
                        className="mt-8 text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 border-b border-amber-500/20 pb-1"
                      >
                        Initiate Sequence
                      </button>
                    </div>
                  ) : (
                    sessions.map((s) => (
                      <div key={s.id} className="bg-zinc-900 p-6 md:p-8 rounded-2xl md:rounded-[2rem] border border-glass flex flex-col md:flex-row md:items-center justify-between hover:border-zinc-700 transition-all accent-glow gap-4 md:gap-0">
                        <div className="flex items-center gap-4 md:gap-8">
                           <div className="w-12 h-12 md:w-16 h-16 bg-zinc-800 rounded-xl md:rounded-2xl flex items-center justify-center border border-glass shrink-0">
                              <Music className="w-5 h-5 md:w-6 h-6 text-amber-500 opacity-40" />
                           </div>
                           <div>
                             <h4 className="text-lg md:text-xl font-light text-white tracking-tight">
                               {s.category}{s.subCategory ? ` • ${s.subCategory}` : ''}
                             </h4>
                             <p className="text-[9px] md:text-[10px] font-mono uppercase tracking-widest text-zinc-500 mt-1">
                               {format(new Date(s.date), 'MMM d, h:mm a')} • {s.key ? `Harmonic: ${s.key}` : 'Technical focus'}
                             </p>
                           </div>
                        </div>
                        <div className="flex items-center justify-between md:justify-end gap-6 md:gap-12 border-t border-glass md:border-t-0 pt-4 md:pt-0">
                          <div className="text-left md:text-center">
                            <span className="text-[9px] font-mono text-zinc-500 block uppercase mb-1">Intensity</span>
                            <div className="flex gap-1">
                               {[...Array(5)].map((_, i) => (
                                 <div key={i} className={cn("w-1 md:w-1.5 h-1 md:h-1.5 rounded-full", i < s.intensity ? "bg-amber-500" : "bg-zinc-800")} />
                               ))}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl md:text-3xl font-light text-white tabular-nums">{s.duration}m</span>
                            <p className="text-[8px] md:text-[10px] uppercase tracking-tighter text-zinc-600 font-bold">Focus Span</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
            {activeTab === 'key_details' && (
              <motion.div 
                key="key_details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-md mx-auto space-y-12 py-6 w-[320px]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-4xl font-light text-white tracking-tighter">Key: {selectedKey}</h2>
                    <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-1 font-bold">Specific Practice Modules</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className="p-4 bg-zinc-900 border border-glass rounded-2xl text-zinc-500 hover:text-zinc-200 transition-all"
                  >
                    <ChevronRight className="w-6 h-6 rotate-180" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {CATEGORIES.filter(cat => cat !== 'Progressions').map((cat) => {
                    const done = todaySessions
                      .filter(s => s.category === cat && s.key === selectedKey)
                      .reduce((acc, s) => acc + s.duration, 0);
                    const target = DEFAULT_GOALS[cat];
                    const progress = Math.min((done / target) * 100, 100);

                    return (
                      <div 
                        key={cat}
                        className={cn(
                          "group bg-zinc-900 border border-glass p-6 rounded-3xl flex items-center justify-between hover:border-amber-500/30 transition-all cursor-pointer accent-glow",
                          progress >= 100 && "ring-1 ring-amber-500/20"
                        )}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setSelectedSubCategory(undefined);
                          setTimeLeft(DEFAULT_GOALS[cat] * 60);
                          setIsRunning(true);
                          setActiveTab('timer');
                        }}
                      >
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                            progress >= 100 ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-500"
                          )}>
                            {progress >= 100 ? <CheckCircle2 className="w-6 h-6" /> : <Timer className="w-5 h-5" />}
                          </div>
                          
                          <div>
                            <h4 className="font-semibold text-zinc-100 text-sm">{cat}</h4>
                            <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 mt-1">
                              {done}/{target} Min Focus
                            </p>
                          </div>
                        </div>

                        <div className="w-1 h-8 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${progress}%` }}
                            className={cn("w-full transition-colors", progress >= 100 ? "bg-amber-500" : "bg-zinc-600")}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
            {activeTab === 'tools' && (
              <motion.div 
                key="tools"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-12 gap-8 w-[320px] mx-auto"
              >
                <div className="col-span-12 lg:col-span-6">
                  <Metronome />
                </div>
                <div className="col-span-12 lg:col-span-6">
                  <Tuner />
                </div>
              </motion.div>
            )}
            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-2xl mx-auto space-y-12 py-10 w-[320px]"
              >
                <div className="space-y-2">
                  <h2 className="text-4xl font-light text-white tracking-tighter uppercase">Impostazioni</h2>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-bold">Configuration & Preferences</p>
                </div>
                
                <div className="bg-zinc-900 border border-glass p-8 rounded-[2.5rem] accent-glow text-center">
                   <Settings className="w-12 h-12 text-zinc-800 mx-auto mb-6" />
                   <p className="text-zinc-500 text-sm italic">User preferences panel under development.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Footer Navigation (Mobile) */}
      <div className="md:hidden fixed bottom-8 left-8 right-8 h-20 bg-zinc-900 border border-glass rounded-[2rem] flex items-center justify-around px-8 z-50 accent-glow">
        <button onClick={() => setActiveTab('dashboard')} className={cn("p-3 rounded-xl", activeTab === 'dashboard' ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-500')}><LayoutDashboard /></button>
        <button onClick={() => setActiveTab('history')} className={cn("p-3 rounded-xl", activeTab === 'history' ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-500')}><Calendar /></button>
        <button onClick={() => setActiveTab('tools')} className={cn("p-3 rounded-xl", activeTab === 'tools' ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-500')}><Music /></button>
        <button onClick={() => setActiveTab('settings')} className={cn("p-3 rounded-xl", activeTab === 'settings' ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-500')}><Settings /></button>
      </div>
    </div>
  );
}
