// Gemeinsame Bausteine: Vorlesen, Wort-Karte, Nachsprechen, Hinweise.
import type { Segment } from '../ai/schema';
import { save, store } from '../lib/store';
import { newItem } from '../lib/review';
import { compareSpoken } from '../lib/compare';
import { speak } from '../speech/tts';
import { canRecognize, listen } from '../speech/stt';
import { button, el } from './dom';
import { renderComparison, renderSegments } from './segments';

export function say(text: string, slow = false): void {
  const s = store.settings;
  speak(text, slow ? Math.max(0.4, s.rate * 0.65) : s.rate, s.voice);
}

let toastTimer = 0;
export function toast(message: string): void {
  const t = document.getElementById('toast')!;
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 3500);
}

export function isSaved(hanzi: string): boolean {
  return store.vocab.some((v) => v.hanzi === hanzi);
}

export function saveWord(seg: Segment): void {
  if (isSaved(seg.text)) return;
  store.vocab.push(newItem(seg.text, seg.pinyin, seg.de, Date.now()));
  save();
}

/** Karte unten mit Wort, Pinyin, Bedeutung, Anhören und Merken. */
export function showWord(seg: Segment): void {
  say(seg.text);
  const sheet = document.getElementById('sheet')!;
  sheet.replaceChildren();
  const save = button(isSaved(seg.text) ? '★ Gemerkt' : '☆ Merken', () => {
    saveWord(seg);
    save.textContent = '★ Gemerkt';
  });
  sheet.append(
    el(
      'div',
      { class: 'sheet-card' },
      el('div', { class: 'big' }, renderSegments([seg])),
      el('div', { class: 'meaning' }, seg.de),
      el(
        'div',
        { class: 'row' },
        button('▶ Anhören', () => say(seg.text)),
        button('🐢 Langsam', () => say(seg.text, true)),
        save,
        button('✕', () => sheet.classList.remove('open'), 'ghost', 'Schließen'),
      ),
    ),
  );
  sheet.classList.add('open');
}

export function closeSheet(): void {
  document.getElementById('sheet')!.classList.remove('open');
}

/** Knopf "Nachsprechen": hört zu und zeigt je Silbe, ob sie richtig verstanden wurde. */
export function shadowButton(target: () => string, output: HTMLElement): HTMLButtonElement {
  let stop: (() => void) | null = null;
  const b = button('🎤 Nachsprechen', () => {
    if (stop) {
      stop();
      return;
    }
    if (!canRecognize()) {
      toast('Spracherkennung geht nur in Chrome, Edge oder Safari.');
      return;
    }
    b.classList.add('rec');
    b.textContent = '■ Stopp';
    output.replaceChildren(el('div', { class: 'hint' }, 'Sprich jetzt …'));
    stop = listen({
      onText: (t) => output.replaceChildren(el('div', { class: 'hint' }, t || 'Sprich jetzt …')),
      onDone: (t) => {
        stop = null;
        b.classList.remove('rec');
        b.textContent = '🎤 Nachsprechen';
        if (!t) {
          output.replaceChildren();
          return;
        }
        const r = compareSpoken(target(), t);
        const pct = Math.round(r.score * 100);
        const label = pct === 100 ? 'Perfekt verstanden!' : pct >= 70 ? `Gut – ${pct} % verstanden` : `${pct} % verstanden – hör noch einmal hin`;
        output.replaceChildren(
          el('div', { class: 'shadow-result' }, el('div', { class: 'hint' }, `${label} (erkannt: ${t})`), renderComparison(r.cells), legend()),
        );
      },
      onError: (m) => toast(m),
    });
  }, 'small');
  return b;
}

function legend(): HTMLElement {
  return el(
    'div',
    { class: 'legend' },
    el('span', { class: 'r-ok' }, 'richtig'),
    el('span', { class: 'r-tone' }, 'Ton anders'),
    el('span', { class: 'r-wrong' }, 'anderer Laut'),
    el('span', { class: 'r-missing' }, 'nicht gehört'),
  );
}
