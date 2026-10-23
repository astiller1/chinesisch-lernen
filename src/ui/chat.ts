// Gesprächsansicht: die Stunde mit 林老师 – Verlauf, Feedback, Mikrofon und Eingabe.
import { ask, TutorError, type Connection } from '../ai/tutor';
import {
  END_LESSON_MESSAGE,
  learnerMessage,
  LEVEL_NOTICE_STEP,
  levelNotice,
  NOT_UNDERSTOOD_MESSAGE,
  START_MESSAGE,
  systemPrompt,
  TEACHER,
} from '../ai/prompt';
import { LessonSummary, TutorReply } from '../ai/schema';
import { emptyConversation, save, store, type ChatEntry } from '../lib/store';
import { addFacts, addLesson, adjustLevel, recordErrors } from '../lib/learner';
import { dueItems } from '../lib/review';
import { hasHanzi, numberedToMarks, sentencePinyin } from '../lib/pinyin';
import { server } from '../lib/server';
import { canListen, listen, stop } from '../speech';
import { button, el } from './dom';
import { renderSegments, segmentsText } from './segments';
import { say, saveWord, shadowButton, showWord, toast } from './shared';

const VERDICT: Record<TutorReply['feedback']['verdict'], [string, string]> = {
  keine: ['', ''],
  gut: ['✓ Gut gesagt!', 'good'],
  kleiner_fehler: ['Fast richtig – natürlicher so:', 'minor'],
  fehler: ['Besser so:', 'error'],
  deutsch: ['Auf Chinesisch:', 'german'],
};

let busy = false;
let stopListening: (() => void) | null = null;
let lastSpoken = false;

const log = () => document.getElementById('log')!;
const input = () => document.getElementById('input') as HTMLTextAreaElement;

function connection(): Connection {
  const s = store.settings;
  return { viaServer: server.ai, ollamaUrl: s.ollamaUrl, ollamaModel: s.ollamaModel };
}

export function initChat(): void {
  const box = input();
  document.getElementById('mic')!.addEventListener('click', toggleMic);
  document.getElementById('send')!.addEventListener('click', () => void submit());
  document.getElementById('not-understood')!.addEventListener('click', () => void notUnderstoodTurn());
  document.getElementById('end-lesson')!.addEventListener('click', () => void endLesson());
  box.addEventListener('input', () => {
    lastSpoken = false;
    // Ziffern-Pinyin beim Tippen in Tonzeichen umwandeln ("ni3" → "nǐ").
    const converted = numberedToMarks(box.value);
    if (converted !== box.value) box.value = converted;
    updatePreview();
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  });
  document.getElementById('new-chat')!.addEventListener('click', () => {
    if (lessonRunning() && !confirm('Neue Stunde beginnen? Die jetzige wird ohne Auswertung beendet.')) return;
    void startLesson();
  });
  renderLog();
}

const lessonRunning = () => store.conversation.turns.length > 0 && !store.conversation.ended;

function updatePreview(): void {
  const text = input().value.trim();
  document.getElementById('preview')!.textContent = hasHanzi(text) ? sentencePinyin(text) : '';
}

function toggleMic(): void {
  const mic = document.getElementById('mic')!;
  if (stopListening) {
    stopListening();
    return;
  }
  if (!canListen()) {
    toast('Spracherkennung ist hier nicht verfügbar – bitte tippen.');
    return;
  }
  mic.classList.add('rec');
  const before = input().value;
  stopListening = listen({
    onText: (t) => {
      input().value = (before ? before + ' ' : '') + t;
      updatePreview();
    },
    onDone: (t) => {
      stopListening = null;
      mic.classList.remove('rec');
      if (!t) return;
      lastSpoken = true;
      if (store.settings.autoSend) void submit();
    },
    onError: (m) => toast(m),
  });
}

/** Neue Stunde: Anweisung mit dem aktuellen Gedächtnis festlegen und die Lehrerin begrüßen lassen. */
export async function startLesson(): Promise<void> {
  if (busy) return;
  const now = Date.now();
  const recycle = dueItems(store.vocab, now).slice(0, 8);
  store.conversation = {
    ...emptyConversation(),
    system: systemPrompt({ scenario: store.settings.scenario, learner: store.learner, recycle, now }),
    announcedLevel: store.learner.level,
  };
  save();
  renderLog();
  log().querySelector('.empty')?.remove();
  await turn(START_MESSAGE);
}

async function submit(): Promise<void> {
  const text = input().value.trim();
  if (!text || busy) return;
  if (!lessonRunning()) {
    toast('Starte zuerst eine Stunde.');
    return;
  }
  const spoken = lastSpoken;
  input().value = '';
  lastSpoken = false;
  updatePreview();
  await turn(learnerMessage(text, spoken), { kind: 'learner', text, spoken });
}

async function notUnderstoodTurn(): Promise<void> {
  if (busy || !lessonRunning()) return;
  // Das Niveau sinkt über die Einschätzung der Lehrerin (understood "nein").
  await turn(NOT_UNDERSTOOD_MESSAGE, { kind: 'help', text: '🤔 Nicht verstanden – bitte einfacher' });
}

/** Ein Gesprächszug: Nachricht senden, Antwort zeigen, Gedächtnis und Niveau aktualisieren. */
async function turn(message: string, shown?: ChatEntry): Promise<void> {
  const conn = connection();
  if (busy) return;
  busy = true;
  const conv = store.conversation;
  const added: HTMLElement[] = [];
  if (shown) {
    conv.entries.push(shown);
    added.push(renderEntry(shown));
  }
  const turnsBefore = conv.turns.length;
  const announcedBefore = conv.announcedLevel;
  conv.turns.push({ role: 'user', content: message });
  // Niveau merklich geändert: der Lehrerin per Systemnachricht mitteilen (Verlauf bleibt unverändert).
  if (Math.abs(store.learner.level - conv.announcedLevel) >= LEVEL_NOTICE_STEP) {
    conv.turns.push({ role: 'system', content: levelNotice(store.learner.level) });
    conv.announcedLevel = store.learner.level;
  }
  const waiting = el('div', { class: 'msg tutor waiting' }, el('span', { class: 'dots' }, `${TEACHER.hanzi} 想一想 …`));
  log().append(...added, waiting);
  scrollDown();
  try {
    const { value: reply, raw } = await ask(conn, conv.system, conv.turns, TutorReply);
    conv.turns.push({ role: 'assistant', content: raw });
    const entry: ChatEntry = { kind: 'tutor', reply };
    conv.entries.push(entry);
    learn(reply);
    save();
    waiting.replaceWith(renderEntry(entry));
    updateLessonButtons();
    scrollDown();
    if (store.settings.autoPlay) say(segmentsText(reply.reply));
  } catch (e) {
    // Fehlgeschlagenen Zug zurücknehmen, damit er erneut gesendet werden kann.
    conv.turns.length = turnsBefore;
    conv.announcedLevel = announcedBefore;
    if (shown) {
      conv.entries.pop();
      if (shown.kind === 'learner') {
        input().value = shown.text;
        updatePreview();
      }
    }
    added.forEach((a) => a.remove());
    waiting.remove();
    save();
    if (!conv.entries.length) renderLog();
    toast(e instanceof TutorError ? e.message : `Fehler: ${String(e)}`);
  } finally {
    busy = false;
  }
}

/** Was die Lehrerin aus diesem Zug lernt. */
function learn(reply: TutorReply): void {
  const now = Date.now();
  const l = store.learner;
  const a = reply.assessment;
  l.level = adjustLevel(l.level, reply.feedback.verdict, a.understood);
  l.errors = recordErrors(l.errors, a.errors, now);
  l.facts = addFacts(l.facts, a.facts);
  // Neue Wörter wandern automatisch in die Vokabeln.
  for (const w of reply.new_words) saveWord(w);
}

async function endLesson(): Promise<void> {
  if (busy || !lessonRunning()) return;
  const conv = store.conversation;
  if (!conv.entries.some((e) => e.kind === 'learner')) {
    toast('Sag erst etwas – dann gibt es auch eine Auswertung.');
    return;
  }
  const conn = connection();
  busy = true;
  const turnsBefore = conv.turns.length;
  conv.turns.push({ role: 'user', content: END_LESSON_MESSAGE });
  const waiting = el('div', { class: 'msg tutor waiting' }, el('span', { class: 'dots' }, `${TEACHER.hanzi} schreibt die Auswertung …`));
  log().append(waiting);
  scrollDown();
  try {
    const { value: summary, raw } = await ask(conn, conv.system, conv.turns, LessonSummary);
    conv.turns.push({ role: 'assistant', content: raw });
    conv.entries.push({ kind: 'summary', summary });
    conv.ended = true;
    store.learner.lessons = addLesson(store.learner.lessons, summary.notes, Date.now());
    for (const w of summary.learned) saveWord(w);
    save();
    waiting.remove();
    renderLog();
  } catch (e) {
    conv.turns.length = turnsBefore;
    waiting.remove();
    save();
    toast(e instanceof TutorError ? e.message : `Fehler: ${String(e)}`);
  } finally {
    busy = false;
  }
}

function scrollDown(): void {
  const l = log();
  l.scrollTop = l.scrollHeight;
}

function updateLessonButtons(): void {
  const running = lessonRunning();
  document.getElementById('lesson-bar')!.classList.toggle('hidden', !running);
  document.getElementById('composer')!.classList.toggle('disabled', !running);
}

export function renderLog(): void {
  const l = log();
  l.replaceChildren(...store.conversation.entries.map(renderEntry));
  if (!store.conversation.entries.length || store.conversation.ended) {
    const first = store.learner.lessons.length === 0 && !store.conversation.ended;
    l.append(
      el(
        'div',
        { class: 'empty' },
        el('div', { class: 'teacher-face' }, '👩‍🏫'),
        el(
          'p',
          {},
          first
            ? `${TEACHER.hanzi} (${TEACHER.pinyin}) ist deine Chinesischlehrerin. Ihr plaudert, sie verbessert dich behutsam und merkt sich, was du kannst und wo du hängst. Antworte per 🎤 auf Chinesisch – oder tippe (Schriftzeichen, „ni3 hao3“ oder Deutsch, wenn dir ein Wort fehlt).`
            : `${TEACHER.hanzi} freut sich auf die nächste Stunde. Thema wählen und los.`,
        ),
        button(first ? 'Erste Stunde beginnen' : 'Neue Stunde beginnen', () => void startLesson(), 'primary'),
      ),
    );
  }
  updateLessonButtons();
  scrollDown();
}

function renderEntry(entry: ChatEntry): HTMLElement {
  switch (entry.kind) {
    case 'learner':
      return el(
        'div',
        { class: 'msg learner' },
        el('div', { class: 'text' }, entry.spoken ? '🎤 ' : '', entry.text),
        hasHanzi(entry.text) ? el('div', { class: 'py-line' }, sentencePinyin(entry.text)) : null,
      );
    case 'help':
      return el('div', { class: 'msg learner help' }, entry.text);
    case 'summary':
      return renderSummary(entry.summary);
    case 'tutor':
      return renderTutor(entry.reply);
  }
}

function renderSummary(s: LessonSummary): HTMLElement {
  return el(
    'div',
    { class: 'summary' },
    el('h3', {}, '📒 Auswertung der Stunde'),
    el('p', {}, s.praise),
    s.learned.length ? el('div', { class: 'fb-title' }, 'Heute gelernt (steht jetzt in deinen Vokabeln):') : null,
    s.learned.length ? renderSegments(s.learned, showWord) : null,
    s.focus.length ? el('div', { class: 'fb-title' }, 'Woran du arbeiten kannst:') : null,
    s.focus.length ? el('ul', {}, ...s.focus.map((f) => el('li', {}, f))) : null,
  );
}

function renderTutor(r: TutorReply): HTMLElement {
  const wrap = el('div', { class: 'turn' });
  const fb = r.feedback;
  if (fb.verdict !== 'keine') {
    const [title, cls] = VERDICT[fb.verdict];
    const card = el('div', { class: `feedback ${cls}` }, el('div', { class: 'fb-title' }, title));
    if (fb.corrected.length) {
      const text = segmentsText(fb.corrected);
      const out = el('div');
      card.append(
        renderSegments(fb.corrected, showWord),
        el('div', { class: 'row' }, button('▶', () => say(text), 'small', 'Anhören'), button('🐢', () => say(text, true), 'small', 'Langsam'), shadowButton(() => text, out)),
        out,
      );
    }
    if (fb.explanation) card.append(el('div', { class: 'explain' }, fb.explanation));
    wrap.append(card);
  }

  const text = segmentsText(r.reply);
  const body = el('div', { class: 'body' }, renderSegments(r.reply, showWord));
  const translation = el('div', { class: 'translation hidden' }, r.translation);
  const out = el('div');
  const msg = el('div', { class: 'msg tutor' }, el('div', { class: 'who' }, `👩‍🏫 ${TEACHER.hanzi}`), body);
  if (store.settings.listenMode) {
    body.classList.add('covered');
    body.addEventListener('click', () => body.classList.remove('covered'), { once: true });
  }
  msg.append(
    translation,
    el(
      'div',
      { class: 'row' },
      button('▶', () => say(text), 'small', 'Anhören'),
      button('🐢', () => say(text, true), 'small', 'Langsam'),
      button('DE', () => translation.classList.toggle('hidden'), 'small', 'Übersetzung'),
      shadowButton(() => text, out),
    ),
    out,
  );
  if (r.new_words.length) {
    msg.append(el('div', { class: 'new-words' }, '✨ Neu: ', ...r.new_words.map((w) => button(`${w.text} ${w.pinyin} – ${w.de}`, () => showWord(w), 'small link'))));
  }
  if (r.tip) msg.append(el('div', { class: 'tip' }, '💡 ', r.tip));
  if (r.suggestions.length) {
    const list = el('div', { class: 'suggestions hidden' });
    for (const sug of r.suggestions) {
      const t = segmentsText(sug.segments);
      const item = el('div', { class: 'suggestion' }, renderSegments(sug.segments, showWord), el('div', { class: 'translation' }, sug.de));
      item.addEventListener('click', () => say(t));
      list.append(item);
    }
    msg.append(button('💬 Antwortideen', () => list.classList.toggle('hidden'), 'small link'), list);
  }
  wrap.append(msg);
  return wrap;
}

/** Beim Verlassen der Ansicht laufende Aufnahme und Ton stoppen. */
export function pauseChat(): void {
  stopListening?.();
  stop();
}
