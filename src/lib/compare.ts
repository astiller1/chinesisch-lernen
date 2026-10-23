// Nachsprechen prüfen: vergleicht den Zielsatz mit dem, was die Spracherkennung verstanden hat (rein).
import { pinyin } from 'pinyin-pro';
import { isHanzi, stripTones } from './pinyin';

export type CellResult = 'ok' | 'tone' | 'wrong' | 'missing';

export interface CompareCell {
  hanzi: string;
  pinyin: string;
  result: CellResult;
  /** was stattdessen erkannt wurde (bei tone/wrong) */
  heard?: string;
}

export interface CompareResult {
  cells: CompareCell[];
  /** Anteil richtiger Silben 0–1 */
  score: number;
}

interface Syl {
  hanzi: string;
  py: string;
}

function syllables(text: string): Syl[] {
  const han = [...text].filter(isHanzi).join('');
  if (!han) return [];
  const pys = pinyin(han, { type: 'array', toneType: 'symbol' });
  return [...han].map((h, i) => ({ hanzi: h, py: pys[i] ?? '' }));
}

/**
 * Richtet beide Silbenfolgen nach dem Laut (ohne Ton) aus (Levenshtein) und bewertet jede Zielsilbe:
 * ok = gleicher Laut und Ton (auch wenn ein anderes, gleich klingendes Zeichen erkannt wurde),
 * tone = Laut richtig, Ton anders, wrong = anderer Laut, missing = nicht gehört.
 */
export function compareSpoken(target: string, spoken: string): CompareResult {
  const a = syllables(target);
  const b = syllables(spoken);
  const n = a.length;
  const m = b.length;
  const base = (s: Syl) => stripTones(s.py);
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = base(a[i - 1]) === base(b[j - 1]) ? (a[i - 1].py === b[j - 1].py ? 0 : 0.5) : 1;
      d[i][j] = Math.min(d[i - 1][j - 1] + sub, d[i - 1][j] + 1, d[i][j - 1] + 1);
    }
  }
  const cells: CompareCell[] = [];
  let i = n;
  let j = m;
  while (i > 0) {
    const ta = a[i - 1];
    if (j > 0) {
      const tb = b[j - 1];
      const sub = base(ta) === base(tb) ? (ta.py === tb.py ? 0 : 0.5) : 1;
      if (d[i][j] === d[i - 1][j - 1] + sub) {
        const result: CellResult = sub === 0 ? 'ok' : sub === 0.5 ? 'tone' : 'wrong';
        cells.push({ hanzi: ta.hanzi, pinyin: ta.py, result, heard: result === 'ok' ? undefined : tb.py });
        i--;
        j--;
        continue;
      }
      if (d[i][j] === d[i][j - 1] + 1) {
        j--; // zusätzlich erkannte Silbe: ignorieren
        continue;
      }
    }
    cells.push({ hanzi: ta.hanzi, pinyin: ta.py, result: 'missing' });
    i--;
  }
  cells.reverse();
  const ok = cells.filter((c) => c.result === 'ok').length;
  return { cells, score: n ? ok / n : 0 };
}
