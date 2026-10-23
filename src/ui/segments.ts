// Darstellung von chinesischem Text: Pinyin (nach Ton gefärbt) über jedem Zeichen, Wörter antippbar.
import type { Segment } from '../ai/schema';
import { alignWord, hasHanzi, pinyinPerChar, toneOf } from '../lib/pinyin';
import type { CompareCell } from '../lib/compare';
import { el } from './dom';

export function segmentsText(segments: Segment[]): string {
  return segments.map((s) => s.text).join('');
}

function pinyinSpan(py: string): HTMLElement {
  const span = el('span', { class: 'py' });
  py.split(/\s+/).forEach((syl, i) => {
    if (i) span.append(' ');
    span.append(el('span', { class: `t${toneOf(syl)}` }, syl));
  });
  return span;
}

function cell(hanzi: string, py: string): HTMLElement {
  return el('span', { class: 'cell' }, pinyinSpan(py), el('span', { class: 'hz' }, hanzi));
}

/** Ein Wort; stimmt die Silbenzahl nicht, steht das Pinyin über dem ganzen Wort. */
export function wordElement(seg: Segment): HTMLElement {
  if (!hasHanzi(seg.text)) return el('span', { class: 'punct' }, cell(seg.text, ''));
  // Fehlt das Pinyin der KI, aus dem Wörterbuch ergänzen.
  const py = seg.pinyin.trim() || pinyinPerChar(seg.text).join(' ');
  const aligned = alignWord(seg.text, py);
  const word = el('span', { class: 'word', tabindex: '0' });
  if (aligned) aligned.forEach((c) => word.append(cell(c.hanzi, c.pinyin)));
  else word.append(cell(seg.text, py));
  return word;
}

export function renderSegments(segments: Segment[], onWord?: (seg: Segment) => void): HTMLElement {
  const line = el('div', { class: 'zh' });
  for (const seg of segments) {
    const w = wordElement(seg);
    if (onWord && w.classList.contains('word')) {
      w.addEventListener('click', (e) => {
        e.stopPropagation();
        onWord(seg);
      });
    }
    line.append(w);
  }
  return line;
}

/** Ergebnis des Nachsprechens: jede Silbe grün/gelb/rot. */
export function renderComparison(cells: CompareCell[]): HTMLElement {
  const line = el('div', { class: 'zh compare' });
  for (const c of cells) {
    const e = el('span', { class: `cell r-${c.result}` }, pinyinSpan(c.pinyin), el('span', { class: 'hz' }, c.hanzi));
    if (c.heard) e.title = `gehört: ${c.heard}`;
    line.append(e);
  }
  return line;
}
