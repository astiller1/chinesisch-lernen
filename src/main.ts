import './styles.css';
import { SCENARIOS } from './data/scenarios';
import { save, store } from './lib/store';
import { loadServerStatus, server } from './lib/server';
import { unlockAudio } from './speech/azure';
import { initChat, pauseChat, startLesson } from './ui/chat';
import { renderVocab } from './ui/vocab';
import { renderSettings } from './ui/settings';
import { closeSheet, speechModeHint } from './ui/shared';

type Tab = 'chat' | 'vocab' | 'settings';

function showTab(next: Tab): void {
  if (next !== 'chat') pauseChat();
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === next));
  document.querySelectorAll<HTMLElement>('.view').forEach((v) => v.classList.toggle('hidden', v.id !== `${next}-view`));
  document.getElementById('chat-footer')!.classList.toggle('hidden', next !== 'chat');
  document.getElementById('chat-tools')!.classList.toggle('hidden', next !== 'chat');
  if (next === 'vocab') renderVocab();
  if (next === 'settings') renderSettings();
  closeSheet();
}

function applyDisplay(): void {
  const s = store.settings;
  document.body.classList.toggle('no-pinyin', !s.showPinyin);
  document.body.classList.toggle('no-hanzi', !s.showHanzi);
  for (const [id, on] of [
    ['toggle-pinyin', s.showPinyin],
    ['toggle-hanzi', s.showHanzi],
    ['toggle-listen', s.listenMode],
  ] as const) {
    document.getElementById(id)!.classList.toggle('on', on);
  }
}

function initToolbar(): void {
  const scenario = document.getElementById('scenario') as HTMLSelectElement;
  for (const s of SCENARIOS) scenario.append(new Option(s.name, s.id));
  scenario.value = store.settings.scenario;
  scenario.addEventListener('change', () => {
    store.settings.scenario = scenario.value as typeof store.settings.scenario;
    save();
    const running = store.conversation.turns.length > 0 && !store.conversation.ended;
    if (!running || confirm('Mit dem neuen Thema eine neue Stunde beginnen?')) void startLesson();
  });

  const toggle = (id: string, key: 'showPinyin' | 'showHanzi' | 'listenMode') =>
    document.getElementById(id)!.addEventListener('click', () => {
      store.settings[key] = !store.settings[key];
      // Nie beides ausblenden.
      if (!store.settings.showPinyin && !store.settings.showHanzi) store.settings[key === 'showPinyin' ? 'showHanzi' : 'showPinyin'] = true;
      save();
      applyDisplay();
    });
  toggle('toggle-pinyin', 'showPinyin');
  toggle('toggle-hanzi', 'showHanzi');
  toggle('toggle-listen', 'listenMode');

  document.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab as Tab)));
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('#sheet')) closeSheet();
  });
  // Handys spielen Ton erst nach einer Berührung ab.
  document.addEventListener('pointerdown', unlockAudio, { once: true });
}

async function main(): Promise<void> {
  await loadServerStatus();
  initToolbar();
  applyDisplay();
  initChat();
  const hint = speechModeHint();
  document.getElementById('mode-hint')!.textContent = hint;
  document.getElementById('mode-hint')!.classList.toggle('hidden', !hint);
  showTab(server.claude || store.settings.apiKey ? 'chat' : 'settings');
}

void main();
