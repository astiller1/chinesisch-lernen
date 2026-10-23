// Gesprächsthemen und Niveaus. Neue Themen einfach hier ergänzen.

export interface Scenario {
  id: string;
  name: string;
  /** Anweisung an die KI (Rolle und Situation) */
  setup: string;
}

export const SCENARIOS = [
  {
    id: 'frei',
    name: 'Freies Gespräch',
    setup: 'Ein lockeres Alltagsgespräch unter Freunden. Du stellst Fragen zu Alltag, Familie, Hobbys und Wochenende.',
  },
  {
    id: 'kennenlernen',
    name: 'Kennenlernen',
    setup: 'Ihr lernt euch gerade kennen (z. B. auf einer Feier). Name, Herkunft, Beruf, warum Chinesisch lernen.',
  },
  {
    id: 'restaurant',
    name: 'Im Restaurant',
    setup: 'Du bist Kellnerin in einem Restaurant in Peking. Der Lernende bestellt Essen und Getränke und zahlt.',
  },
  {
    id: 'markt',
    name: 'Einkaufen und Handeln',
    setup: 'Du bist Verkäufer auf einem Markt. Der Lernende fragt nach Preisen, Größen, Farben und handelt.',
  },
  {
    id: 'taxi',
    name: 'Taxi und Weg fragen',
    setup: 'Du bist Taxifahrer bzw. Passant. Der Lernende sagt, wohin er will, oder fragt nach dem Weg.',
  },
  {
    id: 'hotel',
    name: 'Im Hotel',
    setup: 'Du arbeitest an der Hotelrezeption. Einchecken, Fragen zum Zimmer, Frühstück, Probleme melden.',
  },
  {
    id: 'arbeit',
    name: 'Arbeit und Kollegen',
    setup: 'Du bist eine Kollegin. Gespräch über Arbeit, Projekte, Termine und Mittagessen.',
  },
  {
    id: 'arzt',
    name: 'Beim Arzt',
    setup: 'Du bist Ärztin. Der Lernende beschreibt Beschwerden, du fragst nach und gibst Ratschläge.',
  },
  {
    id: 'telefon',
    name: 'Telefonieren',
    setup: 'Ein Telefonat: einen Tisch reservieren, einen Termin vereinbaren oder jemanden verabreden.',
  },
] as const satisfies readonly Scenario[];

export type ScenarioId = (typeof SCENARIOS)[number]['id'];

export interface Level {
  id: string;
  name: string;
  /** Beschreibung für die KI */
  guide: string;
}

export const LEVELS = [
  {
    id: 'a1',
    name: 'Anfänger (HSK 1–2)',
    guide: 'Sehr einfache, kurze Sätze (3–8 Zeichen), nur Grundwortschatz HSK 1–2, langsam steigern.',
  },
  {
    id: 'a2',
    name: 'Grundlagen (HSK 3)',
    guide: 'Einfache Sätze bis etwa 15 Zeichen, Wortschatz bis HSK 3, gängige Satzmuster.',
  },
  {
    id: 'b1',
    name: 'Mittelstufe (HSK 4)',
    guide: 'Natürliche Alltagssprache, Wortschatz bis HSK 4, auch Nebensätze und Umgangssprache.',
  },
  {
    id: 'b2',
    name: 'Fortgeschritten (HSK 5+)',
    guide: 'Natürliches, flüssiges Chinesisch wie unter Muttersprachlern, auch Redewendungen.',
  },
] as const satisfies readonly Level[];

export type LevelId = (typeof LEVELS)[number]['id'];
