
export enum VoiceName {
  Puck = 'Puck',
  Charon = 'Charon',
  Kore = 'Kore',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr',
}

export enum PersonaStyle {
  Echo = 'Echo', // Repeats verbatim
  Pirate = 'Pirate',
  Robot = 'Robot',
  Wizard = 'Wizard',
  NewsAnchor = 'News Anchor',
}

export enum AudioFilter {
  None = 'None',
  Telephone = 'Telephone',
  Space = 'Space',
  Echo = 'Echo',
  Robot = 'Robot',
  OldRadio = 'Old Radio',
}

export interface StreamingState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  volume: number; // 0-100
}

export interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  color: string;
}

export interface Preset {
  id: string;
  name: string;
  voice: VoiceName;
  persona: PersonaStyle;
  filter: AudioFilter;
}
