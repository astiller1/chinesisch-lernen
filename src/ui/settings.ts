// Einstellungen: API-Schlüssel, Modell, Niveau, Stimme und Tempo.
import { LEVELS, MODELS } from '../data/scenarios';
import { save, store, type Settings } from '../lib/store';
import { canSpeak, chineseVoices } from '../speech/tts';
import { canRecognize } from '../speech/stt';
import { button, el } from './dom';
import { say, toast } from './shared';

function select<K extends keyof Settings>(key: K, options: readonly { id: string; name: string }[]): HTMLSelectElement {
  const s = el('select');
  for (const o of options) s.append(el('option', { value: o.id }, o.name));
  s.value = String(store.settings[key]);
  s.addEventListener('change', () => {
    (store.settings[key] as string) = s.value;
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

export function renderSettings(): void {
  const view = document.getElementById('settings-view')!;
  const key = el('input', { type: 'password', autocomplete: 'off', placeholder: 'sk-ant-…' });
  key.value = store.settings.apiKey;
  key.addEventListener('change', () => {
    store.settings.apiKey = key.value.trim();
    save();
    toast('Schlüssel gespeichert.');
  });

  const rate = el('input', { type: 'range', min: '0.5', max: '1.2', step: '0.05' });
  rate.value = String(store.settings.rate);
  const rateLabel = el('span', {}, `${Math.round(store.settings.rate * 100)} %`);
  rate.addEventListener('input', () => {
    store.settings.rate = Number(rate.value);
    rateLabel.textContent = `${Math.round(store.settings.rate * 100)} %`;
    save();
  });

  const voices = chineseVoices();
  const voice = select('voice', [{ id: '', name: 'Automatisch' }, ...voices.map((v) => ({ id: v.name, name: `${v.name} (${v.lang})` }))]);

  view.replaceChildren(
    el('h2', {}, 'Einstellungen'),
    field(
      'Claude-API-Schlüssel',
      key,
      'Bleibt nur in diesem Browser gespeichert und geht nur an api.anthropic.com. Schlüssel anlegen: console.anthropic.com → API Keys (am besten mit Ausgabenlimit).',
    ),
    field('KI-Modell', select('model', MODELS), 'Opus antwortet am besten, Haiku ist am günstigsten.'),
    field('Niveau', select('level', LEVELS), 'Gilt ab der nächsten Antwort.'),
    field('Stimme', voice, voices.length ? '' : 'Keine chinesische Stimme gefunden. Unter Windows: Einstellungen → Zeit und Sprache → Sprache → Chinesisch (vereinfacht) hinzufügen.'),
    field('Sprechtempo', el('div', { class: 'row' }, rate, rateLabel, button('▶ Probe', () => say('你好，我们今天说中文吧。'), 'small'))),
    checkbox('autoPlay', 'Antworten automatisch vorlesen'),
    checkbox('autoSend', 'Nach dem Sprechen automatisch senden'),
    el(
      'p',
      { class: 'hint' },
      `Spracherkennung: ${canRecognize() ? 'verfügbar ✓' : 'nicht verfügbar (Chrome oder Edge verwenden)'} · Vorlesen: ${canSpeak() ? 'verfügbar ✓' : 'nicht verfügbar'}`,
    ),
  );
}
