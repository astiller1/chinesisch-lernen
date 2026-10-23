// Eine Schnittstelle für Sprache: Azure über den Server, sonst (nur lokal) die Browser-Sprache als Notbehelf.
import { server } from '../lib/server';
import { store } from '../lib/store';
import { assessmentCells, type Assessment } from '../lib/assessment';
import { compareSpoken, type CompareCell } from '../lib/compare';
import { assessAzure, listenAzure, speakAzure, stopAudio } from './azure';
import { canRecognize, listen as listenBrowser, type ListenHandlers } from './stt';
import { speak as speakBrowser, stopSpeaking } from './tts';

export type { ListenHandlers };

export const usesAzure = () => server.speech;

export function canListen(): boolean {
  return usesAzure() || canRecognize();
}

/** Liest chinesischen Text vor (slow = deutlich langsamer). */
export async function speak(text: string, slow = false): Promise<void> {
  const s = store.settings;
  const rate = slow ? Math.max(0.45, s.rate * 0.65) : s.rate;
  stop();
  if (usesAzure()) {
    await speakAzure(text, s.voice, rate);
    return;
  }
  await new Promise<void>((resolve) => speakBrowser(text, rate, '', resolve));
}

export function stop(): void {
  stopAudio();
  stopSpeaking();
}

export function listen(h: ListenHandlers): () => void {
  stop();
  return usesAzure() ? listenAzure(h) : listenBrowser(h);
}

export interface ShadowResult {
  cells: CompareCell[];
  /** 0–100 */
  score: number;
  recognized: string;
  /** nur mit Azure */
  details?: Assessment;
}

/** Nachsprechen eines Zielsatzes und bewerten. */
export function shadow(
  reference: string,
  h: { onText(t: string): void; onDone(r: ShadowResult | null): void; onError(m: string): void },
): () => void {
  stop();
  if (usesAzure()) {
    return assessAzure(
      reference,
      (a) => {
        if (!a) return h.onDone(null);
        h.onDone({ cells: assessmentCells(reference, a.words), score: Math.round(a.pronunciation), recognized: a.recognized, details: a });
      },
      h.onError,
    );
  }
  return listenBrowser({
    onText: h.onText,
    onError: h.onError,
    onDone: (t) => {
      if (!t) return h.onDone(null);
      const r = compareSpoken(reference, t);
      h.onDone({ cells: r.cells, score: Math.round(r.score * 100), recognized: t });
    },
  });
}
