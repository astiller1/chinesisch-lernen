import { describe, expect, it } from 'vitest';
import { addFacts, addLesson, adjustLevel, focusErrors, levelGuide, recordErrors } from '../src/lib/learner';
import { assessmentCells } from '../src/lib/assessment';
import { buildSsml } from '../src/lib/ssml';

const DAY = 86_400_000;

describe('Niveau', () => {
  it('steigt langsam, wenn es gut läuft', () => {
    expect(adjustLevel(2, 'gut', 'ja')).toBeCloseTo(2.06);
  });

  it('sinkt deutlich, wenn er nicht mitkommt', () => {
    expect(adjustLevel(2, 'keine', 'nein')).toBeCloseTo(1.85);
  });

  it('bleibt zwischen 1 und 6', () => {
    expect(adjustLevel(1, 'deutsch', 'nein')).toBe(1);
    expect(adjustLevel(6, 'gut', 'ja')).toBe(6);
  });

  it('Beschreibung passt zum Niveau', () => {
    expect(levelGuide(1.2)).toContain('sehr kurze Sätze');
    expect(levelGuide(4.5)).toContain('HSK 4.5');
  });
});

describe('Fehler-Gedächtnis', () => {
  it('fasst gleiche Fehlerarten zusammen', () => {
    let e = recordErrors([], [{ topic: 'Zählwort 碗', example: 'a', correction: 'b' }], 0);
    e = recordErrors(e, [{ topic: 'zählwort  碗', example: 'c', correction: 'd' }], DAY);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ count: 2, example: 'c', lastSeen: DAY });
  });

  it('häufige und frische Fehler stehen vorn', () => {
    const now = 60 * DAY;
    const errors = [
      { topic: 'alt', example: '', correction: '', count: 5, lastSeen: 0 },
      { topic: 'neu', example: '', correction: '', count: 2, lastSeen: now },
    ];
    expect(focusErrors(errors, now, 1)[0].topic).toBe('neu');
  });

  it('ignoriert leere Fehlerarten', () => {
    expect(recordErrors([], [{ topic: ' ', example: '', correction: '' }], 0)).toEqual([]);
  });
});

describe('Notizen', () => {
  it('Fakten ohne Doppelte', () => {
    expect(addFacts(['Heißt Jan'], ['heißt jan', 'Mag Tee', ''])).toEqual(['Heißt Jan', 'Mag Tee']);
  });

  it('behält die letzten zehn Stunden', () => {
    let l = addLesson([], 'eins', 0);
    for (let i = 0; i < 12; i++) l = addLesson(l, `s${i}`, i);
    expect(l).toHaveLength(10);
    expect(l[9].summary).toBe('s11');
  });
});

describe('Ausspracheprüfung (Azure)', () => {
  it('ordnet Wortbewertungen den Zeichen zu', () => {
    const cells = assessmentCells('我想喝茶。', [
      { word: '我', accuracy: 95, errorType: 'None' },
      { word: '想', accuracy: 70, errorType: 'Mispronunciation' },
      { word: '喝', accuracy: 40, errorType: 'Mispronunciation' },
      { word: '茶', accuracy: 0, errorType: 'Omission' },
    ]);
    expect(cells.map((c) => c.result)).toEqual(['ok', 'weak', 'wrong', 'missing']);
    expect(cells[0].pinyin).toBe('wǒ');
  });

  it('mehrsilbige Wörter und eingefügte Wörter', () => {
    const cells = assessmentCells('你好吗', [
      { word: '嗯', accuracy: 90, errorType: 'Insertion' },
      { word: '你好', accuracy: 88, errorType: 'None' },
    ]);
    expect(cells.map((c) => c.result)).toEqual(['ok', 'ok', 'missing']);
  });
});

describe('SSML', () => {
  it('Tempo, Stimme und Sonderzeichen', () => {
    const s = buildSsml('你好 <b>&', 'zh-CN-YunxiNeural', 0.8);
    expect(s).toContain('name="zh-CN-YunxiNeural"');
    expect(s).toContain('rate="-20%"');
    expect(s).toContain('你好 &lt;b&gt;&amp;');
  });

  it('unbekannte Stimme wird ersetzt', () => {
    expect(buildSsml('好', 'evil"/>', 1)).toContain('name="zh-CN-XiaoxiaoNeural"');
    expect(buildSsml('好', '', 1)).toContain('rate="+0%"');
  });
});
