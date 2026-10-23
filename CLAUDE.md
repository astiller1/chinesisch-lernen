# 说中文 – Projektkontext

Persönliche Chinesisch-Lern-App von Jan. Schwerpunkt **Sprechen und Hören** durch Gespräche mit Claude,
Verbesserungen und Tipps auf Deutsch. **Pinyin ist das wichtigste Merkmal** (deshalb die eigene App: andere Apps
sind darin schlecht). Schriftzeichen gezielt lernen ist zweitrangig. Oberfläche und Doku auf Deutsch,
Code-Bezeichner auf Englisch.

## Technik
Vite + TypeScript (strict), kein Framework, schlichtes DOM. Claude über `@anthropic-ai/sdk` direkt aus dem
Browser (`dangerouslyAllowBrowser`, Schlüssel im localStorage – bewusst, persönliche App hinter Cloudflare Access).
Strukturierte Ausgabe (`betaZodOutputFormat` + `client.beta.messages.parse`), `effort: 'low'`, Cache auf dem
Verlauf, `fallbacks: 'default'`. Spracherkennung/Vorlesen: Web Speech API. Pinyin-Wörterbuch: `pinyin-pro`.

## Regeln
- Pinyin der KI: eine Silbe pro Zeichen, Tonzeichen, 一/不 mit Sandhi (siehe `src/ai/prompt.ts`). Passt die
  Silbenzahl nicht, steht das Pinyin über dem ganzen Wort (`alignWord`).
- Verlauf an die API nur anhängen, nie nachträglich ändern (Cache, Nachdenk-Blöcke).
- Reine Logik in `src/lib/` mit vitest-Tests; `npm test` und `npm run build` vor jedem Commit.
- Modell-IDs nur in `src/data/scenarios.ts` (`MODELS`).
- `ROADMAP.md` und diese Datei aktuell halten.
