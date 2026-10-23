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

## Offen / zu prüfen
- **Mit echten Schlüsseln testen** (bisher nur mit simulierten Antworten): Erkennung zh-CN, Ausspracheprüfung
  (bewertet sie Töne?), Stimmen und Tempo, Kosten je Stunde.
- **Ton-Rückmeldung:** Liefert Azure für zh-CN Silben/Phoneme mit Ton, zeigen wir sie je Silbe; sonst
  Tonhöhenverlauf selbst messen und mit der Vorlage vergleichen.
- **Gedächtnis geräteübergreifend:** liegt bisher im localStorage des Geräts. Option: Cloudflare KV/D1 im Worker.
- **Hörübungen:** kurze Dialoge nur hören, dann Fragen beantworten; Diktat in Pinyin.
- **Schriftzeichen gezielt lernen** (zweitrangig): Zeichen aus den Vokabeln, Bestandteile, Strichfolge.
- **Pinyin-Prüfung:** Pinyin der KI mit `pinyin-pro` abgleichen und Abweichungen markieren.
