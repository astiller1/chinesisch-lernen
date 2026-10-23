// Was die Lehrerin über den Lernenden weiß: Niveau, typische Fehler, persönliche Notizen, letzte Stunden.
// Rein, ohne DOM – wird von store.ts gespeichert und von prompt.ts in die Anweisung eingebaut.

export interface ErrorNote {
  /** Fehlerart auf Deutsch, z. B. "Zählwort 碗" oder "3. Ton bei 想" */
  topic: string;
  example: string;
  correction: string;
  count: number;
  lastSeen: number;
}

export interface LessonNote {
  date: number;
  summary: string;
}

export interface Learner {
  /** Geschätztes Niveau auf der HSK-Skala 1.0–6.0 */
  level: number;
  errors: ErrorNote[];
  /** Persönliches, das sich eine Lehrerin merkt (Name, Beruf, Hobbys, Pläne …), auf Deutsch */
  facts: string[];
  lessons: LessonNote[];
}

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 6;
const MAX_FACTS = 20;
const MAX_ERRORS = 30;
const MAX_LESSONS = 10;

export function newLearner(level: number): Learner {
  return { level: clampLevel(level), errors: [], facts: [], lessons: [] };
}

export function clampLevel(level: number): number {
  return Math.round(Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level)) * 100) / 100;
}

export type Verdict = 'keine' | 'gut' | 'kleiner_fehler' | 'fehler' | 'deutsch';
export type Understood = 'ja' | 'teilweise' | 'nein';

/**
 * Niveau nach einem Gesprächszug anpassen: kleine Schritte nach oben, wenn es gut läuft,
 * deutlichere nach unten, wenn der Lernende nicht mitkommt (lieber unter- als überfordern).
 */
export function adjustLevel(level: number, verdict: Verdict, understood: Understood): number {
  let delta = 0;
  if (understood === 'nein') delta -= 0.15;
  else if (understood === 'teilweise') delta -= 0.05;
  if (verdict === 'gut') delta += understood === 'ja' ? 0.06 : 0.02;
  else if (verdict === 'kleiner_fehler') delta += 0.02;
  else if (verdict === 'fehler') delta -= 0.03;
  else if (verdict === 'deutsch') delta -= 0.05;
  return clampLevel(level + delta);
}

/** Beschreibung des Niveaus für die KI. */
export function levelGuide(level: number): string {
  const hsk = level.toFixed(1);
  if (level < 2) return `etwa HSK ${hsk}: sehr kurze Sätze (3–8 Zeichen), nur Grundwortschatz, Fragen mit 吗 oder Auswahl, keine Nebensätze`;
  if (level < 3) return `etwa HSK ${hsk}: kurze Sätze (bis 12 Zeichen), Wortschatz HSK 1–2 plus gelegentlich ein neues Wort, einfache Satzmuster (了, 在, 想, 会)`;
  if (level < 4) return `etwa HSK ${hsk}: einfache Alltagssätze bis 18 Zeichen, Wortschatz bis HSK 3, Vergleiche, 把 und 过, einfache Konjunktionen`;
  if (level < 5) return `etwa HSK ${hsk}: natürliche Alltagssprache, Wortschatz bis HSK 4, Nebensätze, häufige Redewendungen`;
  return `etwa HSK ${hsk}: natürliches, flüssiges Chinesisch wie unter Muttersprachlern, auch Chengyu und Umgangssprache`;
}

export interface ErrorInput {
  topic: string;
  example: string;
  correction: string;
}

/** Fehler zählen; gleiche Fehlerart (ohne Groß/Klein und Leerzeichen) wird zusammengefasst. */
export function recordErrors(errors: ErrorNote[], found: ErrorInput[], now: number): ErrorNote[] {
  const key = (t: string) => t.toLowerCase().replace(/\s+/g, '');
  const result = errors.map((e) => ({ ...e }));
  for (const f of found) {
    if (!f.topic.trim()) continue;
    const existing = result.find((e) => key(e.topic) === key(f.topic));
    if (existing) {
      existing.count++;
      existing.lastSeen = now;
      existing.example = f.example;
      existing.correction = f.correction;
    } else {
      result.push({ ...f, count: 1, lastSeen: now });
    }
  }
  // Behalten: häufige und kürzlich gesehene Fehler.
  return result.sort((a, b) => errorWeight(b, now) - errorWeight(a, now)).slice(0, MAX_ERRORS);
}

function errorWeight(e: ErrorNote, now: number): number {
  const days = (now - e.lastSeen) / 86_400_000;
  return e.count / (1 + days / 7);
}

/** Die Fehler, an denen die Lehrerin gerade arbeiten sollte. */
export function focusErrors(errors: ErrorNote[], now: number, n = 3): ErrorNote[] {
  return [...errors].sort((a, b) => errorWeight(b, now) - errorWeight(a, now)).slice(0, n);
}

export function addFacts(facts: string[], found: string[]): string[] {
  const result = [...facts];
  for (const f of found.map((x) => x.trim()).filter(Boolean)) {
    if (!result.some((x) => x.toLowerCase() === f.toLowerCase())) result.push(f);
  }
  return result.slice(-MAX_FACTS);
}

export function addLesson(lessons: LessonNote[], summary: string, now: number): LessonNote[] {
  return [...lessons, { date: now, summary }].slice(-MAX_LESSONS);
}
