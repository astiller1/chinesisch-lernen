// Antwortformat der KI (strukturierte Ausgabe, von der API erzwungen).
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
      .describe('keine = es gab keine Äußerung des Lernenden; deutsch = der Lernende hat (teilweise) Deutsch benutzt'),
    corrected: z
      .array(Segment)
      .describe('Verbesserte bzw. natürlichere Fassung dessen, was der Lernende sagen wollte; leer bei "gut" und "keine"'),
    explanation: z.string().describe('Kurze Erklärung auf Deutsch: was falsch oder unnatürlich war und warum; leer bei "keine"'),
  }),
  reply: z.array(Segment).describe('Deine Antwort im Gespräch, auf Chinesisch, in Wörter zerlegt'),
  translation: z.string().describe('Deutsche Übersetzung deiner Antwort'),
  tip: z.string().describe('Optional ein kurzer Tipp auf Deutsch (Aussprache, Ton, Grammatik, Wortschatz); sonst leer'),
  suggestions: z
    .array(
      z.object({
        segments: z.array(Segment),
        de: z.string(),
      }),
    )
    .describe('Zwei bis drei kurze, mögliche Antworten des Lernenden auf deine Antwort, passend zu seinem Niveau'),
});
export type TutorReply = z.infer<typeof TutorReply>;
