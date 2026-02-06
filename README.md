# Daily Facts 4U (crazy-daily-app)

Daily Facts 4U ist eine schlanke Single‑Page‑Web‑App für tägliche Mikro‑Wissenshäppchen. Sie kombiniert Feiertage, historische Ereignisse, Fakten, Zitate und Nerd‑Bites in einem auffälligen, mobilen UI und lädt alle Inhalte aus lokalen JSON‑Dateien – ohne Backend, ohne Build‑Pipeline.

**Highlights**
- Single‑Page‑Navigation über Hash‑Routing (`#holiday`, `#facts`, …)
- Inhalte aus lokalen JSON‑Quellen, sofort austauschbar
- Rotierende Fakten und Zitate mit Buttons zum Neuladen
- Tageslogik (Datum/ISO‑Woche) für Feiertage und Ereignisse
- Modale Overlays für MP3‑Download und Link‑Sammlung
- Mobile‑first Layout mit animiertem Menü und weichen Übergängen

**Inhalte & Daten**
- `data/holiday.json` nutzt den Key im Format `DD.MM` für den heutigen Feiertag.
- `data/events.json` enthält Ereignisse pro Datum (`datum: DD.MM`) als Liste.
- `data/facts.json`, `data/favquotes.json`, `data/hackerquotes.json`, `data/need2know.json` liefern die rotierenden Inhalte.
- Quellen und Klammer‑Marker werden beim Rendern bereinigt.

**Technik**
- Reines HTML/CSS/JavaScript (kein Framework, kein Bundler)
- `fetch()` lädt Inhalte on‑demand aus `data/`
- Lokale Persistenz über `localStorage` für Rotationen

**Struktur**
- `index.html`: Grundstruktur, Menü, Footer, Modals
- `css/style.css`: Design‑Tokens, Layout, Animationen, Responsive‑Regeln
- `js/main.js`: Routing, Daten‑Loader, Render‑Logik, UI‑Interaktionen
- `data/`: JSON‑Datensätze für Inhalte
- `assets/`: Logos, Favicons und Medien

**App‑Logik (Kurzfassung)**
- Beim Start wird ein kurzes Intro gezeigt und anschließend der Feiertags‑View geladen.
- Hacker‑Quotes rotieren alle 12 Stunden automatisch.
- Fakten und Need‑to‑Know rotieren per Button und merken sich den Index lokal.
- Favoriten‑Zitate werden über den Tag‑des‑Jahres indexiert.

