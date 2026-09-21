import { SupportedLanguage } from '../types';
import { api } from './api';

export const LANG_LOCALE: Record<SupportedLanguage, string> = {
  AUTO: 'en-US', ENGLISH: 'en-US', ARABIC: 'ar-SA', HINDI: 'hi-IN',
  MALAYALAM: 'ml-IN', TAMIL: 'ta-IN', URDU: 'ur-PK', FRENCH: 'fr-FR',
  SPANISH: 'es-ES', GERMAN: 'de-DE', CHINESE: 'zh-CN', JAPANESE: 'ja-JP', KOREAN: 'ko-KR'
};

export interface VoiceEngineCallbacks {
  onSpeechResult: (text: string) => void;
  onWakeWordDetected: (word: string) => void;
  onMicActiveChange: (active: boolean) => void;
  onSpeakingChange: (speaking: boolean) => void;
}

export class VoiceEngine {
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private waveform: Uint8Array = new Uint8Array(0);

  private wakeWordMode = false;      // continuous listening gated by wake word
  private pttActive = false;          // push-to-talk window
  private micActive = false;
  private speaking = false;
  private wakeWord = 'Nexus';
  private lang: SupportedLanguage = 'AUTO';
  private speakLevel = 0;
  private speakLevelTimer: any = null;

  private callbacks: VoiceEngineCallbacks;

  constructor(callbacks: VoiceEngineCallbacks) {
    this.callbacks = callbacks;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    }
  }

  private ensureRecognition() {
    if (this.recognition || typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = LANG_LOCALE[this.lang === 'AUTO' ? 'ENGLISH' : this.lang];

    this.recognition.onresult = (event: any) => {
      let transcript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      transcript = transcript.trim();
      if (!transcript) return;

      // Barge-in: interrupt TTS when user speaks
      if (this.speaking) this.stopSpeaking();

      if (this.wakeWordMode && !this.pttActive) {
        const idx = transcript.toLowerCase().indexOf(this.wakeWord.toLowerCase());
        if (idx === -1) return;
        this.callbacks.onWakeWordDetected(this.wakeWord);
        // Strip wake word; only forward trailing command
        const command = transcript.slice(idx + this.wakeWord.length).replace(/^[\s,.]+/, '').trim();
        if (command && isFinal) this.dispatch(command);
        return;
      }
      if (isFinal) this.dispatch(transcript);
    };

    this.recognition.onerror = () => { /* not-allowed / no-speech */ };
    this.recognition.onend = () => {
      // Auto-restart in wake-word mode (continuous low-power listener)
      if (this.wakeWordMode && this.micActive) {
        try { this.recognition.start(); } catch { /* already started */ }
      }
    };
  }

  private async dispatch(text: string) {
    // AUTO mode: detect language from transcript to set TTS locale
    if (this.lang === 'AUTO' && text.length > 3) {
      try {
        const { language } = await api.detectLanguage(text);
        if (language && language !== 'AUTO') this.detectedLang = language;
      } catch { /* keep AUTO */ }
    }
    this.callbacks.onSpeechResult(text);
  }

  private detectedLang: SupportedLanguage = 'ENGLISH';

  /** Push-to-talk: temporarily forward all transcripts regardless of wake word. */
  public async startPTT() {
    this.pttActive = true;
    await this.startListening();
  }

  public stopPTT() {
    this.pttActive = false;
    if (!this.wakeWordMode) this.stopListening();
  }

  /** Enable continuous wake-word listening. */
  public async setWakeWordMode(on: boolean) {
    this.wakeWordMode = on;
    if (on) await this.startListening();
    else if (!this.pttActive) this.stopListening();
  }

  public async startListening() {
    this.ensureRecognition();
    if (!this.recognition) return;
    if (!this.micActive) {
      try {
        this.recognition.start();
      } catch { /* already running */ }
      this.micActive = true;
      this.callbacks.onMicActiveChange(true);
    }
    // Mic analyser (time-domain waveform for the core)
    if (!this.analyser && navigator.mediaDevices?.getUserMedia) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(this.micStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.waveform = new Uint8Array(this.analyser.fftSize);
        source.connect(this.analyser);
      } catch { /* mic unavailable */ }
    }
  }

  public stopListening() {
    this.micActive = false;
    this.callbacks.onMicActiveChange(false);
    try { this.recognition?.stop(); } catch { /* ignore */ }
    this.micStream?.getTracks().forEach(t => t.stop());
    this.micStream = null;
    this.analyser = null;
    this.audioContext?.close().catch(() => {});
    this.audioContext = null;
  }

  /** Live waveform bytes for the core renderer (128–255 amplitude around 128 center). */
  public getWaveform(): Uint8Array {
    if (this.speaking) {
      // Synthesized envelope while speaking (Web Speech has no output analyser)
      const arr = new Uint8Array(128);
      const t = performance.now() / 1000;
      for (let i = 0; i < arr.length; i++) {
        arr[i] = 128 + Math.round(Math.sin(t * 6 + i * 0.35) * 60 * this.speakLevel);
      }
      return arr;
    }
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(this.waveform as Uint8Array<ArrayBuffer>);
      return this.waveform;
    }
    return this.waveform;
  }

  public isSpeaking() { return this.speaking; }
  public isMicActive() { return this.micActive; }

  public speak(text: string, onEnd?: () => void) {
    if (!this.synthesis) { onEnd?.(); return; }
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    const lang = this.lang === 'AUTO' ? this.detectedLang : this.lang;
    utterance.lang = LANG_LOCALE[lang] || 'en-US';
    const voices = this.synthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(utterance.lang.split('-')[0]) && /natural|google|neural|premium/i.test(v.name))
      || voices.find(v => v.lang.startsWith(utterance.lang.split('-')[0]));
    if (voice) utterance.voice = voice;

    // Approximate envelope for waveform visuals
    const startEnvelope = () => {
      clearInterval(this.speakLevelTimer);
      this.speakLevelTimer = setInterval(() => {
        this.speakLevel = 0.4 + Math.random() * 0.6;
      }, 90);
    };
    utterance.onstart = () => {
      this.speaking = true;
      startEnvelope();
      this.callbacks.onSpeakingChange(true);
    };
    utterance.onboundary = () => { this.speakLevel = 0.5 + Math.random() * 0.5; };
    const finish = () => {
      this.speaking = false;
      this.speakLevel = 0;
      clearInterval(this.speakLevelTimer);
      this.callbacks.onSpeakingChange(false);
      onEnd?.();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    this.synthesis.speak(utterance);
  }

  public stopSpeaking() {
    if (this.synthesis && this.speaking) {
      this.synthesis.cancel();
      this.speaking = false;
      this.speakLevel = 0;
      clearInterval(this.speakLevelTimer);
      this.callbacks.onSpeakingChange(false);
    }
  }

  public setLanguage(lang: SupportedLanguage) {
    this.lang = lang;
    if (this.recognition) this.recognition.lang = LANG_LOCALE[lang === 'AUTO' ? 'ENGLISH' : lang];
  }

  public setWakeWord(word: string) { this.wakeWord = word || 'Nexus'; }
}
