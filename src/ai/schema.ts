// Antwortformate der KI (strukturierte Ausgabe, von der API erzwungen).
import { z } from 'zod';

/** Ein Wort (oder Satzzeichen) mit Pinyin und deutscher Bedeutung. */
export const Segment = z.object({
  text: z.string().describe('Ein chinesisches Wort in Schriftzeichen oder ein Satzzeichen'),
  pinyin: z
    .string()
    .describe('Pinyin mit Tonzeichen, genau eine Silbe pro Schriftzeichen, Silben durch Leerzeichen getrennt; leer bei Satzzeichen'),
  de: z.string().describe('Kurze deutsche Bedeutung des Worts in diesem Satz; leer bei Satzzeichen'),
});
export type Segment = z.infer<typeof Segment>;

export const TutorReply = z.object({
  feedback: z.object({
    verdict: z
      .enum(['keine', 'gut', 'kleiner_fehler', 'fehler', 'deutsch'])
      .describe('keine = keine Äußerung des Lernenden zu bewerten (Start, "nicht verstanden"); deutsch = der Lernende hat (teilweise) Deutsch benutzt'),
    corrected: z
      .array(Segment)
      .describe('Verbesserte bzw. natürlichere Fassung dessen, was der Lernende sagen wollte; leer bei "gut" und "keine"'),
    explanation: z.string().describe('Kurze Erklärung auf Deutsch: was falsch oder unnatürlich war und warum; bei "gut" ein kurzes, ehrliches Lob oder leer'),
  }),
  reply: z.array(Segment).describe('Deine Antwort im Gespräch, nur Chinesisch, in Wörter zerlegt'),
  translation: z.string().describe('Deutsche Übersetzung deiner Antwort'),
  new_words: z
    .array(Segment)
    .describe('Höchstens zwei Wörter aus deiner Antwort, die für den Lernenden vermutlich neu sind; sonst leer'),
  tip: z.string().describe('Optional ein kurzer Tipp auf Deutsch (Aussprache, Ton, Grammatik, Wortschatz); meistens leer'),
  suggestions: z
    .array(z.object({ segments: z.array(Segment), de: z.string() }))
    .describe('Zwei bis drei kurze, mögliche Antworten des Lernenden auf deine Antwort, passend zu seinem Niveau'),
  assessment: z
    .object({
      understood: z
        .enum(['ja', 'teilweise', 'nein'])
        .describe('Hat der Lernende deine vorige Äußerung verstanden (erkennbar an seiner Antwort)? Beim Start "ja"'),
      errors: z
        .array(z.object({ topic: z.string(), example: z.string(), correction: z.string() }))
        .describe('Fehler dieser Äußerung zum Merken: topic = kurze, wiederverwendbare Fehlerart auf Deutsch (z. B. "Zählwort 碗", "Wortstellung Zeitangabe", "3. Ton bei 我"), example = was er sagte, correction = richtig'),
      facts: z
        .array(z.string())
        .describe('Neue persönliche Informationen über den Lernenden, die sich eine Lehrerin merken würde (auf Deutsch, kurz); sonst leer'),
    })
    .describe('Deine stille Einschätzung, wird nicht angezeigt'),
});
export type TutorReply = z.infer<typeof TutorReply>;

/** Auswertung am Ende einer Stunde. */
export const LessonSummary = z.object({
  praise: z.string().describe('Ein bis zwei Sätze ehrliches, konkretes Lob auf Deutsch'),
  learned: z.array(Segment).describe('Die wichtigsten 3–8 Wörter oder kurzen Ausdrücke, die in dieser Stunde neu waren oder geübt wurden'),
  focus: z.array(z.string()).describe('Ein bis zwei Dinge, an denen der Lernende als Nächstes arbeiten sollte, konkret, auf Deutsch'),
  notes: z
    .string()
    .describe('Deine Notiz für die nächste Stunde (auf Deutsch, 2–4 Sätze): Worüber ihr gesprochen habt, was gut lief, was du wieder aufgreifen willst'),
});
export type LessonSummary = z.infer<typeof LessonSummary>;
