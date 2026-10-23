# Roadmap

## Version 0.1 (fertig)
- Gespräch mit Claude zu Themen und Niveaus, Feedback und Tipps auf Deutsch
- Pinyin mit Tonfarben über jedem Zeichen, Pinyin/Zeichen ein- und ausblendbar, Hörmodus
- Spracheingabe, Ziffern-Pinyin-Eingabe, Vorlesen mit Tempo, Nachsprechen mit Silbenvergleich
- Wörter merken, Hörkarten mit Leitner-System

## Als Nächstes (Ideen, Reihenfolge offen)
- **Bessere Stimmen:** Browser-Stimmen schwanken stark. Option: Cloud-Sprachausgabe (z. B. Azure, Google) über einen
  kleinen Worker, damit der Schlüssel nicht im Browser liegt.
- **Echte Ton-Rückmeldung:** Tonhöhenverlauf der eigenen Aufnahme anzeigen und mit der Vorlage vergleichen
  (die Spracherkennung „verbessert“ falsche Töne oft stillschweigend, deshalb ist der Silbenvergleich nur grob).
- **Hörübungen:** kurze Dialoge nur hören, dann Fragen beantworten; Diktat in Pinyin.
- **Schriftzeichen gezielt lernen:** Zeichen aus den gemerkten Wörtern, Bestandteile/Radikale, Strichfolge
  (z. B. mit Hanzi Writer), eigene Kartei.
- **Gesprächsverlauf** mehrerer Gespräche speichern, Fehler-Statistik („häufige Fehler: Zählwörter, 3. Ton“).
- **API-Schlüssel serverseitig** über einen Cloudflare Worker, falls die App mehr Leuten offenstehen soll.
- **Pinyin-Prüfung:** Pinyin der KI mit `pinyin-pro` abgleichen und Abweichungen markieren.
