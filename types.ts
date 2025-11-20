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
