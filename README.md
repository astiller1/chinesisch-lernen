# 说中文 – Chinesisch mit 林老师

Persönliche Web-App fürs Handy und den PC: **Plaudern mit einer KI-Chinesischlehrerin** (林老师, Lín lǎoshī),
die dich behutsam verbessert, sich merkt, was du kannst, und dich nach und nach weiterbringt. **Pinyin überall**,
nach Ton gefärbt über jedem Zeichen. Gehirn: Claude. Stimme, Spracherkennung und Ausspracheprüfung: Azure Speech.

## Was die App kann
- **Stunden mit 林老师:** Thema wählen (Plaudern, Restaurant, Taxi …), sprechen per 🎤, sie antwortet kurz und fragt
  zurück. Am Ende „📒 Stunde beenden“ → Auswertung mit Lob, gelernten Wörtern und dem, woran du arbeiten kannst.
- **Sie passt sich an:** Ein Niveau-Wert (HSK 1.0–6.0) steigt langsam, wenn es gut läuft, und sinkt deutlicher,
  wenn du nicht mitkommst. Bei „🤔 Nicht verstanden“ sagt sie es einfacher.
- **Sie hat ein Gedächtnis:** typische Fehler (übt sie gezielt wieder), Persönliches, Notizen zu den letzten Stunden,
  fällige Vokabeln (baut sie ins Gespräch ein). Alles einsehbar und löschbar unter ⚙ „Was 林老师 über dich weiß“.
- **Feedback zu jedem Satz:** verbesserter Satz mit Pinyin, Erklärung auf Deutsch. Versteht die Erkennung etwas
  Seltsames, rät sie, was du meintest, und nennt die wahrscheinliche Ursache (z. B. Ton).
- **Pinyin:** eine Silbe pro Zeichen, Tonfarben (1 rot, 2 grün, 3 blau, 4 lila, neutral grau), 一/不 mit
  gesprochenem Ton. Pinyin oder Zeichen ausblendbar, Hörmodus 👂 verdeckt den Text bis zum Antippen.
- **Nachsprechen 🎤** bei jedem Satz: Azure-Ausspracheprüfung mit Punktzahl und Bewertung je Wort.
- **Vokabeln:** neue Wörter landen automatisch dort; Hörkarten mit Leitner-System.
- Tippen geht auch: Schriftzeichen, `ni3 hao3` (wird zu `nǐ hǎo`) oder Deutsch („Wie sagt man …?“).

## Aufbau
```
Handy/PC ──▶ Cloudflare Worker (chinesisch.jan-lab.de, hinter Cloudflare Access)
               ├─ App (dist/)
               ├─ /api/anthropic  → Claude (Schlüssel auf dem Server)
               ├─ /api/speech/tts → Azure-Sprachausgabe (MP3)
               └─ /api/speech/token → kurzlebiges Azure-Token für Erkennung/Ausspracheprüfung im Browser
```
Der Worker prüft bei jeder `/api`-Anfrage das Access-Login (JWT). Ohne Access-Konfiguration bleiben die Schlüssel gesperrt.

## Einrichten (einmalig, ca. 20 Minuten)

### 1. Claude-API-Schlüssel
console.anthropic.com → API Keys → neuen Schlüssel anlegen. Unter Billing ein **monatliches Ausgabenlimit** setzen.

### 2. Azure Speech
1. portal.azure.com → „Ressource erstellen“ → **Speech** (Azure AI Speech) suchen → Erstellen.
2. Region **West Europe**, Tarif **Free F0** (kostenlos, mit Monatskontingent) oder S0.
3. In der Ressource unter „Schlüssel und Endpunkt“: **Schlüssel 1** und **Region** (`westeurope`) notieren.

### Automatisch
In einer Claude-Code-Sitzung mit den Umgebungsvariablen aus `tools/einrichten.sh` erledigt `tools/einrichten.sh` die Schritte 3 und 4 komplett (Worker, Access nur für eine E-Mail-Adresse, alle Secrets). `node tools/azure-test.mjs` prüft Azure Speech mit echten Sätzen.

### 3. Cloudflare Worker (in WSL/Terminal im Projektordner)
```bash
npm install
npx wrangler login                 # Browser, „Allow“
npm run deploy                     # baut und lädt hoch (Adresse steht in wrangler.jsonc)
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put AZURE_SPEECH_KEY
npx wrangler secret put AZURE_SPEECH_REGION     # z. B. westeurope
```

### 4. Cloudflare Access (nur du kommst rein)
1. Cloudflare Zero Trust → Access → Applications → **Add an application** → Self-hosted,
   Domain `chinesisch.jan-lab.de`, Policy z. B. „nur Jan“ (E-Mail-Code).
2. In der Anwendung den **Application Audience (AUD) Tag** kopieren; unter Settings den **Team-Domain** ablesen
   (`<team>.cloudflareaccess.com`).
3. ```bash
   npx wrangler secret put ACCESS_AUD
   npx wrangler secret put ACCESS_TEAM_DOMAIN     # z. B. jan-lab.cloudflareaccess.com
   ```

### 5. Handy
`https://chinesisch.jan-lab.de` öffnen, anmelden, Mikrofon erlauben, „Zum Startbildschirm hinzufügen“.
Unter ⚙ müssen beide Häkchen grün sein (Claude auf dem Server, Sprache: Azure).

## Entwicklung
```bash
npm run dev        # http://localhost:5173 – ohne Worker: Claude-Schlüssel unter ⚙, Browser-Sprache als Notbehelf
npm test           # vitest: Pinyin, Gedächtnis/Niveau, Ausspracheprüfung, SSML, Worker-Zugangsprüfung
npm run build      # Typprüfung (App + Worker) und Build nach dist/
npm run deploy     # Build + wrangler deploy
```
Lokal mit Worker: `.dev.vars` mit den Secrets und `ALLOW_WITHOUT_ACCESS=1` anlegen (nicht einchecken), dann
`npm run build && npx wrangler dev`.

## Kosten (grob)
- Claude: ein Gesprächszug mit Opus 5.5 grob 1–2 Cent (Verlauf wird zwischengespeichert), Haiku 5.5 ein Bruchteil davon.
- Azure Speech: Free-Tarif mit Monatskontingent; Wiederholungen derselben Sätze werden im Browser zwischengespeichert.
- Cloudflare Workers und Access: kostenlos im Rahmen der Free-Pläne.

## Code
- `src/ai/` – `prompt.ts` (林老师, Gedächtnis, Niveau), `schema.ts` (Antwortformate), `tutor.ts` (API-Aufruf)
- `src/lib/` – reine Logik: `learner.ts` (Niveau, Fehler, Notizen), `pinyin.ts`, `compare.ts`, `assessment.ts`,
  `review.ts` (Lernkartei), `ssml.ts`, `store.ts` (localStorage), `server.ts`
- `src/speech/` – `azure.ts` (Stimme, Erkennung, Ausspracheprüfung), `index.ts` (Auswahl), Browser-Notbehelf
- `src/ui/` – Stunde, Vokabeln, Einstellungen/Gedächtnis; `worker/` – Cloudflare Worker mit Access-Prüfung
