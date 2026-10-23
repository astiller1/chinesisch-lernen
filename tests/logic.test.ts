import { describe, expect, it } from 'vitest';
import { alignWord, numberedToMarks, sentencePinyin, stripTones, toneOf } from '../src/lib/pinyin';
import { compareSpoken } from '../src/lib/compare';
import { dueItems, grade, newItem } from '../src/lib/review';
import { newLearner } from '../src/lib/learner';
import { learnerMessage, systemPrompt } from '../src/ai/prompt';
import { TutorReply } from '../src/ai/schema';

describe('pinyin', () => {
  it('erkennt Töne', () => {
    expect(toneOf('mā')).toBe(1);
    expect(toneOf('hǎo')).toBe(3);
    expect(toneOf('lǜ')).toBe(4);
    expect(toneOf('ma')).toBe(5);
  });

  it('wandelt Ziffern-Pinyin um', () => {
    expect(numberedToMarks('ni3 hao3')).toBe('nǐ hǎo');
    expect(numberedToMarks('lv4 nu:3')).toBe('lǜ nǚ');
    expect(numberedToMarks('dou1 gui4 liu2')).toBe('dōu guì liú');
    expect(numberedToMarks('ma5 Bei3jing1')).toBe('ma Běijīng');
  });

  it('entfernt Tonzeichen', () => {
    expect(stripTones('nǚ hǎo')).toBe('nü hao');
  });

  it('ordnet Silben Zeichen zu', () => {
    expect(alignWord('你好', 'nǐ hǎo')).toEqual([
      { hanzi: '你', pinyin: 'nǐ' },
      { hanzi: '好', pinyin: 'hǎo' },
    ]);
    expect(alignWord('点儿', 'diǎnr')).toBeNull();
  });

  it('liefert Satz-Pinyin mit Kontext', () => {
    expect(sentencePinyin('银行')).toBe('yín háng');
  });
});

describe('Nachsprechen', () => {
  it('alles richtig', () => {
    const r = compareSpoken('你好吗？', '你好吗');
    expect(r.score).toBe(1);
  });

  it('gleich klingendes anderes Zeichen zählt als richtig', () => {
    const r = compareSpoken('我是老师', '我事老师');
    expect(r.cells.map((c) => c.result)).toEqual(['ok', 'ok', 'ok', 'ok']);
  });

  it('erkennt falschen Ton', () => {
    const r = compareSpoken('我买', '我卖'); // mǎi vs mài
    expect(r.cells[1].result).toBe('tone');
    expect(r.cells[1].heard).toBe('mài');
  });

  it('erkennt fehlende und falsche Silben', () => {
    const r = compareSpoken('我喜欢喝茶', '我喜欢喝');
    expect(r.cells.map((c) => c.result)).toEqual(['ok', 'ok', 'ok', 'ok', 'missing']);
    expect(compareSpoken('我喜欢喝茶', '我喜欢吃茶').cells[3].result).toBe('wrong');
  });
});

describe('Lernkartei', () => {
  const now = 1_000_000_000_000;
  it('steigt bei gewusst auf und fällt bei nicht gewusst zurück', () => {
    let item = newItem('茶', 'chá', 'Tee', now);
    item = grade(item, true, now);
    expect(item.box).toBe(1);
    expect(item.due).toBe(now + 86_400_000);
    item = grade(item, false, now);
    expect(item.box).toBe(0);
  });

  it('liefert fällige Karten', () => {
    const a = newItem('茶', 'chá', 'Tee', now);
    const b = { ...newItem('水', 'shuǐ', 'Wasser', now), due: now + 1000 };
    expect(dueItems([a, b], now)).toEqual([a]);
  });
});

describe('Prompt und Schema', () => {
  it('enthält Situation, Niveau und Gedächtnis', () => {
    const learner = { ...newLearner(2.4), facts: ['Heißt Jan'], errors: [{ topic: 'Zählwort 碗', example: '一个面条', correction: '一碗面条', count: 3, lastSeen: 0 }] };
    const p = systemPrompt({ scenario: 'restaurant', learner, recycle: [newItem('茶', 'chá', 'Tee', 0)], now: 0 });
    expect(p).toContain('Restaurant');
    expect(p).toContain('HSK 2.4');
    expect(p).toContain('Heißt Jan');
    expect(p).toContain('Zählwort 碗 (3×)');
    expect(p).toContain('茶 (chá)');
  });

  it('erste Stunde ohne Gedächtnis', () => {
    expect(systemPrompt({ scenario: 'frei', learner: newLearner(1.5), recycle: [], now: 0 })).toContain('Ihr kennt euch noch nicht');
  });

  it('markiert gesprochene Eingaben', () => {
    expect(learnerMessage('你好', true)).toBe('[gesprochen] 你好');
    expect(learnerMessage('你好', false)).toBe('你好');
  });

  it('Schema akzeptiert eine typische Antwort', () => {
    const ok = TutorReply.safeParse({
      feedback: { verdict: 'gut', corrected: [], explanation: '' },
      reply: [
        { text: '你好', pinyin: 'nǐ hǎo', de: 'hallo' },
        { text: '！', pinyin: '', de: '' },
      ],
      translation: 'Hallo!',
      tip: '',
      new_words: [],
      suggestions: [{ segments: [{ text: '你好', pinyin: 'nǐ hǎo', de: 'hallo' }], de: 'Hallo' }],
      assessment: { understood: 'ja', errors: [], facts: [] },
    });
    expect(ok.success).toBe(true);
  });
});
