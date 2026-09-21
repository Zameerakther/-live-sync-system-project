import { SupportedLanguage } from '../types';
import francMin from 'franc-min';

const FRANC_MAP: Record<string, SupportedLanguage> = {
  eng: 'ENGLISH',
  fra: 'FRENCH',
  spa: 'SPANISH',
  deu: 'GERMAN',
  und: 'ENGLISH'
};

/**
 * Detect language from Unicode script ranges; fall back to franc for Latin text.
 */
export function detectLanguage(text: string): SupportedLanguage {
  if (!text || !text.trim()) return 'ENGLISH';
  const t = text;

  // Urdu-specific letters before generic Arabic
  if (/[ٹڈڑںےھۓ]/.test(t)) return 'URDU';
  if (/[\u0600-\u06FF]/.test(t)) return 'ARABIC';
  if (/[\u0900-\u097F]/.test(t)) return 'HINDI';
  if (/[\u0D00-\u0D7F]/.test(t)) return 'MALAYALAM';
  if (/[\u0B80-\u0BFF]/.test(t)) return 'TAMIL';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(t)) return 'JAPANESE';
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(t)) return 'KOREAN';
  if (/[\u4E00-\u9FFF]/.test(t)) return 'CHINESE';

  // Short ASCII text: trust common English command words over trigram guessing
  if (/\b(hello|hi|hey|what|the|is|are|you|how|open|create|make|search|calculate|show|time|please|thanks|yes|no|my|it|to|for|on|a|an)\b/i.test(t)) {
    return 'ENGLISH';
  }

  // Latin-script fallback via franc (restricted to supported Latin languages)
  const code = francMin(t, { minLength: 3, whitelist: ['eng', 'fra', 'spa', 'deu'] });
  return FRANC_MAP[code] || 'ENGLISH';
}
