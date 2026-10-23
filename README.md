# 说中文 – Chinesisch sprechen

Persönliche Web-App zum **Sprechen und Hören** von Hochchinesisch: Gespräche mit Claude, Verbesserungen und Tipps
auf Deutsch, und **überall Pinyin** – nach Ton gefärbt über jedem Schriftzeichen. Schriftzeichen lassen sich
ausblenden; gezielt Zeichen lernen ist zweitrangig (siehe `ROADMAP.md`).

## Was die App kann
- **Gespräch mit der KI** zu einem Thema (Restaurant, Taxi, Kennenlernen …) auf deinem Niveau (HSK 1–2 bis 5+).
- **Sprechen per Mikrofon** (Spracherkennung des Browsers) oder tippen: Schriftzeichen, Ziffern-Pinyin
  (`ni3 hao3` wird beim Tippen zu `nǐ hǎo`) oder Deutsch, wenn dir ein Wort fehlt.
- **Feedback zu jeder Äußerung:** verbesserter Satz mit Pinyin und Erklärung auf Deutsch. Hat die Erkennung etwas
  Seltsames verstanden, rät die KI, was gemeint war, und nennt die wahrscheinliche Ursache (z. B. falscher Ton).
- **Pinyin richtig:** eine Silbe pro Zeichen, Tonfarben (1 rot, 2 grün, 3 blau, 4 lila, neutral grau), 一/不 mit
  gesprochenem Ton. Fehlt Pinyin, ergänzt es das Wörterbuch `pinyin-pro`. Deine eigenen Sätze bekommen ebenfalls Pinyin.
- **Hören:** Antworten werden vorgelesen (Tempo einstellbar, 🐢 langsam), **Hörmodus** 👂 verdeckt den Text, bis du ihn antippst.
- **Nachsprechen 🎤:** prüft Silbe für Silbe, was die Erkennung verstanden hat (richtig / Ton anders / anderer Laut / nicht gehört).
- **Antwortideen** 💬, wenn dir nichts einfällt, und **Wörter antippen** → Bedeutung, Anhören, Merken.
- **Vokabeln:** gemerkte Wörter als Hörkarten (Leitner-System: erst hören, dann Bedeutung aufdecken).

## Starten
```bash
npm install
npm run dev        # http://localhost:5173 (mit --host auch im WLAN erreichbar)
npm test           # vitest: Pinyin, Nachsprech-Vergleich, Lernkartei, Prompt, Schema
npm run build      # Typprüfung + Build nach dist/
```
Beim ersten Start in **⚙ Einstellungen** den Claude-API-Schlüssel eintragen (console.anthropic.com → API Keys,
am besten mit monatlichem Ausgabenlimit). Er bleibt nur im localStorage dieses Browsers und geht direkt an
api.anthropic.com.

**Browser:** Chrome oder Edge (Desktop und Android) empfohlen; Safari (iOS) geht meist auch. Firefox kann keine
Spracherkennung – dort nur tippen. Für das Mikrofon auf dem Handy braucht die Seite **HTTPS** (localhost geht immer).
Chinesische Stimme unter Windows: Einstellungen → Zeit und Sprache → Sprache → „Chinesisch (vereinfacht)“ hinzufügen.

## Veröffentlichen (für das Handy)
Wie `spiele.jan-lab.de`: Cloudflare Workers, nur statische Dateien, kostenlos.
```bash
npm run build
npx wrangler@4 deploy      # nutzt wrangler.jsonc
```
Danach im Cloudflare-Dashboard eine eigene Adresse (z. B. `chinesisch.jan-lab.de`) und **Cloudflare Access**
davorsetzen, damit nur du die Seite öffnen kannst. Auf dem Handy: Seite öffnen → „Zum Startbildschirm hinzufügen“.

## Kosten
Ein Gesprächszug kostet mit Opus 5.5 grob 1–2 Cent (der Verlauf wird zwischengespeichert, Cache), mit Haiku 5.5
nur Bruchteile eines Cents. Modell in den Einstellungen wählbar.

## Aufbau
- `src/ai/` – `schema.ts` (Antwortformat, von der API erzwungen), `prompt.ts` (Systemanweisung), `tutor.ts` (API-Aufruf)
- `src/lib/` – reine Logik: `pinyin.ts`, `compare.ts` (Nachsprechen), `review.ts` (Lernkartei), `store.ts` (localStorage)
- `src/speech/` – Vorlesen (`tts.ts`) und Spracherkennung (`stt.ts`) über die Web Speech API
- `src/ui/` – Gespräch, Vokabeln, Einstellungen; `src/data/scenarios.ts` – Themen, Niveaus, Modelle
