import './styles.css';
import { SCENARIOS } from './data/scenarios';
import { save, store } from './lib/store';
import { initChat, startConversation } from './ui/chat';
import { renderVocab } from './ui/vocab';
import { renderSettings } from './ui/settings';
import { closeSheet } from './ui/shared';

type Tab = 'chat' | 'vocab' | 'settings';
let tab: Tab = 'chat';

function showTab(next: Tab): void {
  tab = next;
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === next));
  document.querySelectorAll<HTMLElement>('.view').forEach((v) => v.classList.toggle('hidden', v.id !== `${next}-view`));
  document.getElementById('composer')!.classList.toggle('hidden', next !== 'chat');
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
    if (!store.conversation.entries.length || confirm('Mit dem neuen Thema ein neues Gespräch beginnen?')) void startConversation();
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
}

initToolbar();
applyDisplay();
initChat();
showTab(store.settings.apiKey ? 'chat' : 'settings');

// Stimmen werden im Browser erst nach und nach geladen.
if ('speechSynthesis' in window) {
  speechSynthesis.addEventListener('voiceschanged', () => {
    if (tab === 'settings') renderSettings();
  });
}
