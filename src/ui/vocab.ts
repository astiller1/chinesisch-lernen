// Vokabeln: gemerkte Wörter ansehen und als Hörkarten üben (erst hören, dann Bedeutung aufdecken).
import { dueItems, grade, type VocabItem } from '../lib/review';
import { save, store } from '../lib/store';
import { button, el } from './dom';
import { renderSegments } from './segments';
import { say, shadowButton } from './shared';

const seg = (v: VocabItem) => ({ text: v.hanzi, pinyin: v.pinyin, de: v.de });

export function renderVocab(): void {
  const view = document.getElementById('vocab-view')!;
  const now = Date.now();
  const due = dueItems(store.vocab, now);
  view.replaceChildren(
    el(
      'div',
      { class: 'vocab-head' },
      el('h2', {}, `Vokabeln (${store.vocab.length})`),
      due.length ? button(`Üben (${due.length} fällig)`, () => practice(due), 'primary') : el('span', { class: 'hint' }, 'Nichts fällig 🎉'),
    ),
  );
  if (!store.vocab.length) {
    view.append(el('p', { class: 'hint' }, 'Tippe im Gespräch auf ein Wort und dann auf „☆ Merken“.'));
    return;
  }
  const list = el('div', { class: 'vocab-list' });
  for (const v of [...store.vocab].sort((a, b) => b.added - a.added)) {
    list.append(
      el(
        'div',
        { class: 'vocab-item' },
        renderSegments([seg(v)]),
        el('div', { class: 'meaning' }, v.de),
        el('span', { class: 'box', title: 'Lernfach' }, '●'.repeat(v.box) + '○'.repeat(5 - v.box)),
        button('▶', () => say(v.hanzi), 'small', 'Anhören'),
        button(
          '🗑',
          () => {
            store.vocab = store.vocab.filter((x) => x !== v);
            save();
            renderVocab();
          },
          'small ghost',
          'Löschen',
        ),
      ),
    );
  }
  view.append(list);
}

/** Hörkarte: Wort wird vorgelesen, du überlegst die Bedeutung, dann aufdecken und bewerten. */
function practice(queue: VocabItem[]): void {
  const view = document.getElementById('vocab-view')!;
  const item = queue[0];
  if (!item) {
    renderVocab();
    return;
  }
  const answer = el('div', { class: 'card-answer hidden' }, renderSegments([seg(item)]), el('div', { class: 'meaning' }, item.de));
  const out = el('div');
  const rate = (known: boolean) => {
    const updated = grade(item, known, Date.now());
    store.vocab = store.vocab.map((v) => (v === item ? updated : v));
    save();
    practice(queue.slice(1));
  };
  const gradeRow = el('div', { class: 'row hidden' }, button('✗ Nochmal', () => rate(false), 'bad'), button('✓ Gewusst', () => rate(true), 'good'));
  view.replaceChildren(
    el(
      'div',
      { class: 'flashcard' },
      el('div', { class: 'hint' }, `Noch ${queue.length} · Hör zu: Was bedeutet das?`),
      el('div', { class: 'row' }, button('▶ Anhören', () => say(item.hanzi)), button('🐢', () => say(item.hanzi, true), '', 'Langsam')),
      answer,
      button(
        'Aufdecken',
        () => {
          answer.classList.remove('hidden');
          gradeRow.classList.remove('hidden');
        },
        'primary',
      ),
      gradeRow,
      el('div', { class: 'row' }, shadowButton(() => item.hanzi, out)),
      out,
      button('Beenden', renderVocab, 'ghost'),
    ),
  );
  say(item.hanzi);
}
