// Speichert Einstellungen, Gespräch und Vokabeln im localStorage dieses Browsers.
import type { LevelId, ModelId, ScenarioId } from '../data/scenarios';
import type { Turn } from '../ai/tutor';
import type { TutorReply } from '../ai/schema';
import type { VocabItem } from './review';

export interface Settings {
  apiKey: string;
  model: ModelId;
  level: LevelId;
  scenario: ScenarioId;
  /** Sprechtempo der Vorlesestimme (0.5–1.2) */
  rate: number;
  voice: string;
  autoPlay: boolean;
  autoSend: boolean;
  showPinyin: boolean;
  showHanzi: boolean;
  /** Hörmodus: Antworten der KI erst nach Antippen als Text zeigen */
  listenMode: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'claude-opus-5-5',
  level: 'a1',
  scenario: 'frei',
  rate: 0.8,
  voice: '',
  autoPlay: true,
  autoSend: false,
  showPinyin: true,
  showHanzi: true,
  listenMode: false,
};

/** Ein Eintrag im angezeigten Gespräch. */
export type ChatEntry =
  | { kind: 'learner'; text: string; spoken: boolean }
  | { kind: 'tutor'; reply: TutorReply };

export interface Conversation {
  turns: Turn[];
  entries: ChatEntry[];
}

const KEY = 'chinesisch-lernen';

interface Saved {
  version: 1;
  settings: Settings;
  conversation: Conversation;
  vocab: VocabItem[];
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Saved;
      return { ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings } };
    }
  } catch {
    // kaputter oder gesperrter Speicher: frisch beginnen
  }
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, conversation: { turns: [], entries: [] }, vocab: [] };
}

export const store = load();

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // privates Fenster o. Ä.: läuft ohne Speichern weiter
  }
}
