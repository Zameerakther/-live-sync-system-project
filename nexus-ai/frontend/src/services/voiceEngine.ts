import { SupportedLanguage } from '../types';

export interface VoiceEngineCallbacks {
  onSpeechResult: (text: string) => void;
  onWakeWordDetected: (word: string) => void;
  onAudioLevel: (level: number) => void;
  onStateChange: (listening: boolean, speaking: boolean) => void;
}

export class VoiceEngine {
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  
  private isListening: boolean = false;
  private isSpeaking: boolean = false;
  private currentWakeWord: string = 'Nexus';
  private currentLang: SupportedLanguage = 'AUTO';

  private callbacks?: VoiceEngineCallbacks;

  constructor(callbacks?: VoiceEngineCallbacks) {
    this.callbacks = callbacks;
    this.initSpeechRecognition();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    }
  }

  private initSpeechRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }

        const trimmed = transcript.trim();
        if (!trimmed) return;

        // Barge-in: if user starts speaking while assistant is speaking, interrupt assistant!
        if (this.isSpeaking) {
          this.stopSpeaking();
        }

        // Wake word check
        if (trimmed.toLowerCase().includes(this.currentWakeWord.toLowerCase())) {
          if (this.callbacks) this.callbacks.onWakeWordDetected(this.currentWakeWord);
        }

        if (event.results[event.results.length - 1].isFinal) {
          if (this.callbacks) this.callbacks.onSpeechResult(trimmed);
        }
      };

      this.recognition.onerror = (err: any) => {
        console.warn('[NEXUS Voice Engine] STT Error:', err.error);
      };
    }
  }

  public async startListening() {
    if (this.isListening) return;

    try {
      if (this.recognition) {
        this.recognition.start();
        this.isListening = true;
      }

      // Web Audio API mic spectrum analyzer setup
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(this.micStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        this.startAudioTelemetry();
      }

      if (this.callbacks) this.callbacks.onStateChange(true, this.isSpeaking);
    } catch (e) {
      console.warn('[NEXUS Voice Engine] Mic access declined or unsupported:', e);
    }
  }

  public stopListening() {
    if (!this.isListening) return;
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    this.isListening = false;
    if (this.callbacks) this.callbacks.onStateChange(false, this.isSpeaking);
  }

  private startAudioTelemetry() {
    const dataArray = new Uint8Array(this.analyser ? this.analyser.frequencyBinCount : 0);
    const loop = () => {
      if (!this.isListening && !this.isSpeaking) return;
      if (this.analyser) {
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / (dataArray.length || 1);
        const normalized = Math.min(1.0, avg / 128);
        if (this.callbacks) this.callbacks.onAudioLevel(normalized);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  public speak(text: string, onEnd?: () => void) {
    if (!this.synthesis) {
      if (onEnd) onEnd();
      return;
    }

    this.stopSpeaking(); // Stop previous speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05; // Natural speed
    utterance.pitch = 0.95; // Slightly deeper sci-fi tone

    // Language mapping
    const langMap: Record<SupportedLanguage, string> = {
      AUTO: 'en-US',
      ENGLISH: 'en-US',
      ARABIC: 'ar-SA',
      HINDI: 'hi-IN',
      MALAYALAM: 'ml-IN',
      TAMIL: 'ta-IN',
      URDU: 'ur-PK',
      FRENCH: 'fr-FR',
      SPANISH: 'es-ES',
      GERMAN: 'de-DE',
      CHINESE: 'zh-CN',
      JAPANESE: 'ja-JP',
      KOREAN: 'ko-KR'
    };

    utterance.lang = langMap[this.currentLang] || 'en-US';

    // Pick best voice matching calm/intelligent persona
    const voices = this.synthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes(utterance.lang) && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('David') || v.name.includes('Neural')));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.callbacks) this.callbacks.onStateChange(this.isListening, true);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.callbacks) this.callbacks.onStateChange(this.isListening, false);
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      if (this.callbacks) this.callbacks.onStateChange(this.isListening, false);
      if (onEnd) onEnd();
    };

    this.synthesis.speak(utterance);
  }

  public stopSpeaking() {
    if (this.synthesis && this.isSpeaking) {
      this.synthesis.cancel();
      this.isSpeaking = false;
      if (this.callbacks) this.callbacks.onStateChange(this.isListening, false);
    }
  }

  public setLanguage(lang: SupportedLanguage) {
    this.currentLang = lang;
  }

  public setWakeWord(word: string) {
    this.currentWakeWord = word;
  }
}
