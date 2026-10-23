# Roadmap

## Version 0.1
- Gespräch mit Claude zu Themen und Niveaus, Feedback und Tipps auf Deutsch
- Pinyin mit Tonfarben über jedem Zeichen, Pinyin/Zeichen ausblendbar, Hörmodus
- Spracheingabe, Ziffern-Pinyin-Eingabe, Vorlesen, Nachsprechen, Vokabeln mit Leitner-System

## Version 0.2 (aktuell)
- Lehrerin 林老师 mit Gedächtnis: Niveau passt sich an, typische Fehler werden geübt, Persönliches und
  Stunden-Notizen, fällige Vokabeln kommen im Gespräch vor; alles unter ⚙ einsehbar und löschbar
- Stunden mit Beginn und Auswertung, „Nicht verstanden“
- Azure Speech: natürliche Stimme, Erkennung, Ausspracheprüfung
- Cloudflare Worker: Schlüssel auf dem Server, nur mit Cloudflare-Access-Anmeldung

## Version 0.3 (in Arbeit)
- KI kostenlos statt Claude: lokales Qwen (`qwen-local`) auf Jans PC über den Tunnel, sonst Qwen auf
  Cloudflare Workers AI. Lokal getestet (23.10.2026): gültige Antworten, ca. 17–20 s pro Zug.
- 23.10.2026: Worker `chinesisch-lernen` unter chinesisch.jan-lab.de online, Access-App „Chinesisch lernen“
  (Policy „Nur Jan“), Secrets `ACCESS_AUD`/`ACCESS_TEAM_DOMAIN` gesetzt.
- Noch zu tun: Secrets `AZURE_SPEECH_KEY`/`AZURE_SPEECH_REGION`; Tunnel `ollama.jan-lab.de` + Service-Token
  (bis dahin antwortet Qwen auf Workers AI); Workers-AI-Qwen live testen, `tools/einrichten.sh` und
  README-Abschnitte Einrichten/Kosten anpassen.

## Offen / zu prüfen
- **Mit echten Schlüsseln testen:** Erkennung zh-CN, Ausspracheprüfung (bewertet sie Töne?), Stimmen und Tempo.
- **Qualität und Tempo der KI:** Qwen korrigiert schwächer als Claude (z. B. bestätigt falsche Mengen) und hängt
  Satzzeichen an Wörter; Antworten schlanker machen (Schema), ggf. `qwen-schnell` vergleichen.
- **Ton-Rückmeldung:** Liefert Azure für zh-CN Silben/Phoneme mit Ton, zeigen wir sie je Silbe; sonst
  Tonhöhenverlauf selbst messen und mit der Vorlage vergleichen.
- **Gedächtnis geräteübergreifend:** liegt bisher im localStorage des Geräts. Option: Cloudflare KV/D1 im Worker.
- **Hörübungen:** kurze Dialoge nur hören, dann Fragen beantworten; Diktat in Pinyin.
- **Schriftzeichen gezielt lernen** (zweitrangig): Zeichen aus den Vokabeln, Bestandteile, Strichfolge.
- **Pinyin-Prüfung:** Pinyin der KI mit `pinyin-pro` abgleichen und Abweichungen markieren.
