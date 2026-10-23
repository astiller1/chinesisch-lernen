# 说中文 – Projektkontext

Persönliche Chinesisch-Lern-App von Jan: **die perfekte Sprachlehrerin** (林老师), mit der man plaudert, die nicht
überfordert, aber fordert, und behutsam verbessert. Schwerpunkt **Sprechen und Hören**. **Pinyin ist das wichtigste
Merkmal** (deshalb die eigene App). Schriftzeichen gezielt lernen ist zweitrangig. Browser-Sprachausgabe ist für Jan
keine Option (nur Notbehelf in der lokalen Entwicklung). Oberfläche und Doku auf Deutsch, Code-Bezeichner Englisch.

## Technik
- Vite + TypeScript (strict), kein Framework, schlichtes DOM. Läuft als Cloudflare Worker (`worker/`) hinter
  Cloudflare Access; der Worker hält die Schlüssel (Claude, Azure) und prüft das Access-JWT (fail closed).
- Claude über `@anthropic-ai/sdk` (Basis-URL `/api/anthropic` des Workers; lokal eigener Schlüssel).
  Strukturierte Ausgabe (`betaZodOutputFormat` + `client.beta.messages.parse`), `effort: 'low'`, Cache auf dem
  Verlauf, `fallbacks: 'default'`. Modell-IDs nur in `src/data/scenarios.ts` (`MODELS`).
- Sprache: Azure Speech. Ausgabe als MP3 über den Worker (`/api/speech/tts`), Erkennung und Ausspracheprüfung
  mit dem Speech SDK im Browser (Token von `/api/speech/token`, SDK wird erst bei Bedarf geladen).
- Pinyin-Wörterbuch: `pinyin-pro`. Daten (Einstellungen, Gespräch, Lernerprofil, Vokabeln) im localStorage.

## Regeln
- Systemanweisung wird zu Stundenbeginn festgelegt und bleibt die ganze Stunde gleich; Verlauf nur anhängen.
  Niveau-Änderungen gehen als `role: 'system'`-Nachricht nach der Nutzernachricht (Cache, Nachdenk-Blöcke).
- Pinyin der KI: eine Silbe pro Zeichen, Tonzeichen, 一/不 mit Sandhi (siehe `src/ai/prompt.ts`). Passt die
  Silbenzahl nicht, steht das Pinyin über dem ganzen Wort (`alignWord`).
- Reine Logik in `src/lib/` mit vitest-Tests; `npm test` und `npm run build` vor jedem Commit.
- Keine Schlüssel im Repo oder im Browser des Handys; Secrets nur per `wrangler secret put`, lokal `.dev.vars`.
- `ROADMAP.md`, `README.md` und diese Datei aktuell halten.
