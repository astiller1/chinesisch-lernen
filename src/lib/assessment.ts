// Ergebnis der Azure-Ausspracheprüfung auf die Zeichen des Zielsatzes abbilden (rein).
import { pinyin } from 'pinyin-pro';
import type { CompareCell } from './compare';
import { isHanzi } from './pinyin';

export interface AssessedWord {
  word: string;
  /** 0–100 */
  accuracy: number;
  /** None, Mispronunciation, Omission, Insertion … */
  errorType: string;
}

export interface Assessment {
  pronunciation: number;
  accuracy: number;
  fluency: number;
  completeness: number;
  words: AssessedWord[];
  recognized: string;
}

export function scoreResult(word: AssessedWord): CompareCell['result'] {
  if (word.errorType === 'Omission') return 'missing';
  if (word.accuracy >= 80) return 'ok';
  if (word.accuracy >= 60) return 'weak';
  return 'wrong';
}

/** Jedes Zeichen des Zielsatzes bekommt die Bewertung seines Worts; nicht bewertete Zeichen gelten als fehlend. */
export function assessmentCells(reference: string, words: AssessedWord[]): CompareCell[] {
  const chars = [...reference].filter(isHanzi);
  const pys = chars.length ? pinyin(chars.join(''), { type: 'array', toneType: 'symbol' }) : [];
  const cells: CompareCell[] = chars.map((h, i) => ({ hanzi: h, pinyin: pys[i] ?? '', result: 'missing' }));
  let pos = 0;
  for (const w of words) {
    if (w.errorType === 'Insertion') continue;
    const wordChars = [...w.word].filter(isHanzi);
    // Wort im Zielsatz ab der aktuellen Stelle suchen.
    let start = -1;
    for (let i = pos; i + wordChars.length <= chars.length; i++) {
      if (wordChars.every((c, k) => chars[i + k] === c)) {
        start = i;
        break;
      }
    }
    if (start < 0) continue;
    for (let k = 0; k < wordChars.length; k++) {
      const cell = cells[start + k];
      cell.result = scoreResult(w);
      if (cell.result !== 'ok') cell.heard = `${Math.round(w.accuracy)} von 100`;
    }
    pos = start + wordChars.length;
  }
  return cells;
}
