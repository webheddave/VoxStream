import { GoogleGenAI, LiveSession, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, base64ToBytes, decodeAudioData, resampleTo16k } from '../audioUtils';
import { VoiceName, PersonaStyle } from '../types';

export class LiveManager {
  private ai: GoogleGenAI | null = null;
  private sessionPromise: Promise<LiveSession> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private nextStartTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  
  // Callbacks for UI updates
  public onConnect: () => void = () => {};
  public onDisconnect: () => void = () => {};
  public onError: (error: string) => void = () => {};

  constructor() {
    // Initialization moved to connect()
  }

  public async connect(voice: VoiceName, persona: PersonaStyle) {
    try {
      // Initialize AI client right before connection to ensure API key is present and fresh
      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      // Attempt to create context with 16k, but be prepared for browser to ignore it
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Setup Analysers
      this.inputAnalyser = this.inputAudioContext.createAnalyser();
      this.inputAnalyser.fftSize = 256;
      
      this.outputAnalyser = this.outputAudioContext.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioContext.destination);

      // Get Mic Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup Gemini Connection
      const systemInstruction = this.getSystemInstruction(persona);
      
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
          systemInstruction: systemInstruction,
        },
        callbacks: {
          onopen: this.handleOpen.bind(this, stream),
          onmessage: this.handleMessage.bind(this),
          onerror: (e: any) => {
            console.error('Gemini Live Error:', e);
            // Handle various error shapes
            let msg = 'Connection error occurred';
            if (e instanceof Error) msg = e.message;
            else if (typeof e === 'string') msg = e;
            
            this.onError(msg);
            this.disconnect();
          },
          onclose: () => {
            console.log('Gemini Live Closed');
            this.disconnect();
          },
        },
      };

      this.sessionPromise = this.ai.live.connect(config);
      
      // Catch initial connection failure (e.g. 403, Network Error)
      this.sessionPromise.catch((err) => {
          console.error("Session connection failed:", err);
          this.onError("Failed to connect: " + (err.message || "Network Error. Check API Key."));
          this.disconnect();
      });

    } catch (error: any) {
      console.error("Connection setup failed", error);
      this.onError(error.message || 'Failed to access microphone or connect.');
      this.disconnect();
    }
  }

  private getSystemInstruction(persona: PersonaStyle): string {
    const base = "You are a voice repeater AI.";
    switch (persona) {
      case PersonaStyle.Echo:
        return `${base} Repeat EXACTLY what the user says. Be a perfect echo. Do not answer questions. Do not add commentary. Just repeat the audio content verbatim.`;
      case PersonaStyle.Pirate:
        return `${base} Repeat what the user says but convert it into the speech of a 17th-century pirate. Use pirate slang like 'Ahoy', 'Matey', 'Yarr'. Do not answer questions, just transform the speech.`;
      case PersonaStyle.Robot:
        return `${base} Repeat what the user says in a cold, logical, robotic manner. Be concise. Use terminology like 'Affirmative' or 'Processing'. Do not answer questions, just repeat the content robotically.`;
      case PersonaStyle.Wizard:
        return `${base} Repeat what the user says but sound like a mystical ancient wizard. Use archaic words. Do not answer questions, just transform the speech into a wizard's proclamation.`;
      case PersonaStyle.NewsAnchor:
        return `${base} Repeat what the user says in the style of a breaking news alert. Be professional, urgent, and dramatic. Start with 'Breaking News:'. Do not answer questions.`;
      default:
        return `${base} Repeat exactly what the user says.`;
    }
  }

  private handleOpen(stream: MediaStream) {
    this.onConnect();
    if (!this.inputAudioContext) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    // Connect source to analyser for visualizer
    this.inputSource.connect(this.inputAnalyser!);

    // Processor for streaming data to API
    // Use 4096 buffer size. At 16k = 256ms, at 48k = 85ms.
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      if (!this.inputAudioContext) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      
      // CRITICAL: Ensure we send 16000Hz data to Gemini.
      // Browsers often ignore the requested sampleRate in AudioContext constructor.
      const currentSampleRate = this.inputAudioContext.sampleRate;
      const downsampledData = resampleTo16k(inputData, currentSampleRate);
      
      // Create Blob with strict 16000Hz label
      const pcmBlob = createPcmBlob(downsampledData, 16000);
      
      if (this.sessionPromise) {
        this.sessionPromise.then((session) => {
           session.sendRealtimeInput({ media: pcmBlob });
        }).catch(err => {
           // Session might be closed or closing, ignore specific send errors here
           // as the main onError handler will catch general failures.
        });
      }
    };

    this.inputSource.connect(this.processor);
    // Must connect processor to destination for it to fire, but script processor output is silent by default
    // unless we copy input to output (which we don't).
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    if (!this.outputAudioContext || !this.outputNode) return;

    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      try {
        // Ensure output context is running (browsers suspend it sometimes)
        if (this.outputAudioContext.state === 'suspended') {
            await this.outputAudioContext.resume();
        }

        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        
        const audioBytes = base64ToBytes(base64Audio);
        // Output from Gemini Live is 24000Hz
        const audioBuffer = await decodeAudioData(audioBytes, this.outputAudioContext, 24000, 1);
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode);
        
        source.addEventListener('ended', () => {
          this.activeSources.delete(source);
        });

        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.activeSources.add(source);

      } catch (err) {
        console.error("Error decoding audio", err);
      }
    }

    if (message.serverContent?.interrupted) {
       this.stopAllAudio();
    }
  }

  private stopAllAudio() {
    this.activeSources.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    this.activeSources.clear();
    
    // Reset cursor to current time
    if (this.outputAudioContext) {
        this.nextStartTime = this.outputAudioContext.currentTime;
    } else {
        this.nextStartTime = 0;
    }
  }

  public disconnect() {
    this.onDisconnect();
    
    if (this.sessionPromise) {
        this.sessionPromise.then(s => s.close()).catch(() => {});
        this.sessionPromise = null;
    }

    if (this.inputSource) {
        this.inputSource.disconnect();
        this.inputSource = null;
    }
    if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
    }
    
    if (this.inputAudioContext) {
        this.inputAudioContext.close();
        this.inputAudioContext = null;
    }

    this.stopAllAudio();
    
    if (this.outputAudioContext) {
        this.outputAudioContext.close();
        this.outputAudioContext = null;
    }
  }

  public setVolume(val: number) {
    if (this.outputNode && this.outputAudioContext) {
        // val is 0-100
        this.outputNode.gain.value = val / 100;
    }
  }

  public getInputAnalyser() {
    return this.inputAnalyser;
  }

  public getOutputAnalyser() {
    return this.outputAnalyser;
  }
}