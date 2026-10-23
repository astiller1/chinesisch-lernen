// Einstellungen und „Was 林老师 über dich weiß“ (Gedächtnis ansehen, korrigieren, zurücksetzen).
import { LEVELS } from '../data/scenarios';
import { TEACHER } from '../ai/prompt';
import { ENGINE_NAMES } from '../ai/llm';
import { lastEngine } from '../ai/tutor';
import { save, startLevel, store, type Settings } from '../lib/store';
import { clampLevel, newLearner } from '../lib/learner';
import { VOICES } from '../lib/ssml';
import { server } from '../lib/server';
import { usesAzure } from '../speech';
import { button, el } from './dom';
import { say } from './shared';

function select<K extends 'level' | 'voice'>(key: K, options: readonly { id: string; name: string }[]): HTMLSelectElement {
  const s = el('select');
  for (const o of options) s.append(el('option', { value: o.id }, o.name));
  s.value = String(store.settings[key]);
  s.addEventListener('change', () => {
    (store.settings[key] as Settings[K]) = s.value as Settings[K];
    save();
  });
  return s;
}

function checkbox(key: 'autoPlay' | 'autoSend', label: string): HTMLElement {
  const c = el('input', { type: 'checkbox' });
  c.checked = store.settings[key];
  c.addEventListener('change', () => {
    store.settings[key] = c.checked;
    save();
  });
  return el('label', { class: 'check' }, c, label);
}

function field(label: string, control: HTMLElement, hint = ''): HTMLElement {
  return el('label', { class: 'field' }, el('span', {}, label), control, hint ? el('small', {}, hint) : null);
}

function status(ok: boolean, yes: string, no: string): HTMLElement {
  return el('div', { class: `status ${ok ? 'ok' : 'warn'}` }, ok ? `✓ ${yes}` : `⚠ ${no}`);
}

function text(key: 'ollamaUrl' | 'ollamaModel'): HTMLInputElement {
  const input = el('input', { type: 'text', autocomplete: 'off' });
  input.value = store.settings[key];
  input.addEventListener('change', () => {
    store.settings[key] = input.value.trim();
    save();
  });
  return input;
}

function aiSection(): HTMLElement[] {
  const last = lastEngine ? ` Zuletzt hat ${ENGINE_NAMES[lastEngine]} geantwortet.` : '';
  if (server.ai) return [status(true, `KI: kostenlos – Qwen auf deinem PC, wenn er an ist, sonst Qwen bei Cloudflare.${last}`, '')];
  return [
    status(false, '', 'KI: kein Server (lokaler Modus mit Ollama auf diesem Rechner)'),
    field('Ollama-Adresse', text('ollamaUrl')),
    field('Ollama-Modell', text('ollamaModel'), 'z. B. qwen-local oder qwen-schnell'),
  ];
}

function speechSection(): HTMLElement[] {
  const rate = el('input', { type: 'range', min: '0.5', max: '1.2', step: '0.05' });
  rate.value = String(store.settings.rate);
  const rateLabel = el('span', {}, `${Math.round(store.settings.rate * 100)} %`);
  rate.addEventListener('input', () => {
    store.settings.rate = Number(rate.value);
    rateLabel.textContent = `${Math.round(store.settings.rate * 100)} %`;
    save();
  });
  return [
    status(usesAzure(), 'Sprache: Azure (natürliche Stimme, gute Erkennung, Ausspracheprüfung)', 'Sprache: Azure nicht eingerichtet – Notbehelf mit Browser-Stimme'),
    usesAzure() ? field(`Stimme von ${TEACHER.hanzi}`, select('voice', VOICES)) : el('span'),
    field('Sprechtempo', el('div', { class: 'row' }, rate, rateLabel, button('▶ Probe', () => say('你好！今天我们聊聊天吧。'), 'small'))),
    checkbox('autoPlay', 'Antworten automatisch vorlesen'),
    checkbox('autoSend', 'Nach dem Sprechen automatisch senden'),
  ];
}

function memorySection(): HTMLElement[] {
  const l = store.learner;
  const levelLabel = el('strong', {}, `HSK ${l.level.toFixed(1)}`);
  const changeLevel = (d: number) => {
    l.level = clampLevel(l.level + d);
    levelLabel.textContent = `HSK ${l.level.toFixed(1)}`;
    save();
  };
  const list = (items: string[], remove: (i: number) => void) =>
    el(
      'ul',
      { class: 'memory' },
      ...items.map((text, i) =>
        el(
          'li',
          {},
          el('span', {}, text),
          button('✕', () => {
            remove(i);
            save();
            renderSettings();
          }, 'small ghost', 'Vergessen'),
        ),
      ),
    );
  const reset = () => {
    if (!confirm(`${TEACHER.hanzi} vergisst alles über dich (Niveau, Fehler, Notizen). Vokabeln bleiben. Sicher?`)) return;
    store.learner = newLearner(startLevel(store.settings.level));
    save();
    renderSettings();
  };
  return [
    el('h2', {}, `Was ${TEACHER.hanzi} über dich weiß`),
    el('p', { class: 'hint' }, 'Wird zu Beginn jeder Stunde mitgegeben. Falsches kannst du hier löschen.'),
    field(
      'Dein Niveau (passt sich beim Sprechen von selbst an)',
      el('div', { class: 'row' }, button('−', () => changeLevel(-0.25), 'small', 'Leichter'), levelLabel, button('+', () => changeLevel(0.25), 'small', 'Schwerer')),
    ),
    el('h3', {}, 'Persönliches'),
    l.facts.length ? list(l.facts, (i) => l.facts.splice(i, 1)) : el('p', { class: 'hint' }, 'Noch nichts.'),
    el('h3', {}, 'Typische Fehler'),
    l.errors.length
      ? list(
          l.errors.map((e) => `${e.topic} (${e.count}×): „${e.example}“ → „${e.correction}“`),
          (i) => l.errors.splice(i, 1),
        )
      : el('p', { class: 'hint' }, 'Noch keine.'),
    el('h3', {}, 'Notizen zu den Stunden'),
    l.lessons.length
      ? list(
          l.lessons.map((n) => `${new Date(n.date).toLocaleDateString('de-DE')}: ${n.summary}`),
          (i) => l.lessons.splice(i, 1),
        )
      : el('p', { class: 'hint' }, 'Noch keine abgeschlossene Stunde.'),
    field('Startniveau für ein neues Gedächtnis', select('level', LEVELS)),
    button('Gedächtnis zurücksetzen', reset, 'small'),
  ];
}

export function renderSettings(): void {
  document.getElementById('settings-view')!.replaceChildren(
    el('h2', {}, 'Einstellungen'),
    ...aiSection(),
    ...speechSection(),
    ...memorySection(),
  );
}
