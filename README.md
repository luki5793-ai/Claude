# German IT Jobs Scraper mit Kontakt-Anreicherung

Production-ready Apify Actor zum Scrapen von IT-Jobs aus mehreren deutschen Job-Portalen mit automatischer Recherche der Kontaktdaten von IT-Leitern und Personalentscheidern.

## 🚀 Features

- **Multi-Portal Support**: Scraping von Google Jobs, StepStone und Indeed gleichzeitig
- **PLZ-Filter**: Geografische Filterung nach Postleitzahlen (z.B. Region Köln/Bonn mit PLZ-Präfix "5")
- **Personalvermittler-Filter**: Automatisches Ausschließen von Personalberatungen, Headhuntern und Zeitarbeitsfirmen
- **Kontakt-Anreicherung**: Automatische Recherche von IT-Leitern und Personalentscheidern
  - Bis zu 2 Kontaktpersonen pro Unternehmen
  - Anrede, Vor- und Nachname
  - E-Mail-Adresse und Telefonnummer
  - Position im Unternehmen
- **Excel/CSV Export**: Übersichtliche Exports mit allen gewünschten Spalten
- **Proxy Support**: Unterstützung für Apify Proxy (Residential und Datacenter)
- **Resilienz**: Automatische Wiederholungsversuche und Checkpoint-System
- **Production-Ready**: TypeScript, umfassende Fehlerbehandlung, strukturiertes Logging

## 📋 Input-Parameter

| Parameter | Typ | Erforderlich | Standard | Beschreibung |
|-----------|-----|--------------|----------|--------------|
| `searchQueries` | Array<string> | ✅ Ja | - | IT-Job Suchbegriffe (z.B. "Software Entwickler", "DevOps Engineer") |
| `locations` | Array<string> | ✅ Ja | - | Deutsche Städte/Regionen (z.B. "Köln", "Bonn", "Remote") |
| `postalCodeFilter` | Array<string> | Nein | ["5"] | PLZ-Präfixe für geografische Filterung |
| `jobPortals` | Array<string> | Nein | ["all"] | Job-Portale: "google", "stepstone", "indeed", oder "all" |
| `maxResults` | number | Nein | 50 | Maximale Ergebnisse pro Portal und Suche (10-500) |
| `includeRemote` | boolean | Nein | true | Remote/Home-Office Positionen einschließen |
| `excludeWords` | Array<string> | Nein | [] | Jobs mit diesen Wörtern im Titel ausschließen |
| `excludeRecruitmentAgencies` | boolean | Nein | true | Personalvermittler automatisch ausschließen |
| `enableContactEnrichment` | boolean | Nein | true | Kontaktdaten-Anreicherung aktivieren |
| `maxContactsPerCompany` | number | Nein | 2 | Maximale Anzahl Kontakte pro Firma (1-5) |
| `requestTimeout` | number | Nein | 30000 | HTTP Request Timeout in Millisekunden |
| `maxRetries` | number | Nein | 3 | Maximale Wiederholungsversuche bei Fehlern |
| `proxyConfiguration` | object | Nein | - | Apify Proxy Konfiguration |
| `minDelayBetweenRequests` | number | Nein | 1000 | Minimale Verzögerung zwischen Requests (ms) |
| `maxDelayBetweenRequests` | number | Nein | 3000 | Maximale Verzögerung zwischen Requests (ms) |

## 📊 Output-Daten

### Excel/CSV Export

Der Actor erstellt automatisch Excel- und CSV-Dateien mit folgenden Spalten:

- **Job-Titel**: Stellenbezeichnung
- **Unternehmen**: Firmenname
- **Standort**: Arbeitsort
- **PLZ**: Postleitzahl
- **Anrede IT-Leiter/Personalentscheider 1**: Herr/Frau
- **Vorname IT-Leiter/Personalentscheider 1**
- **Nachname IT-Leiter/Personalentscheider 1**
- **Email IT-Leiter/Personalentscheider 1**
- **Telefon IT-Leiter/Personalentscheider 1**
- **Position IT-Leiter/Personalentscheider 1**
- **Anrede IT-Leiter/Personalentscheider 2**
- **Vorname IT-Leiter/Personalentscheider 2**
- **Nachname IT-Leiter/Personalentscheider 2**
- **Email IT-Leiter/Personalentscheider 2**
- **Telefon IT-Leiter/Personalentscheider 2**
- **Position IT-Leiter/Personalentscheider 2**
- **Job-URL**: Link zur Stellenanzeige
- **Firmenwebsite**: Website des Unternehmens
- **Quelle**: Portal (Google Jobs, StepStone, Indeed)
- **Arbeitszeit**: Vollzeit, Teilzeit, etc.
- **Erfahrungslevel**: Junior, Mid-Level, Senior
- **Gehalt Min**: Minimales Gehalt (falls verfügbar)
- **Gehalt Max**: Maximales Gehalt (falls verfügbar)
- **Veröffentlicht am**: Datum der Veröffentlichung
- **Gescraped am**: Scraping-Zeitstempel

### JSON Dataset

Jeder Job wird zusätzlich im JSON-Format mit vollständigen Daten im Dataset gespeichert.

## 🔧 Verwendungsbeispiele

### Beispiel 1: Köln/Bonn Region (PLZ 5)

```json
{
  "searchQueries": ["Software Entwickler", "Java Entwickler", "DevOps Engineer"],
  "locations": ["Köln", "Bonn"],
  "postalCodeFilter": ["5"],
  "jobPortals": ["all"],
  "maxResults": 50,
  "excludeRecruitmentAgencies": true,
  "enableContactEnrichment": true,
  "maxContactsPerCompany": 2
}
```

### Beispiel 2: Nur StepStone und Indeed

```json
{
  "searchQueries": ["IT-Sicherheit", "Cybersecurity Engineer"],
  "locations": ["Köln", "Düsseldorf", "Aachen"],
  "postalCodeFilter": ["5"],
  "jobPortals": ["stepstone", "indeed"],
  "maxResults": 100,
  "excludeRecruitmentAgencies": true,
  "enableContactEnrichment": true
}
```

### Beispiel 3: Ohne Kontakt-Anreicherung (schneller)

```json
{
  "searchQueries": ["Full Stack Developer"],
  "locations": ["Köln"],
  "postalCodeFilter": ["50", "51", "53"],
  "jobPortals": ["google"],
  "maxResults": 30,
  "excludeRecruitmentAgencies": true,
  "enableContactEnrichment": false
}
```

### Beispiel 4: Mit Proxy für große Runs

```json
{
  "searchQueries": ["Software Entwickler", "Backend Engineer", "Frontend Developer"],
  "locations": ["Köln", "Bonn", "Aachen", "Düsseldorf"],
  "postalCodeFilter": ["5"],
  "jobPortals": ["all"],
  "maxResults": 100,
  "excludeRecruitmentAgencies": true,
  "enableContactEnrichment": true,
  "maxContactsPerCompany": 2,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  },
  "requestTimeout": 60000,
  "maxRetries": 5
}
```

## 🏃‍♂️ Lokal Ausführen

1. **Repository klonen**:
```bash
git clone <repository-url>
cd german-it-jobs-scraper
```

2. **Dependencies installieren**:
```bash
npm install
```

3. **Input-Datei erstellen** (`.actor/INPUT.json`):
```json
{
  "searchQueries": ["Software Entwickler"],
  "locations": ["Köln"],
  "postalCodeFilter": ["5"],
  "jobPortals": ["all"],
  "maxResults": 20
}
```

4. **Actor ausführen**:
```bash
npm start
```

5. **Development-Modus** (mit Auto-Reload):
```bash
npm run dev
```

## 📦 Auf Apify Platform deployen

1. **Via Apify Console**:
   - Neuen Actor in Apify Console erstellen
   - Alle Dateien in den Source Code Editor kopieren
   - Actor builden und ausführen

2. **Via Apify CLI**:
```bash
# Apify CLI installieren
npm install -g apify-cli

# Bei Apify anmelden
apify login

# Zu Apify pushen
apify push
```

## 📁 Downloads und Exports

Nach erfolgreichem Run finden Sie im Key-Value Store:

- **`jobs_export.xlsx`**: Excel-Datei mit allen Jobs und Kontakten
- **`jobs_export.csv`**: CSV-Datei (Semikolon-getrennt, deutsche Formatierung)
- **`EXPORT_SUMMARY`**: Zusammenfassung der Ergebnisse
- **`FINAL_STATS`**: Detaillierte Scraping-Statistiken
- **`RUN_SUMMARY`**: Ausführliche Auswertung

## 🔍 Kontakt-Anreicherung

Die Kontakt-Anreicherung funktioniert in mehreren Schritten:

1. **Website-Suche**: Automatische Suche nach der Firmenwebsite
2. **Website-Scraping**: Durchsuchen von Impressum, Kontakt und Team-Seiten
3. **Kontaktextraktion**: Identifikation von IT-Leitern und Personalentscheidern
4. **Daten-Validierung**: Überprüfung und Strukturierung der Kontaktdaten

### Hinweis zur Kontakt-Anreicherung

- Die Qualität der Kontaktdaten variiert je nach Verfügbarkeit auf Unternehmenswebsites
- Nicht bei allen Firmen können vollständige Kontakte gefunden werden
- Fehlende Daten werden mit "N/A" markiert
- Bei aktivierter Kontakt-Anreicherung erhöht sich die Laufzeit signifikant
- Respektvolle Rate-Limiting (3 Sekunden zwischen Unternehmensanfragen)

## 🛡️ Personalvermittler-Filter

Der Actor erkennt und filtert automatisch:

- **Keywords**: Personalvermittlung, Personalberatung, Headhunter, Zeitarbeit, etc.
- **Bekannte Agenturen**: Randstad, Adecco, Hays, Manpower, etc.
- **Formulierungen**: "Für unseren Kunden", "Im Auftrag", etc.

Erkannte Personalvermittler werden gekennzeichnet und können automatisch ausgeschlossen werden.

## 📍 PLZ-Filter

Der Actor unterstützt flexible PLZ-Filterung:

- **Region Köln/Bonn**: `["5"]` (alle PLZ mit 5xxxx)
- **Spezifische Städte**: `["50", "53"]` (Köln und Bonn)
- **Mehrere Regionen**: `["5", "4", "6"]`

## 📊 Statistiken und Berichte

Der Actor erstellt detaillierte Berichte:

- Anzahl gefundener und gescrapeter Jobs
- Jobs mit Kontaktdaten vs. ohne
- Verteilung nach Portalen
- Verteilung nach PLZ-Bereichen
- Top-Unternehmen nach Anzahl Jobs
- Durchschnittliche Kontakte pro Job
- Fehler und Warnungen

## ⚙️ Performance-Tipps

- **Proxy-Nutzung**: Für große Runs Apify Residential Proxy verwenden
- **Request-Delays**: Erhöhung auf 3-5s für stabileres Scraping
- **Kontakt-Anreicherung**: Deaktivieren für schnellere Ergebnisse ohne Kontakte
- **Portal-Auswahl**: Einzelne Portale für gezieltere Suchen
- **Batch-Größe**: 50-100 Jobs pro Query für optimale Performance

## 🤝 Best Practices

1. **Klein anfangen**: Mit 1-2 Queries testen
2. **Proxies nutzen**: Immer Proxies für Production-Runs
3. **Logs überwachen**: Auf Warnungen und Fehler achten
4. **Rate Limits**: Angemessene Delays zwischen Requests
5. **Ergebnisse prüfen**: Dataset vor Export überprüfen
6. **Kontakt-Qualität**: Manuell verifizieren bei kritischen Anwendungen

## 📝 Wichtige Hinweise

- Die HTML-Struktur der Job-Portale ändert sich häufig; Selektoren können Updates benötigen
- Einige Job-Daten (Gehalt, Firmengröße) sind nicht immer verfügbar
- Kontaktdaten sind optional und hängen von der Verfügbarkeit ab
- Remote-Positionen sind standardmäßig inkludiert
- Actor ist optimiert für den deutschen Arbeitsmarkt
- Bei PLZ-Filter werden nur Jobs mit erkennbarer PLZ gefiltert

## 🐛 Troubleshooting

**Problem**: Keine Jobs gefunden
- **Lösung**: Suchbegriffe überprüfen, breitere Begriffe versuchen

**Problem**: Viele Fehler/Timeouts
- **Lösung**: `requestTimeout` erhöhen und Residential Proxies nutzen

**Problem**: Keine Kontaktdaten gefunden
- **Lösung**: Normal, viele Firmen veröffentlichen keine Kontakte online

**Problem**: Actor läuft zu langsam
- **Lösung**: Kontakt-Anreicherung deaktivieren oder weniger Portale wählen

**Problem**: Zu viele Personalvermittler
- **Lösung**: `excludeRecruitmentAgencies: true` aktivieren

## 📄 Lizenz

Apache-2.0

## 👥 Support

Für Probleme und Fragen:
1. Actor-Logs auf Fehlermeldungen prüfen
2. Error Reports im Key-Value Store überprüfen
3. Input-Parameter validieren
4. Bei Problemen Apify Support kontaktieren

## 🔄 Version History

- **2.0.0** (2025-01-14): Major Update
  - Multi-Portal Support (Google Jobs, StepStone, Indeed)
  - Kontakt-Anreicherung für IT-Leiter und Personalentscheider
  - PLZ-Filterung
  - Personalvermittler-Filter
  - Excel/CSV Export
  - Verbesserte Fehlerbehandlung

- **1.0.0** (2025-01-11): Initial Release
  - Google Jobs Scraping
  - Multi-Query Support
  - Checkpoint System

---

**Viel Erfolg beim Scrapen! 🎉**
