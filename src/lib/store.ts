// Speichert Einstellungen, Gespräch, Lernerprofil und Vokabeln im localStorage dieses Browsers.
import { type LevelId, type ModelId, type ScenarioId } from '../data/scenarios';
import type { Turn } from '../ai/tutor';
import type { LessonSummary, TutorReply } from '../ai/schema';
import type { VocabItem } from './review';
import { newLearner, type Learner } from './learner';

export interface Settings {
  /** nur ohne Server nötig (lokale Entwicklung) */
  apiKey: string;
  model: ModelId;
  /** Startniveau für ein neues Profil */
  level: LevelId;
  scenario: ScenarioId;
  /** Sprechtempo der Lehrerin (0.5–1.2) */
  rate: number;
  voice: string;
  autoPlay: boolean;
  autoSend: boolean;
  showPinyin: boolean;
  showHanzi: boolean;
  /** Hörmodus: Antworten erst nach Antippen als Text zeigen */
  listenMode: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'claude-opus-5-5',
  level: 'a1',
  scenario: 'frei',
  rate: 0.85,
  voice: 'zh-CN-XiaoxiaoNeural',
  autoPlay: true,
  autoSend: true,
  showPinyin: true,
  showHanzi: true,
  listenMode: false,
};

/** Ein Eintrag im angezeigten Gespräch. */
export type ChatEntry =
  | { kind: 'learner'; text: string; spoken: boolean }
  | { kind: 'tutor'; reply: TutorReply }
  | { kind: 'help'; text: string }
  | { kind: 'summary'; summary: LessonSummary };

export interface Conversation {
  /** Systemanweisung, zu Stundenbeginn festgelegt (bleibt gleich, damit der Cache greift) */
  system: string;
  turns: Turn[];
  entries: ChatEntry[];
  /** Niveau, das der Lehrerin zuletzt mitgeteilt wurde */
  announcedLevel: number;
  ended: boolean;
}

export function emptyConversation(): Conversation {
  return { system: '', turns: [], entries: [], announcedLevel: 0, ended: false };
}

export function startLevel(id: LevelId): number {
  return { a1: 1.5, a2: 3, b1: 4, b2: 5 }[id] ?? 1.5;
}

const KEY = 'chinesisch-lernen';

interface Saved {
  version: 2;
  settings: Settings;
  conversation: Conversation;
  learner: Learner;
  vocab: VocabItem[];
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Saved> & { version: number };
      const settings = { ...DEFAULT_SETTINGS, ...s.settings };
      return {
        version: 2,
        settings,
        // Gespräche aus Version 1 haben keine feste Systemanweisung: neu beginnen.
        conversation: s.version === 2 && s.conversation ? s.conversation : emptyConversation(),
        learner: s.learner ?? newLearner(startLevel(settings.level)),
        vocab: s.vocab ?? [],
      };
    }
  } catch {
    // kaputter oder gesperrter Speicher: frisch beginnen
  }
  return {
    version: 2,
    settings: { ...DEFAULT_SETTINGS },
    conversation: emptyConversation(),
    learner: newLearner(startLevel(DEFAULT_SETTINGS.level)),
    vocab: [],
  };
}

export const store = load();

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // privates Fenster o. Ä.: läuft ohne Speichern weiter
  }
}
