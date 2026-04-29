🗑️ Mülltonnen-Meldung Pro
Eine professionelle Progressive Web App (PWA) zur digitalen Erfassung und Meldung von Unregelmäßigkeiten bei der Müllabfuhr. Die Anwendung ermöglicht es Fahrern, Mängel (z.B. beschädigte Tonnen, Fehlbefüllungen oder nicht bereitgestellte Behälter) schnell, präzise und mit GPS-Koordinaten sowie Fotos zu dokumentieren.

🚀 Features
📍 Automatische GPS-Erfassung: Präzise Standortbestimmung inklusive Reverse-Geocoding (Adressumwandlung).
📷 Foto-Dokumentation: Schnelle Aufnahme von Tonnen- und Detailfotos sowie Barcode-Erkennung.
🎙️ Spracheingabe: Komfortable Anmerkungen per Diktierfunktion.
💾 Lokale Datenbank: Alle Daten werden sicher im Browser (IndexedDB) gespeichert.
📧 Flexibler Versand: Meldungen können via Web-Share-API oder per E-Mail an die Disposition und den Landkreis gesendet werden.
📊 Export-Funktion: Kompletter Verlauf als CSV-Datei für die Abrechnung oder Dokumentation exportierbar.
🔌 Offline-fähig: Dank Service Worker funktioniert die App auch in Gebieten mit schlechtem Empfang.
🛠️ Installation
Die Dateien index.html und sw.js auf einen HTTPS-fähigen Webserver hochladen.
Die URL im Browser des Smartphones öffnen.
Wichtig: Über das Browser-Menü die Option "Zum Home-Bildschirm hinzufügen" wählen, um die App als PWA zu installieren. Dadurch wird der Vollbildmodus aktiviert und die Offline-Funktionalität optimiert.
❓ Hilfe & Bedienungsanleitung
Willkommen bei der Mülltonnen-Meldung Pro. Diese Anleitung führt Sie Schritt für Schritt durch die Nutzung der App.

⚠️ WICHTIG: Erstmalige Einrichtung
Bevor Sie die erste Meldung erstellen, MÜSSEN zwingend die persönlichen Daten hinterlegt werden. Andernfalls können die Meldungen nicht korrekt zugeordnet werden.

Klicken Sie oben im Menü auf den Reiter ⚙️ Einstellungen.
Füllen Sie alle Felder vollständig aus:
Fahrername: Ihr vollständiger Name.
Fahrzeugkennzeichen: Das Kennzeichen Ihres Fahrzeugs.
Landkreis / Gebiet: Wählen Sie den zuständigen Landkreis aus.
Standard Müllsorte: Legen Sie fest, welche Müllart Sie primär befördern.
E-Mail Dispo (CC): Geben Sie die E-Mail-Adresse Ihrer Disposition ein.
Klicken Sie auf 💾 Einstellungen speichern.
📋 Eine Meldung erstellen (Reiter "Meldung")
Um eine Störung zu melden, gehen Sie bitte wie folgt vor:

Kategorie wählen: Tippen Sie auf die entsprechende Kachel (z.B. "Chip defekt" oder "Überfüllt").
Details ergänzen:
Wählen Sie die Müllart (z.B. Restmüll).
Wählen Sie die Aktion (z.B. "Geleert" oder "Stehen gelassen").
Hinweis: Bei der Kategorie "in Schüttung gefallen" entfallen Foto und Aktion automatisch.
Fotos aufnehmen:
Tippen Sie auf die Kamera-Symbole, um ein Foto der Tonne, ein Zusatzfoto oder den Barcode aufzunehmen.
Der Barcode wird bei unterstützten Geräten automatisch erkannt.
Standort prüfen: Die App erfasst den Standort automatisch. Falls dies nicht geschieht, klicken Sie auf den Button "Jetzt" im GPS-Bereich.
Anmerkungen: Nutzen Sie das Textfeld für zusätzliche Infos. Tipp: Klicken Sie auf das Mikrofon-Symbol 🎤, um die Anmerkung einzusprechen.
Senden: Klicken Sie auf 📤 Meldung senden. Sie können nun wählen, ob die Meldung per E-Mail oder über die Teilen-Funktion Ihres Handys versendet werden soll.
🕐 Verlauf und Verwaltung (Reiter "Verlauf")
Im Verlauf finden Sie alle Ihre bisherigen Meldungen:

Ansicht: Klicken Sie auf einen Eintrag, um die Details und Fotos einzusehen.
Bearbeiten: Über den Button ✏️ Bearbeiten können Sie die Kategorie oder den Text nachträglich ändern.
Erneut senden: Falls eine Meldung nicht erfolgreich versendet wurde, nutzen Sie den Button 📤 Senden.
Löschen: Einträge können über den roten Papierkorb dauerhaft entfernt werden.
CSV-Export: Über den Button 📊 CSV-Export können Sie einen Zeitraum wählen und alle Daten als Tabelle herunterladen (ideal für die Büro-Übergabe).
⚙️ Zusätzliche Einstellungen
Erscheinungsbild: Unter Einstellungen können Sie zwischen "Hell", "Dunkel" oder "System (Automatisch)" wählen, um die App optimal an Ihre Lichtverhältnisse anzupassen.
Archivierung: Die App archiviert Einträge automatisch nach 31 Tagen, um die Performance zu erhalten. Archivierte Einträge bleiben jedoch in der Datenbank und im Export sichtbar.
Entwickelt von: Michael Elvey
Version: 2.5 Pro
