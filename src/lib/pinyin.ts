// Reine Pinyin-Hilfen (ohne DOM): Töne erkennen, Ziffern-Pinyin umwandeln, Silben Zeichen zuordnen.
import { pinyin } from 'pinyin-pro';

export type Tone = 1 | 2 | 3 | 4 | 5;

const MARKS: Record<string, [string, Tone]> = {};
for (const [base, marked] of [
  ['a', 'āáǎà'],
  ['e', 'ēéěè'],
  ['i', 'īíǐì'],
  ['o', 'ōóǒò'],
  ['u', 'ūúǔù'],
  ['ü', 'ǖǘǚǜ'],
] as const) {
  [...marked].forEach((ch, i) => {
    MARKS[ch] = [base, (i + 1) as Tone];
    MARKS[ch.toUpperCase()] = [base.toUpperCase(), (i + 1) as Tone];
  });
}

/** Ton einer Silbe mit Tonzeichen ("hǎo" → 3, "ma" → 5). */
export function toneOf(syllable: string): Tone {
  for (const ch of syllable) {
    const m = MARKS[ch];
    if (m) return m[1];
  }
  return 5;
}

/** Entfernt Tonzeichen ("nǚ" → "nü"). */
export function stripTones(text: string): string {
  return [...text].map((ch) => MARKS[ch]?.[0] ?? ch).join('');
}

const TONED: Record<string, string> = {
  a: 'āáǎà',
  e: 'ēéěè',
  i: 'īíǐì',
  o: 'ōóǒò',
  u: 'ūúǔù',
  ü: 'ǖǘǚǜ',
};

function markSyllable(body: string, tone: number): string {
  const s = body.replace(/u:|v/g, 'ü').replace(/U:|V/g, 'Ü');
  if (tone < 1 || tone > 4) return s;
  const lower = s.toLowerCase();
  // Regel: a oder e bekommt das Zeichen, bei "ou" das o, sonst der letzte Vokal.
  let idx = lower.search(/[ae]/);
  if (idx < 0) idx = lower.indexOf('ou');
  if (idx < 0) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('iouü'.includes(lower[i])) {
        idx = i;
        break;
      }
    }
  }
  if (idx < 0) return s;
  const ch = s[idx];
  const marked = TONED[ch.toLowerCase()][tone - 1];
  return s.slice(0, idx) + (ch === ch.toUpperCase() ? marked.toUpperCase() : marked) + s.slice(idx + 1);
}

/** Ziffern-Pinyin in Tonzeichen umwandeln ("ni3 hao3" → "nǐ hǎo", "lv4" → "lǜ"). */
export function numberedToMarks(text: string): string {
  return text.replace(/([a-zA-ZüÜ:]+)([1-5])/g, (_, body: string, t: string) => markSyllable(body, Number(t)));
}

/** Pinyin mit Tonzeichen für chinesischen Text, je Zeichen ein Eintrag (Satzzeichen → ""). */
export function pinyinPerChar(text: string): string[] {
  return [...text].map((ch) => (isHanzi(ch) ? pinyin(ch, { toneType: 'symbol' }) : ''));
}

/** Pinyin für einen ganzen Satz (pinyin-pro erkennt Mehrfachlesungen am Kontext). */
export function sentencePinyin(text: string): string {
  return pinyin(text, { toneType: 'symbol', nonZh: 'consecutive' }).replace(/\s+/g, ' ').trim();
}

export function isHanzi(ch: string): boolean {
  return /\p{Script=Han}/u.test(ch);
}

export function hasHanzi(text: string): boolean {
  return /\p{Script=Han}/u.test(text);
}

export interface CharCell {
  hanzi: string;
  pinyin: string;
}

/**
 * Ordnet die Pinyin-Silben eines Worts seinen Zeichen zu.
 * Liefert null, wenn die Silbenzahl nicht zu den Zeichen passt (z. B. Erhua "点儿" → "diǎnr");
 * dann wird das Pinyin über dem ganzen Wort angezeigt.
 */
export function alignWord(hanzi: string, pinyinText: string): CharCell[] | null {
  const chars = [...hanzi];
  const syllables = pinyinText.trim().split(/[\s'’]+/).filter(Boolean);
  if (chars.length !== syllables.length) return null;
  return chars.map((h, i) => ({ hanzi: h, pinyin: syllables[i] }));
}
