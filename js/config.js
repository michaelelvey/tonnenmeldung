const APP_VERSION='2.85 Pro'; // ← HIER Versionsnummer ändern
'use strict';

/* ============================================================
   KONFIGURATION
   ============================================================ */

/* ---------- Admin-Passwort (nur hier ändern) ---------- */
const ADMIN_PASSWORD = '31512';

const DISTRICT_MAIL_DEFAULTS = {
  'Landkreis Wittmund':      '',
  'Landkreis Friesland':     '',
  'Landkreis Wilhelmshaven': ''
};

const CATS = [
  {k:'Chip defekt',i:'💾'},{k:'nicht (korrekt) bereitgestellt',i:'❌'},
  {k:'Überfüllt',i:'📦'},{k:'Fehlbefüllung',i:'⚠️'},
  {k:'in Schüttung gefallen',i:'⬇️'},{k:'beschädigt',i:'🔨'},
  {k:'kein Sack vom LK',i:'🛍️'},{k:'Nachfahrt',i:'🚚'},
  {k:'Schwarze Liste',i:'📝'},{k:'Sonstiges',i:'📌'}
];
const WASTE_TYPES = ['RM','BIO','Papier','LVP'];
const ACTIONS     = ['Geleert','Stehen gelassen','Keine Tonne'];
const NO_PHOTO    = 'in Schüttung gefallen';
const PHOTO_NAMES = ['Foto_Tonne','Foto_Zusatz','Barcode'];
const DUP_M=15, ARC_DAYS=31, IMG_W=1024, IMG_Q=0.6;
const THUMB_W=200, THUMB_Q=0.4; // Thumbnail-Größe für archivierte Einträge

/* ---------- State ---------- */
let entries=[], settings={
  licensePlate:'', district:'Landkreis Wittmund',
  // districtMails: pro Landkreis eine eigene Adresse (in Einstellungen pflegbar)
  districtMails: { ...DISTRICT_MAIL_DEFAULTS },
  email:'Info-WTM@Augustin-Entsorgung.de',
  defaultWasteType:WASTE_TYPES[0], theme:'auto'
};
let cur=null, editId=null, gpsLocked=false, firstPhoto=true, recognition=null, isListening=false, exportPeriod=null;

