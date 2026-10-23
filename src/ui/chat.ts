// Gesprächsansicht: Verlauf, Feedback, Mikrofon und Eingabe.
import { askTutor, TutorError } from '../ai/tutor';
import { learnerMessage, START_MESSAGE } from '../ai/prompt';
import type { TutorReply } from '../ai/schema';
import { save, store, type ChatEntry } from '../lib/store';
import { hasHanzi, numberedToMarks, sentencePinyin } from '../lib/pinyin';
import { canRecognize, listen } from '../speech/stt';
import { stopSpeaking } from '../speech/tts';
import { button, el } from './dom';
import { renderSegments, segmentsText } from './segments';
import { say, shadowButton, showWord, toast } from './shared';

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

export function initChat(): void {
  const mic = document.getElementById('mic') as HTMLButtonElement;
  const send = document.getElementById('send') as HTMLButtonElement;
  const box = input();

  if (!canRecognize()) mic.title = 'Spracherkennung geht nur in Chrome, Edge oder Safari';
  mic.addEventListener('click', toggleMic);
  send.addEventListener('click', () => void submit());
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
    if (store.conversation.entries.length && !confirm('Neues Gespräch beginnen? Das jetzige wird gelöscht.')) return;
    void startConversation();
  });
  renderLog();
}

function updatePreview(): void {
  const text = input().value.trim();
  const preview = document.getElementById('preview')!;
  preview.textContent = hasHanzi(text) ? sentencePinyin(text) : '';
}

function toggleMic(): void {
  const mic = document.getElementById('mic')!;
  if (stopListening) {
    stopListening();
    return;
  }
  stopSpeaking();
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

export async function startConversation(): Promise<void> {
  store.conversation = { turns: [], entries: [] };
  save();
  renderLog();
  await exchange(START_MESSAGE);
}

async function submit(): Promise<void> {
  const text = input().value.trim();
  if (!text || busy) return;
  if (!store.settings.apiKey) {
    toast('Bitte zuerst den API-Schlüssel in den Einstellungen eintragen.');
    return;
  }
  const spoken = lastSpoken;
  input().value = '';
  lastSpoken = false;
  updatePreview();
  const entry: ChatEntry = { kind: 'learner', text, spoken };
  store.conversation.entries.push(entry);
  log().append(renderEntry(entry));
  scrollDown();
  await exchange(learnerMessage(text, spoken));
}

/** Schickt eine Nachricht des Lernenden und zeigt die Antwort. */
async function exchange(message: string): Promise<void> {
  if (!store.settings.apiKey) {
    toast('Bitte zuerst den API-Schlüssel in den Einstellungen eintragen.');
    return;
  }
  busy = true;
  log().querySelector('.empty')?.remove();
  const conv = store.conversation;
  conv.turns.push({ role: 'user', content: message });
  const waiting = el('div', { class: 'msg tutor waiting' }, el('span', { class: 'dots' }, '思考中 …'));
  log().append(waiting);
  scrollDown();
  try {
    const s = store.settings;
    const { reply, raw } = await askTutor({ apiKey: s.apiKey, model: s.model, scenario: s.scenario, level: s.level }, conv.turns);
    conv.turns.push({ role: 'assistant', content: raw });
    const entry: ChatEntry = { kind: 'tutor', reply };
    conv.entries.push(entry);
    save();
    waiting.replaceWith(renderEntry(entry));
    scrollDown();
    if (s.autoPlay) say(segmentsText(reply.reply));
  } catch (e) {
    // Fehlgeschlagene Nachricht wieder aus dem Verlauf nehmen, damit sie erneut gesendet werden kann.
    conv.turns.pop();
    const last = conv.entries[conv.entries.length - 1];
    if (last?.kind === 'learner' && message !== START_MESSAGE) {
      conv.entries.pop();
      input().value = last.text;
      updatePreview();
      log().lastElementChild?.previousElementSibling?.remove();
    }
    waiting.remove();
    save();
    if (!conv.entries.length) renderLog();
    toast(e instanceof TutorError ? e.message : `Fehler: ${String(e)}`);
  } finally {
    busy = false;
  }
}

function scrollDown(): void {
  const l = log();
  l.scrollTop = l.scrollHeight;
}

export function renderLog(): void {
  const l = log();
  l.replaceChildren(...store.conversation.entries.map(renderEntry));
  if (!store.conversation.entries.length) {
    l.append(
      el(
        'div',
        { class: 'empty' },
        el('p', {}, 'Wähle oben ein Thema und starte ein Gespräch. Antworte per 🎤 auf Chinesisch – oder tippe (Schriftzeichen, Pinyin wie „ni3 hao3“ oder Deutsch, wenn dir ein Wort fehlt).'),
        button('Gespräch starten', () => void startConversation(), 'primary'),
      ),
    );
  }
  scrollDown();
}

function renderEntry(entry: ChatEntry): HTMLElement {
  if (entry.kind === 'learner') {
    return el(
      'div',
      { class: 'msg learner' },
      el('div', { class: 'text' }, entry.spoken ? '🎤 ' : '', entry.text),
      hasHanzi(entry.text) ? el('div', { class: 'py-line' }, sentencePinyin(entry.text)) : null,
    );
  }
  return renderTutor(entry.reply);
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
  const msg = el('div', { class: 'msg tutor' }, body);
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
