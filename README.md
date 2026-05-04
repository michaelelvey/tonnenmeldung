# 🗑️ Mülltonnen-Meldung 2.7 Pro

> **Digitales Tonnenmeldesystem für Müllfahrer**  
> Entwickelt für die **Augustin Entsorgung Friesland GmbH & Co. KG**

[![PWA](https://img.shields.io/badge/PWA-ready-brightgreen?style=flat-square&logo=googlechrome)](https://michaelelvey.github.io/tonnenmeldung/)
[![Offline](https://img.shields.io/badge/Offline-fähig-blue?style=flat-square)](https://michaelelvey.github.io/tonnenmeldung/)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-yellow?style=flat-square&logo=javascript)](https://michaelelvey.github.io/tonnenmeldung/)
[![License](https://img.shields.io/badge/Lizenz-privat-lightgrey?style=flat-square)](./LICENSE)

---

## 🌐 Live-App

**[→ https://michaelelvey.github.io/tonnenmeldung/](https://michaelelvey.github.io/tonnenmeldung/)**

Auf dem Smartphone: **„Zum Homescreen hinzufügen"** für die Vollbild-App-Erfahrung.

---

## 📋 Übersicht

Die **Mülltonnen-Meldung** ist eine Progressive Web App (PWA) zur digitalen Erfassung und Weiterleitung von Schadensmeldungen an Mülltonnen während der Leerungsroute. Meldungen werden per E-Mail oder Teilen-Funktion direkt an die Disposition übermittelt.

Alle Daten werden **ausschließlich lokal auf dem Gerät** gespeichert – kein Server, keine Cloud, kein Login erforderlich.

---

## ✨ Funktionen

### 📝 Meldungserfassung
- **10 Schadenskategorien** (Chip defekt, Überfüllt, Fehlbefüllung, Stehen gelassen u. v. m.)
- **4 Müllsorten** (Restmüll, Biomüll, Papiermüll, Gelbersack)
- **3 Aktionstypen** (Geleert, Stehen gelassen, Keine Tonne)
- **3 Kamera-Slots** (Tonne, Zusatz, Barcode)

### 📷 Kamera & Bildverarbeitung
- Automatische Bildkomprimierung auf 1024 px / 60 % JPEG
- **Barcode-Erkennung** via nativer `BarcodeDetector`-API (Chrome/Android, Safari iOS 17+)
- **Tonnennummer-OCR** via Tesseract.js (nur Landkreis Wittmund) – erkennt Muster wie `112.943.2`

### 📍 GPS & Standort
- Automatische GPS-Erfassung beim ersten Foto
- Reverse-Geocoding via **OpenStreetMap Nominatim** (datenschutzkonform, kein API-Key)
- Genauigkeitsanzeige mit Farbkodierung (grün / gelb / rot)
- Google Maps-Link in jeder Meldung

### 📤 Versand
- Nativer **Teilen-Dialog** (WhatsApp, E-Mail, SMS, AirDrop)
- Automatischer Fallback auf **mailto:** bei nicht unterstützten Geräten
- Fotos werden automatisch angehängt
- **Betreffzeile** enthält Kategorie + vollständige Adresse

### 📊 Verlauf & Archivierung
- Vollständige Verlaufsübersicht mit Suche und Kategoriefilter
- Automatische Archivierung nach **31 Tagen**
- Eintrag-Bearbeitung und erneutes Senden aus dem Verlauf

### 📦 ZIP-Export
- Export für: Heute / Laufende Woche / Laufender Monat / Manueller Zeitraum
- Enthält:
  - `Bericht.html` – Vollständiger Bericht mit Fotos, Sortierung & Suche
  - `Meldungen.csv` – Tabelle für Excel/LibreOffice (inkl. GPS-Koordinaten, PLZ, Ort)
  - `images/` – Alle Fotos als JPG-Dateien

### ⚠️ Duplikaterkennung
Prüfung in definierter Reihenfolge:
1. Gleicher **Barcode** → Duplikat
2. Gleiche **Tonnennummer** (OCR) → Duplikat
3. **GPS-Nähe** ≤ 15 m → Duplikat *(nur wenn kein Barcode/Tonnennummer vorhanden)*

> Sammelplätze (mehrere Tonnen am gleichen Standort) erzeugen **keine Fehlalarme**, da Barcode/Tonnennummer als eindeutige Identifier vorrangig geprüft werden.

### ⚙️ Einstellungen & Administration
- **Setup-Link-System**: Disponent erstellt einen Link mit allen Einstellungen → Fahrer öffnet Link → App ist sofort konfiguriert
- Setup-Link ist **passwortgeschützt** (Passwort in `script.js` hinterlegbar)
- **Tagesstart-Check**: Beim ersten Start eines neuen Tages werden Fahrerdaten zur Bestätigung angezeigt
- **Spracheingabe** für Anmerkungen (Web Speech API, de-DE)
- **Hell / Dunkel / System**-Theme
- **Wake Lock**: Bildschirm bleibt während der Nutzung aktiv

---

## 🛠️ Technische Umsetzung

| Komponente | Technologie |
|---|---|
| Framework | Vanilla JavaScript (ES2020+), kein Build-Tool |
| Datenspeicherung | IndexedDB (lokal, kein Server) |
| GPS | Geolocation API + OpenStreetMap Nominatim |
| Barcode | Native `BarcodeDetector` API |
| OCR | Tesseract.js v5 (lokal im Browser) |
| Spracheingabe | Web Speech API (de-DE) |
| ZIP-Export | JSZip 3.x |
| PWA | Web App Manifest + Service Worker |
| Wake Lock | Screen Wake Lock API |
| Schrift | DM Sans (Google Fonts) |

---

## 📁 Projektstruktur

```
tonnenmeldung/
├── index.html       # App-Shell, alle Tabs und Modals
├── script.js        # Gesamte Applikationslogik (~1.200 Zeilen)
├── styles.css       # CSS mit CSS-Variablen, Dark Mode
└── README.md        # Diese Datei
```

---

## 🚀 Installation & Deployment

### GitHub Pages (empfohlen)

1. Repository forken oder klonen
2. Dateien in den `main`-Branch pushen
3. **Settings → Pages → Source: `main` / `root`** aktivieren
4. App ist erreichbar unter `https://<username>.github.io/<repo>/`

### Lokale Entwicklung

```bash
# Einfach im Browser öffnen – kein Build-Prozess nötig
open index.html

# Oder mit einem lokalen Server (empfohlen für GPS/Kamera)
npx serve .
# oder
python3 -m http.server 8080
```

> **Hinweis:** GPS und Kamera erfordern HTTPS oder `localhost`.

---

## ⚙️ Konfiguration

### Admin-Passwort ändern

In `script.js`, Zeile 8:

```js
const ADMIN_PASSWORD = '31512'; // ← hier anpassen
```

### Landkreis-E-Mail-Adressen vorbelegen

In `script.js`, Zeilen 10–13:

```js
const DISTRICT_MAIL_DEFAULTS = {
  'Landkreis Wittmund':      'Abfuhr@lk.wittmund.de',
  'Landkreis Friesland':     '',
  'Landkreis Wilhelmshaven': ''
};
```

### Neue Landkreise hinzufügen

1. `DISTRICT_MAIL_DEFAULTS` um den neuen Landkreis erweitern
2. In `index.html` das `<select id="sDist">` um eine `<option>` ergänzen

---

## 📱 PWA – Zum Homescreen hinzufügen

| Plattform | Anleitung |
|---|---|
| **Android (Chrome)** | Menü (⋮) → „Zum Startbildschirm hinzufügen" |
| **iOS (Safari)** | Teilen-Symbol → „Zum Home-Bildschirm" |
| **Desktop (Chrome)** | Adressleiste → Installieren-Symbol |

---

## 🔒 Datenschutz

- Alle Meldungsdaten verbleiben **ausschließlich lokal** auf dem Gerät (IndexedDB)
- GPS-Koordinaten werden zur Adressauflösung einmalig an **OpenStreetMap Nominatim** gesendet (keine Registrierung, kein API-Key, DSGVO-konform)
- Keine Telemetrie, keine Analytics, keine externen Dienste außer Nominatim und CDN-Bibliotheken (JSZip, Tesseract.js, Google Fonts)
- Fotos werden nur lokal gespeichert und beim Versand direkt an den Empfänger übermittelt

---

## 📋 Browser-Kompatibilität

| Browser | Barcode | OCR | Sprache | GPS | Allgemein |
|---|---|---|---|---|---|
| Chrome Android | ✅ | ✅ | ✅ | ✅ | ✅ |
| Safari iOS 17+ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Chrome Desktop | ✅ | ✅ | ✅ | ✅ | ✅ |
| Firefox | ❌ | ✅ | ❌ | ✅ | ✅ |
| Samsung Internet | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🗂️ Changelog

### Version 2.7 Pro
- Tonnennummer-OCR via Tesseract.js (Landkreis Wittmund)
- Neue Duplikaterkennung (Barcode → Tonnennummer → GPS-Nähe)
- Adressaufteilung in Straße / PLZ / Ort (CSV & Bericht)
- Sortierbare & durchsuchbare Bericht.html
- Setup-Link-System mit Passwortschutz
- Tagesstart-Bestätigungsdialog
- Wake Lock (Bildschirm bleibt aktiv)
- Betreffzeile mit vollständiger Adresse
- Tonnennummer in Dispomeldung

---

## 👤 Autor

**Michael Elvey**  
Entwickelt für Augustin Entsorgung Friesland GmbH & Co. KG

---

*© Michael Elvey · Mülltonnen-Meldung 2.7 Pro · Alle Rechte vorbehalten*
