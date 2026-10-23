// Gemeinsame Bausteine: Vorlesen, Wort-Karte, Nachsprechen, Hinweise.
import type { Segment } from '../ai/schema';
import { save, store } from '../lib/store';
import { newItem } from '../lib/review';
import type { CellResult } from '../lib/compare';
import { canListen, shadow, speak, usesAzure } from '../speech';
import { button, el } from './dom';
import { renderComparison, renderSegments } from './segments';

export function say(text: string, slow = false): void {
  speak(text, slow).catch((e: unknown) => toast(e instanceof Error ? e.message : String(e)));
}

let toastTimer = 0;
export function toast(message: string): void {
  const t = document.getElementById('toast')!;
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 4000);
}

export function isSaved(hanzi: string): boolean {
  return store.vocab.some((v) => v.hanzi === hanzi);
}

/** Wort in die Vokabeln aufnehmen (doppelte werden übersprungen). */
export function saveWord(seg: Segment): boolean {
  if (!seg.text.trim() || isSaved(seg.text)) return false;
  store.vocab.push(newItem(seg.text, seg.pinyin, seg.de, Date.now()));
  save();
  return true;
}

/** Karte unten mit Wort, Pinyin, Bedeutung, Anhören und Merken. */
export function showWord(seg: Segment): void {
  say(seg.text);
  const sheet = document.getElementById('sheet')!;
  sheet.replaceChildren();
  const saveBtn = button(isSaved(seg.text) ? '★ Gemerkt' : '☆ Merken', () => {
    saveWord(seg);
    saveBtn.textContent = '★ Gemerkt';
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
        saveBtn,
        button('✕', () => sheet.classList.remove('open'), 'ghost', 'Schließen'),
      ),
    ),
  );
  sheet.classList.add('open');
}

export function closeSheet(): void {
  document.getElementById('sheet')!.classList.remove('open');
}

const LABELS: Record<CellResult, string> = {
  ok: 'gut',
  tone: 'Ton anders',
  weak: 'ungenau',
  wrong: 'falsch',
  missing: 'fehlt',
};

function verdictText(score: number): string {
  if (score >= 90) return 'Ausgezeichnet!';
  if (score >= 75) return 'Gut!';
  if (score >= 60) return 'Schon ordentlich – hör noch einmal genau hin.';
  return 'Noch einmal anhören und langsam nachsprechen.';
}

/** Knopf "Nachsprechen": hört zu und bewertet Silbe für Silbe. */
export function shadowButton(target: () => string, output: HTMLElement): HTMLButtonElement {
  let stopFn: (() => void) | null = null;
  const reset = () => {
    stopFn = null;
    b.classList.remove('rec');
    b.textContent = '🎤 Nachsprechen';
  };
  const b = button(
    '🎤 Nachsprechen',
    () => {
      if (stopFn) {
        stopFn();
        return;
      }
      if (!canListen()) {
        toast('Spracherkennung ist hier nicht verfügbar.');
        return;
      }
      b.classList.add('rec');
      b.textContent = '■ Stopp';
      output.replaceChildren(el('div', { class: 'hint' }, 'Sprich jetzt …'));
      stopFn = shadow(target(), {
        onText: (t) => output.replaceChildren(el('div', { class: 'hint' }, t || 'Sprich jetzt …')),
        onDone: (r) => {
          reset();
          if (!r) {
            output.replaceChildren(el('div', { class: 'hint' }, 'Nichts verstanden. Noch einmal?'));
            return;
          }
          const used = [...new Set(r.cells.map((c) => c.result))];
          const d = r.details;
          output.replaceChildren(
            el(
              'div',
              { class: 'shadow-result' },
              el('div', { class: 'score' }, `${r.score} / 100 · ${verdictText(r.score)}`),
              renderComparison(r.cells),
              d
                ? el('div', { class: 'hint' }, `Genauigkeit ${Math.round(d.accuracy)} · Flüssigkeit ${Math.round(d.fluency)} · Vollständigkeit ${Math.round(d.completeness)}`)
                : el('div', { class: 'hint' }, `Erkannt: ${r.recognized} (grobe Prüfung ohne Server)`),
              el('div', { class: 'legend' }, ...used.map((u) => el('span', { class: `r-${u}` }, LABELS[u]))),
            ),
          );
        },
        onError: (m) => toast(m),
      });
    },
    'small',
  );
  return b;
}

export function speechModeHint(): string {
  return usesAzure() ? '' : 'Notbehelf: Browser-Stimme und -Erkennung (Azure auf dem Server noch nicht eingerichtet).';
}
