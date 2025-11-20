
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveManager } from './services/liveManager';
import { VoiceName, PersonaStyle, StreamingState, Preset, AudioFilter } from './types';
import Visualizer from './components/Visualizer';
import { 
  MicrophoneIcon, 
  StopIcon, 
  SpeakerWaveIcon, 
  SparklesIcon, 
  UserCircleIcon,
  BookmarkSquareIcon,
  TrashIcon,
  PlusIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/solid';

export default function App() {
  const [state, setState] = useState<StreamingState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    volume: 75,
  });

  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Puck);
  const [selectedPersona, setSelectedPersona] = useState<PersonaStyle>(PersonaStyle.Echo);
  const [selectedFilter, setSelectedFilter] = useState<AudioFilter>(AudioFilter.None);
  const [transcription, setTranscription] = useState<string>('');
  
  // Presets State
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');

  // Ref to hold the service instance to persist across renders
  const liveManagerRef = useRef<LiveManager | null>(null);
  
  // Refs for analysers to pass to visualizers
  const [inputAnalyser, setInputAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);

  const transcriptionContainerRef = useRef<HTMLDivElement>(null);

  // Load presets from local storage on mount
  useEffect(() => {
    const savedPresets = localStorage.getItem('voxstream_presets');
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error("Failed to load presets", e);
      }
    }
  }, []);

  // Save presets to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('voxstream_presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    liveManagerRef.current = new LiveManager();
    
    liveManagerRef.current.onConnect = () => {
      setState(prev => ({ ...prev, isConnected: true, isConnecting: false, error: null }));
      setInputAnalyser(liveManagerRef.current?.getInputAnalyser() || null);
      setOutputAnalyser(liveManagerRef.current?.getOutputAnalyser() || null);
    };

    liveManagerRef.current.onDisconnect = () => {
      setState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
      setInputAnalyser(null);
      setOutputAnalyser(null);
    };

    liveManagerRef.current.onError = (msg) => {
      setState(prev => ({ ...prev, error: msg, isConnected: false, isConnecting: false }));
    };

    liveManagerRef.current.onTranscription = (text) => {
      setTranscription(prev => prev + text);
    };

    return () => {
      liveManagerRef.current?.disconnect();
    };
  }, []);

  // Auto-scroll transcription
  useEffect(() => {
    if (transcriptionContainerRef.current) {
      transcriptionContainerRef.current.scrollTop = transcriptionContainerRef.current.scrollHeight;
    }
  }, [transcription]);

  useEffect(() => {
    // Update volume whenever state changes
    if (liveManagerRef.current) {
        liveManagerRef.current.setVolume(state.volume);
    }
  }, [state.volume]);

  // Update filter in real-time if connected
  useEffect(() => {
    if (liveManagerRef.current) {
      liveManagerRef.current.setFilter(selectedFilter);
    }
  }, [selectedFilter]);

  const handleToggleStream = useCallback(() => {
    if (state.isConnected) {
      liveManagerRef.current?.disconnect();
    } else {
      setTranscription('');
      setState(prev => ({ ...prev, isConnecting: true, error: null }));
      liveManagerRef.current?.connect(selectedVoice, selectedPersona, selectedFilter);
    }
  }, [state.isConnected, selectedVoice, selectedPersona, selectedFilter]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState(prev => ({ ...prev, volume: parseInt(e.target.value) }));
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    
    const newPreset: Preset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      voice: selectedVoice,
      persona: selectedPersona,
      filter: selectedFilter
    };
    
    setPresets(prev => [...prev, newPreset]);
    setNewPresetName('');
  };

  const handleLoadPreset = (preset: Preset) => {
    if (state.isConnected) return;
    setSelectedVoice(preset.voice);
    setSelectedPersona(preset.persona);
    setSelectedFilter(preset.filter || AudioFilter.None); // Handle legacy presets
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresets(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black">
      
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Header & Status */}
        <div className="md:col-span-12 text-center mb-4">
           <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 tracking-tight mb-2">
             VoxStream AI
           </h1>
           <p className="text-slate-400">Real-time AI Persona Voice Changer</p>
        </div>

        {/* Main Visualizer Area */}
        <div className="md:col-span-12 bg-slate-900/50 rounded-2xl border border-slate-800 p-6 shadow-2xl relative overflow-hidden">
          
          {/* Status Indicator */}
          <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2 border ${state.isConnected ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
             <div className={`w-2 h-2 rounded-full ${state.isConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}></div>
             {state.isConnected ? 'LIVE UPLINK ACTIVE' : 'OFFLINE'}
          </div>

          <div className="space-y-6">
             <div>
               <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 block">Input Source (Microphone)</label>
               <Visualizer analyser={inputAnalyser} color="#22d3ee" />
               
               {/* Transcription Display */}
               <div 
                 ref={transcriptionContainerRef}
                 className="mt-2 h-20 bg-black/20 rounded-lg border border-cyan-500/20 p-3 overflow-y-auto text-sm font-mono shadow-inner transition-colors duration-300"
               >
                 {transcription ? (
                   <p className="text-cyan-200 whitespace-pre-wrap leading-relaxed">{transcription}</p>
                 ) : (
                   <p className="text-slate-600 italic">Listening for speech...</p>
                 )}
               </div>
             </div>

             <div>
                <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 block">AI Output ({selectedVoice} + {selectedFilter})</label>
                <Visualizer analyser={outputAnalyser} color="#a855f7" />
             </div>
          </div>

          {state.error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded text-sm text-center">
              Error: {state.error}
            </div>
          )}
        </div>

        {/* Controls - Left Column */}
        <div className="md:col-span-5 bg-slate-800/40 rounded-xl p-6 border border-slate-700 backdrop-blur-md flex flex-col gap-6">
           
            {/* Voice Selector */}
            <div>
               <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
                  <UserCircleIcon className="w-5 h-5 text-cyan-400" />
                  Target Voice
               </label>
               <div className="grid grid-cols-3 gap-2">
                  {Object.values(VoiceName).map((voice) => (
                     <button
                       key={voice}
                       onClick={() => !state.isConnected && setSelectedVoice(voice)}
                       disabled={state.isConnected}
                       className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                          selectedVoice === voice 
                          ? 'bg-cyan-500 text-white border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]' 
                          : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
                       }`}
                     >
                        {voice}
                     </button>
                  ))}
               </div>
            </div>

            {/* Persona Selector */}
            <div>
               <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
                  <SparklesIcon className="w-5 h-5 text-purple-400" />
                  Persona Style
               </label>
               <select 
                  value={selectedPersona}
                  onChange={(e) => setSelectedPersona(e.target.value as PersonaStyle)}
                  disabled={state.isConnected}
                  className="w-full bg-slate-900 border border-slate-600 text-slate-200 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                  {Object.values(PersonaStyle).map((style) => (
                     <option key={style} value={style}>{style}</option>
                  ))}
               </select>
            </div>

            {/* Audio Filter Selector */}
            <div>
               <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
                  <AdjustmentsHorizontalIcon className="w-5 h-5 text-pink-400" />
                  Voice Filter
               </label>
               <div className="grid grid-cols-3 gap-2">
                  {Object.values(AudioFilter).map((filter) => (
                     <button
                       key={filter}
                       onClick={() => setSelectedFilter(filter)}
                       className={`px-2 py-2 rounded-lg text-[10px] font-semibold transition-all duration-200 border truncate ${
                          selectedFilter === filter 
                          ? 'bg-pink-600 text-white border-pink-400 shadow-[0_0_10px_rgba(219,39,119,0.5)]' 
                          : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700'
                       }`}
                     >
                        {filter}
                     </button>
                  ))}
               </div>
            </div>

            {/* Preset Manager */}
            <div className="pt-4 border-t border-slate-700/50">
               <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
                  <BookmarkSquareIcon className="w-5 h-5 text-amber-400" />
                  Saved Presets
               </label>
               
               {/* Save Control */}
               <div className="flex gap-2 mb-3">
                  <input 
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="New preset name..."
                    disabled={state.isConnected}
                    className="flex-1 bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded-lg focus:ring-amber-500 focus:border-amber-500 p-2 disabled:opacity-50"
                  />
                  <button 
                    onClick={handleSavePreset}
                    disabled={!newPresetName.trim() || state.isConnected}
                    className="bg-amber-600 hover:bg-amber-500 text-white p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <PlusIcon className="w-4 h-4" />
                  </button>
               </div>

               {/* Preset List */}
               <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                  {presets.length === 0 && (
                     <p className="text-xs text-slate-600 text-center italic py-2">No presets saved</p>
                  )}
                  {presets.map(preset => (
                    <div 
                      key={preset.id}
                      onClick={() => handleLoadPreset(preset)}
                      className={`group flex items-center justify-between p-2 rounded bg-slate-700/30 border border-transparent hover:border-slate-600 cursor-pointer transition-all ${
                        selectedVoice === preset.voice && selectedPersona === preset.persona && (preset.filter === selectedFilter || (!preset.filter && selectedFilter === AudioFilter.None))
                          ? 'border-amber-500/50 bg-amber-500/10' 
                          : ''
                      } ${state.isConnected ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-700/50'}`}
                    >
                       <div className="flex flex-col overflow-hidden">
                          <span className="text-xs font-medium text-slate-200 truncate">{preset.name}</span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {preset.voice} / {preset.persona} / {preset.filter || 'None'}
                          </span>
                       </div>
                       <button
                          onClick={(e) => handleDeletePreset(preset.id, e)}
                          disabled={state.isConnected}
                          className="text-slate-500 hover:text-red-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:hidden"
                       >
                          <TrashIcon className="w-3 h-3" />
                       </button>
                    </div>
                  ))}
               </div>
            </div>
        </div>

        {/* Controls - Right Column */}
        <div className="md:col-span-7 flex flex-col gap-4">
           
           {/* Main Action Button */}
           <button
             onClick={handleToggleStream}
             disabled={state.isConnecting}
             className={`w-full h-20 rounded-xl flex items-center justify-center gap-3 text-lg font-bold transition-all duration-300 shadow-xl group ${
                state.isConnected 
                  ? 'bg-red-500/10 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 border-t border-white/20'
             }`}
           >
              {state.isConnecting ? (
                 <span className="animate-pulse">CONNECTING...</span>
              ) : state.isConnected ? (
                 <>
                   <StopIcon className="w-8 h-8" /> STOP STREAM
                 </>
              ) : (
                 <>
                   <MicrophoneIcon className="w-8 h-8 group-hover:scale-110 transition-transform" /> GO LIVE
                 </>
              )}
           </button>

           {/* Volume Control */}
           <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700 backdrop-blur-md flex-1 flex flex-col justify-center">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-4">
                 <SpeakerWaveIcon className="w-5 h-5 text-green-400" />
                 Output Volume ({state.volume}%)
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={state.volume}
                onChange={handleVolumeChange}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-400"
              />
           </div>

           {/* Latency Note */}
           <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-4">
              <p className="text-xs text-blue-300 text-center">
                 <strong>Note:</strong> This is an AI-driven transformation. There will be a natural delay as the AI processes your speech and regenerates it with the selected persona.
              </p>
           </div>

        </div>
      </div>
    </div>
  );
}
