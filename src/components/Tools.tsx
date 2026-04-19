import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, ChevronLeft, ChevronRight, Mic, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

// --- Pitch Detection Utility ---
const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function getNote(frequency: number) {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  const roundedNote = Math.round(noteNum) + 69;
  const name = noteNames[roundedNote % 12];
  const octave = Math.floor(roundedNote / 12) - 1;
  const cents = Math.round(100 * (noteNum - Math.round(noteNum)));
  return { name, octave, cents };
}

// Simple autocorrelation algorithm for pitch detection
function autoCorrelate(buffer: Float32Array, sampleRate: number) {
  let size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1; // Too quiet

  let r1 = 0, r2 = size - 1, thres = 0.2;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buffer[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buffer[size - i]) < thres) {
      r2 = size - i;
      break;
    }
  }

  const buf = buffer.slice(r1, r2);
  size = buf.length;

  const c = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] = c[i] + buf[j] * buf[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < size; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  let T0 = maxpos;

  return sampleRate / T0;
}

// --- Metronome Component ---
export const Metronome = () => {
  const [bpm, setBpm] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const nextNoteTime = useRef(0);
  const timerID = useRef<number | null>(null);
  const scheduleAheadTime = 0.1; // How far ahead to schedule audio (sec)

  const playClick = (time: number) => {
    if (!audioContext.current) return;
    const osc = audioContext.current.createOscillator();
    const envelope = audioContext.current.createGain();

    osc.frequency.value = 1000;
    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(envelope);
    envelope.connect(audioContext.current.destination);

    osc.start(time);
    osc.stop(time + 0.1);
  };

  const scheduler = () => {
    while (audioContext.current && nextNoteTime.current < audioContext.current.currentTime + scheduleAheadTime) {
      playClick(nextNoteTime.current);
      const secondsPerBeat = 60.0 / bpm;
      nextNoteTime.current += secondsPerBeat;
    }
    timerID.current = window.setTimeout(scheduler, 25);
  };

  useEffect(() => {
    if (isPlaying) {
      if (!audioContext.current) audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      nextNoteTime.current = audioContext.current.currentTime;
      scheduler();
    } else {
      if (timerID.current) window.clearTimeout(timerID.current);
    }
    return () => {
      if (timerID.current) window.clearTimeout(timerID.current);
    };
  }, [isPlaying, bpm]);

  return (
    <div className="bg-zinc-900 border border-glass p-8 rounded-[2rem] accent-glow w-[320px]">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">Tempo Engine</h3>
        <div className="flex items-center gap-2">
           <Activity className={cn("w-4 h-4 text-amber-500", isPlaying && "animate-pulse")} />
           <span className="text-[10px] font-mono text-zinc-500">ACTIVE</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-8">
        <div className="relative">
          <div className="text-7xl font-light text-white font-mono tabular-nums leading-none">
            {bpm}
          </div>
          <span className="absolute -right-10 bottom-0 text-xs text-zinc-600 font-bold uppercase tracking-widest">BPM</span>
        </div>

        <div className="flex items-center gap-4 w-full">
          <button onClick={() => setBpm(Math.max(40, bpm - 1))} className="p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"><ChevronLeft className="w-5 h-5"/></button>
          <input 
            type="range" 
            min="40" 
            max="240" 
            value={bpm} 
            onChange={(e) => setBpm(parseInt(e.target.value))}
            className="flex-1 accent-amber-500 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer"
          />
          <button onClick={() => setBpm(Math.min(240, bpm + 1))} className="p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"><ChevronRight className="w-5 h-5"/></button>
        </div>

        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className={cn(
            "w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all",
            isPlaying ? "bg-white text-zinc-900" : "bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/10"
          )}
        >
          {isPlaying ? "Suspend Pulse" : "Initialize BPM"}
        </button>
      </div>
    </div>
  );
};

// --- Tuner Component ---
export const Tuner = () => {
  const [pitch, setPitch] = useState<number>(-1);
  const [note, setNote] = useState<{name: string, octave: number, cents: number} | null>(null);
  const [isListening, setIsListening] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const microphone = useRef<MediaStreamAudioSourceNode | null>(null);
  const requestRef = useRef<number | null>(null);

  const startTuner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 2048;
      microphone.current = audioContext.current.createMediaStreamSource(stream);
      microphone.current.connect(analyser.current);
      setIsListening(true);
      updatePitch();
    } catch (err) {
      console.error("Mic access denied", err);
    }
  };

  const updatePitch = () => {
    if (!analyser.current) return;
    const buffer = new Float32Array(analyser.current.fftSize);
    analyser.current.getFloatTimeDomainData(buffer);
    const p = autoCorrelate(buffer, audioContext.current!.sampleRate);
    if (p !== -1) {
      setPitch(p);
      setNote(getNote(p));
    }
    requestRef.current = requestAnimationFrame(updatePitch);
  };

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (audioContext.current) audioContext.current.close();
    };
  }, []);

  return (
    <div className="bg-zinc-900 border border-glass p-8 rounded-[2rem] accent-glow w-[320px]">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">Frequency Analyzer</h3>
        <button 
          onClick={() => isListening ? setIsListening(false) : startTuner()}
          className={cn("p-2 rounded-lg transition-colors", isListening ? "text-amber-500 bg-amber-500/10" : "text-zinc-600")}
        >
          <Mic className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="relative h-32 flex items-center justify-center w-full">
           {note ? (
             <motion.div 
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="text-center"
             >
               <div className="flex items-baseline justify-center">
                 <span className="text-8xl font-light text-white tracking-tighter tabular-nums">{note.name}</span>
                 <span className="text-2xl text-amber-500 font-mono ml-2">{note.octave}</span>
               </div>
               <div className="mt-4 w-full max-w-[200px] h-1 bg-zinc-800 rounded-full relative overflow-hidden">
                  <motion.div 
                    animate={{ x: `${note.cents}%` }}
                    className={cn(
                      "absolute top-0 bottom-0 w-1/2 rounded-full transition-all",
                      Math.abs(note.cents) < 10 ? "bg-green-500" : "bg-amber-500"
                    )}
                    style={{ left: '25%' }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/40" />
               </div>
               <p className="text-[10px] uppercase tracking-widest text-zinc-600 mt-2 font-bold">
                 {note.cents > 0 ? `Sharp +${note.cents}` : note.cents < 0 ? `Flat ${note.cents}` : "In Tune"}
               </p>
             </motion.div>
           ) : (
             <div className="text-zinc-700 flex flex-col items-center gap-4">
               <Activity className="w-12 h-12 opacity-20" />
               <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Awaiting Signal</span>
             </div>
           )}
        </div>

        <div className="w-full h-8 bg-zinc-800/30 border border-glass rounded-xl px-4 flex items-center justify-between">
           <span className="text-[10px] font-mono text-zinc-600">Hz</span>
           <span className="text-xs font-mono text-zinc-400">{pitch !== -1 ? Math.round(pitch * 10) / 10 : "---"}</span>
        </div>
      </div>
    </div>
  );
};
