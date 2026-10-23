# 说中文 – Projektkontext

Persönliche Chinesisch-Lern-App von Jan: **die perfekte Sprachlehrerin** (林老师), mit der man plaudert, die nicht
überfordert, aber fordert, und behutsam verbessert. Schwerpunkt **Sprechen und Hören**. **Pinyin ist das wichtigste
Merkmal** (deshalb die eigene App). Schriftzeichen gezielt lernen ist zweitrangig. Browser-Sprachausgabe ist für Jan
keine Option (nur Notbehelf in der lokalen Entwicklung). Oberfläche und Doku auf Deutsch, Code-Bezeichner Englisch.

## Technik
- Vite + TypeScript (strict), kein Framework, schlichtes DOM. Läuft als Cloudflare Worker (`worker/`) hinter
  Cloudflare Access; der Worker hält den Azure-Schlüssel und prüft das Access-JWT (fail closed).
- **KI kostenlos, keine bezahlte API** (Jans Vorgabe): `POST /api/chat` im Worker fragt zuerst Ollama auf Jans PC
  (`qwen-schnell`, ca. 8 s pro Antwort; `qwen-local` war mit 25–30 s zu langsam; über den Cloudflare-Tunnel `ollama.jan-lab.de`, gesichert mit Access-Service-Token), sonst Qwen auf
  Cloudflare Workers AI (`WORKERS_AI_MODEL`, kostenloses Tageskontingent). Lokal (`npm run dev`) direkt Ollama.
  Logik in `src/ai/llm.ts` (von App und Worker genutzt). Antwortformat: Zod-Schema → JSON-Schema in der
  Systemanweisung (Ollama zusätzlich `format`), Antwort mit Zod geprüft, bei Fehler ein zweiter Versuch.
- Sprache: Azure Speech. Ausgabe als MP3 über den Worker (`/api/speech/tts`), Erkennung und Ausspracheprüfung
  mit dem Speech SDK im Browser (Token von `/api/speech/token`, SDK wird erst bei Bedarf geladen).
- Pinyin-Wörterbuch: `pinyin-pro`. Daten (Einstellungen, Gespräch, Lernerprofil, Vokabeln) im localStorage.

## Regeln
- Systemanweisung wird zu Stundenbeginn festgelegt und bleibt die ganze Stunde gleich; Verlauf nur anhängen.
  Niveau-Änderungen gehen als `role: 'system'`-Nachricht nach der Nutzernachricht; `toMessages` hängt sie als
  „[Hinweis]“ an die Nutzernachricht an (nicht jede Chat-Vorlage erlaubt Systemnachrichten mittendrin).
- Pinyin der KI: eine Silbe pro Zeichen, Tonzeichen, 一/不 mit Sandhi (siehe `src/ai/prompt.ts`). Passt die
  Silbenzahl nicht, steht das Pinyin über dem ganzen Wort (`alignWord`).
- Reine Logik in `src/lib/` mit vitest-Tests; `npm test` und `npm run build` vor jedem Commit.
- Keine Schlüssel im Repo oder im Browser des Handys; Secrets nur per `wrangler secret put`, lokal `.dev.vars`.
- `ROADMAP.md`, `README.md` und diese Datei aktuell halten.
