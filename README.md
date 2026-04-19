# 🗑️ Mülltonnen-Meldung V2.1

Eine spezialisierte Progressive Web App (PWA) für Entsorgungsfachkräfte zur schnellen Dokumentation von Problemfällen während der Tour.

## 📋 Funktionsübersicht

- **Offline-First:** Alle Daten werden lokal in einer IndexedDB gespeichert.
- **GPS-Tracking:** Automatische Standorterfassung mit Adress-Rücklösung (Reverse Geocoding).
- **Barcode-Scanner:** Automatische Erkennung von Behälter-Barcodes via Kamera.
- **Foto-Dokumentation:** Komprimierte Fotos (JPEG) zur Beweissicherung.
- **Duplikat-Prüfung:** Warnt den Fahrer, wenn am selben Standort oder für denselben Behälter bereits kürzlich eine Meldung erstellt wurde.
- **Export:** CSV-Export für die Abrechnung oder Weiterverarbeitung in der Disposition.
- **Sonderlogik:** Vereinfachter Workflow für den Fall "in Schüttung gefallen".

## 🛠️ Technische Details

### Stack
- **Sprache:** HTML5, CSS3, JavaScript (Vanilla ES6+).
- **Datenbank:** IndexedDB (Browser-interne Datenbank für hohe Datenmengen und Fotos).
- **APIs:** - `Geolocation API`: Erfassung der Koordinaten.
  - `Web Share API`: Versand der Meldung inkl. Fotos über System-Dialoge (WhatsApp, E-Mail, etc.).
  - `Barcode Detection API`: (Native Browser-Erkennung) zum Auslesen von Barcodes.
  - `Nominatim (OpenStreetMap)`: Umwandlung von Koordinaten in menschlich lesbare Adressen.

### Datenstruktur (Entry-Objekt)
```json
{
  "id": "string",
  "createdAt": "ISO-Date",
  "category": "string",
  "wasteType": "string",
  "actionTaken": "string",
  "photos": [ "DataURL", "DataURL" ],
  "barcode": "string",
  "gps": {
    "lat": 0.0,
    "lng": 0.0,
    "address": "string",
    "accuracy": 0
  },
  "notes": "string",
  "sentCount": 0
}
