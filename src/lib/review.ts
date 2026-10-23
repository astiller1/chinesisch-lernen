// Leitner-Lernkartei für gemerkte Wörter (rein, ohne DOM).

export interface VocabItem {
  hanzi: string;
  pinyin: string;
  de: string;
  /** Leitner-Fach 0–5 */
  box: number;
  /** fällig ab (ms seit 1970) */
  due: number;
  added: number;
}

/** Tage bis zur nächsten Abfrage je Fach. */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30] as const;
const DAY = 86_400_000;

export function newItem(hanzi: string, pinyin: string, de: string, now: number): VocabItem {
  return { hanzi, pinyin, de, box: 0, due: now, added: now };
}

/** Ergebnis einer Abfrage: gewusst → ein Fach weiter, nicht gewusst → zurück auf Fach 0. */
export function grade(item: VocabItem, known: boolean, now: number): VocabItem {
  const box = known ? Math.min(item.box + 1, BOX_DAYS.length - 1) : 0;
  // Nicht gewusst: in 10 Minuten noch einmal.
  const due = known ? now + BOX_DAYS[box] * DAY : now + 10 * 60_000;
  return { ...item, box, due };
}

export function dueItems(items: VocabItem[], now: number): VocabItem[] {
  return items.filter((i) => i.due <= now).sort((a, b) => a.due - b.due);
}
