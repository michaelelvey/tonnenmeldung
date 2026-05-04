'use strict';

/* ---------- Konfiguration ---------- */
// Landkreis-Mailadressen werden jetzt in den Einstellungen gepflegt.
// Diese Defaults gelten nur beim allerersten App-Start.
const DISTRICT_MAIL_DEFAULTS = {
  'Landkreis Wittmund':      'Abfuhr@lk.wittmund.de',
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
const WASTE_TYPES = ['Restmüll (RM)','Biomüll (BIO)','Papiermüll (Papier)','Gelbersack'];
const ACTIONS     = ['Geleert','Stehen gelassen','Keine Tonne'];
const NO_PHOTO    = 'in Schüttung gefallen';
const PHOTO_NAMES = ['Foto_Tonne','Foto_Zusatz','Barcode'];
const DUP_M=15, ARC_DAYS=31, IMG_W=1024, IMG_Q=0.6;

/* ---------- State ---------- */
let entries=[], settings={
  driverName:'', licensePlate:'', district:'Landkreis Wittmund',
  // districtMails: pro Landkreis eine eigene Adresse (in Einstellungen pflegbar)
  districtMails: { ...DISTRICT_MAIL_DEFAULTS },
  email:'Info-WTM@Augustin-Entsorgung.de',
  defaultWasteType:WASTE_TYPES[0], theme:'auto'
};
let cur=null, editId=null, gpsLocked=false, firstPhoto=true, recognition=null, exportPeriod=null;

/* ============================================================
   UTILITY
   ============================================================ */

function vibe(ms=50){if(navigator.vibrate)navigator.vibrate(ms)}
function fmtDT(iso){
  if(!iso)return'–';
  const d=new Date(iso);
  return d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})
        +' '+d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
}
function fmtD(iso){return iso?new Date(iso).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}):'–'}
function fmtISO(d){return new Date(d).toISOString().split('T')[0]}

let toastTimer;
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg;el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);
}

function fullscreen(img){
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:#000;display:flex;align-items:center;justify-content:center;z-index:300;cursor:zoom-out';
  const im=document.createElement('img');im.src=img.src;
  im.style.cssText='max-width:100%;max-height:100%;object-fit:contain';
  ov.appendChild(im);ov.onclick=()=>document.body.removeChild(ov);
  document.body.appendChild(ov);
}

/** Liefert die E-Mail-Adresse für den aktuell gespeicherten Landkreis. */
function getDistrictEmail(district){
  return (settings.districtMails||{})[district||settings.district]||'';
}

/* ============================================================
   PHOTO HELPERS
   ============================================================ */

function compressToDataUrl(file){
  return new Promise((res,rej)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement('canvas');
        let w=img.width,h=img.height;
        if(w>IMG_W){h=Math.round(h*IMG_W/w);w=IMG_W}
        canvas.width=w;canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        res(canvas.toDataURL('image/jpeg',IMG_Q));
      };
      img.onerror=rej;img.src=e.target.result;
    };
    reader.onerror=rej;reader.readAsDataURL(file);
  });
}

function compressToBlob(file){
  return new Promise((res,rej)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const c=document.createElement('canvas');
        let w=img.width,h=img.height;
        if(w>IMG_W){h=Math.round(h*IMG_W/w);w=IMG_W}
        c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
        c.toBlob(blob=>blob?res(blob):rej(new Error('Blob-Fehler')),'image/jpeg',IMG_Q);
      };
      img.onerror=rej;img.src=e.target.result;
    };
    reader.onerror=rej;reader.readAsDataURL(file);
  });
}

async function photoToBase64(photo){
  if(!photo)return null;
  if(typeof photo==='string'&&photo.startsWith('data:'))return photo.split(',')[1];
  if(photo instanceof Blob&&photo.size>0){
    return new Promise(res=>{
      const fr=new FileReader();
      fr.onload=e=>res(e.target.result.split(',')[1]);
      fr.readAsDataURL(photo);
    });
  }
  return null;
}

function photoToDisplayUrl(photo){
  if(!photo)return null;
  if(typeof photo==='string')return photo;
  if(photo instanceof Blob)return URL.createObjectURL(photo);
  return null;
}

/* ============================================================
   INDEXEDDB
   ============================================================ */

const DB_NAME='MuelltonnenDB', DB_VERSION=1;

async function openDB(){
  return new Promise((res,rej)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains('entries')) db.createObjectStore('entries',{keyPath:'id'});
      if(!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    };
    req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);
  });
}
async function dbPut(store,data,key=null){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(store,'readwrite'),s=tx.objectStore(store);
    const r=key?s.put(data,key):s.put(data);
    r.onsuccess=()=>res();r.onerror=()=>rej(r.error);
  });
}
async function dbGet(store,key){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(store,'readonly'),s=tx.objectStore(store),r=s.get(key);
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
  });
}
async function dbGetAll(store){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(store,'readonly'),s=tx.objectStore(store),r=s.getAll();
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
  });
}
async function dbDelete(store,key){
  const db=await openDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(store,'readwrite'),s=tx.objectStore(store),r=s.delete(key);
    r.onsuccess=()=>res();r.onerror=()=>rej(r.error);
  });
}

/* ============================================================
   INIT
   ============================================================ */

async function loadData(){
  try{
    entries=await dbGetAll('entries');
    const s=await dbGet('settings','config');
    if(s){
      settings={...settings,...s};
      // Sicherstellen, dass districtMails immer alle Landkreise enthält
      settings.districtMails={...DISTRICT_MAIL_DEFAULTS,...(s.districtMails||{})};
    }
    applyTheme(settings.theme||'auto');
    const now=Date.now(),archMs=ARC_DAYS*86400000;
    let upd=false;
    for(const e of entries){
      if(!e.archived&&(now-new Date(e.createdAt).getTime()>archMs)){
        e.archived=true;await dbPut('entries',e);upd=true;
      }
    }
    if(upd)entries=await dbGetAll('entries');
  }catch(e){console.error('DB Error',e)}
}

function newEntry(){
  cur={
    id:Date.now().toString(36)+Math.random().toString(36).slice(2),
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    category:'',wasteType:settings.defaultWasteType,actionTaken:'Geleert',
    photos:[null,null,null],barcode:null,gps:null,notes:'',
    driverName:settings.driverName,licensePlate:settings.licensePlate,
    district:settings.district,archived:false,sentCount:0
  };
}

async function init(){
  await loadData();
  checkSetupLink();
  initPWA();buildUI();newEntry();await loadSettingsUI();
  initWakeLock();
  if(!('BarcodeDetector' in window)){
    const s2=document.getElementById('slot2');
    s2.style.opacity='0.5';s2.style.pointerEvents='none';
    s2.querySelector('.psub').textContent='Nicht unterstützt';
  }
  const wSel=document.getElementById('wasteSelect'),aSel=document.getElementById('actionSelect');
  wSel.value=settings.defaultWasteType;aSel.value='Geleert';
  highlightSelect(wSel);highlightSelect(aSel);
}

/* ============================================================
   WAKE LOCK
   ============================================================ */

let wakeLock=null;
async function initWakeLock(){
  if(!('wakeLock' in navigator))return;
  const acquire=async()=>{try{wakeLock=await navigator.wakeLock.request('screen')}catch{}};
  await acquire();
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')acquire()});
}

function initPWA(){
  const m={name:'Mülltonnen-Meldung',short_name:'Mülltonnen',start_url:location.href,
    display:'standalone',theme_color:'#1a5c1a',background_color:'#f0f2f0',
    icons:[{src:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🗑️</text></svg>',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]};
  try{
    const mb=new Blob([JSON.stringify(m)],{type:'application/json'});
    document.getElementById('pwaManifest').href=URL.createObjectURL(mb);
    if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  }catch{}
}

/* ============================================================
   THEME
   ============================================================ */

function applyTheme(t){
  document.documentElement.classList.toggle('dark',
    t==='dark'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches));
}

/* ============================================================
   SETTINGS — inkl. dynamisches Landkreis-Mail-Feld
   ============================================================ */

/**
 * Wird aufgerufen wenn der Landkreis-Dropdown sich ändert.
 * Zeigt die gespeicherte E-Mail für diesen Landkreis an
 * (oder leeres Feld wenn noch nicht gespeichert).
 */
function updateDistMailField(){
  const dist=document.getElementById('sDist').value;
  const mail=(settings.districtMails||{})[dist]||'';
  document.getElementById('sDistMail').value=mail;
  document.getElementById('distMailLabel').textContent=`📧 E-Mail ${dist}`;
}

async function loadSettingsUI(){
  document.getElementById('sName').value=settings.driverName||'';
  document.getElementById('sPlate').value=settings.licensePlate||'';
  document.getElementById('sDist').value=settings.district||'Landkreis Wittmund';
  document.getElementById('sEmail').value=settings.email||'';
  document.getElementById('sWaste').value=settings.defaultWasteType||WASTE_TYPES[0];
  document.getElementById('sTheme').value=settings.theme||'auto';
  // Landkreis-Mail-Feld initialisieren
  updateDistMailField();

  const all=await dbGetAll('entries');
  document.getElementById('stActive').textContent=all.filter(e=>!e.archived).length;
  document.getElementById('stArchived').textContent=all.filter(e=>e.archived).length;
  document.getElementById('stTotal').textContent=all.length;
}

async function saveSettings(){
  vibe(50);
  settings.driverName=document.getElementById('sName').value.trim();
  settings.licensePlate=document.getElementById('sPlate').value.trim();
  settings.district=document.getElementById('sDist').value;
  settings.email=document.getElementById('sEmail').value.trim();
  settings.defaultWasteType=document.getElementById('sWaste').value;
  settings.theme=document.getElementById('sTheme').value;

  // E-Mail für den aktuell gewählten Landkreis speichern
  if(!settings.districtMails)settings.districtMails={...DISTRICT_MAIL_DEFAULTS};
  settings.districtMails[settings.district]=document.getElementById('sDistMail').value.trim();

  applyTheme(settings.theme);
  await dbPut('settings',settings,'config');
  toast('✅ Gespeichert');
  setTimeout(()=>showTab('m'),600);
}

/* ============================================================
   UI BUILD / TABS
   ============================================================ */

function buildUI(){
  document.getElementById('catGrid').innerHTML=
    CATS.map(c=>`<button class="cbtn" data-k="${c.k}" onclick="selCat('${c.k.replace(/'/g,"\\'")}')"><span class="ci">${c.i}</span>${c.k}</button>`).join('');
  document.getElementById('wasteSelect').innerHTML=WASTE_TYPES.map(w=>`<option value="${w}">${w}</option>`).join('');
  document.getElementById('actionSelect').innerHTML=ACTIONS.map(a=>`<option value="${a}">${a}</option>`).join('');
  const sc=document.getElementById('scat'),ec=document.getElementById('edCat');
  CATS.forEach(c=>{
    [sc,ec].forEach(el=>{const o=document.createElement('option');o.value=c.k;o.textContent=c.k;el.appendChild(o)});
  });
}

function showTab(name){
  vibe(20);
  document.querySelectorAll('.tb').forEach(b=>b.classList.remove('on'));
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('on'));
  document.getElementById('tb-'+name).classList.add('on');
  document.getElementById('pane-'+name).classList.add('on');
  if(name==='v'){renderHistory();loadSettingsUI()}
  if(name==='e')loadSettingsUI();
}

/* ============================================================
   GPS
   ============================================================ */

async function captureGPS(manual=false){
  if(!navigator.geolocation){setGPS(null,'GPS nicht verfügbar');return}
  setGPS(null,'📡 Standort wird ermittelt…');
  document.getElementById('gpsBtn').disabled=true;
  navigator.geolocation.getCurrentPosition(
    async pos=>{
      const{latitude:lat,longitude:lng,accuracy:acc}=pos.coords;
      const geo=await revGeo(lat,lng);
      cur.gps={lat,lng,accuracy:Math.round(acc),...geo};
      gpsLocked=true;setGPS(cur.gps);
      document.getElementById('gpsBtn').disabled=false;
      if(!manual)checkDups();
    },
    err=>{setGPS(null,'⚠️ GPS-Fehler: '+err.message);document.getElementById('gpsBtn').disabled=false},
    {enableHighAccuracy:true,timeout:15000,maximumAge:0}
  );
}

async function revGeo(lat,lng){
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,{headers:{'Accept-Language':'de'}});
    const d=await r.json(),a=d.address||{};
    const road=a.road||a.pedestrian||a.path||a.street||'Unbekannte Straße';
    const hn=a.house_number||'';
    const plz=a.postcode||'';
    const ort=a.city||a.town||a.village||a.suburb||a.municipality||'';
    const street=hn?`${road} in Höhe der Hausnr. ${hn}`:`${road}`;
    const address=ort?`${street} in ${ort}`:street;
    return{street,plz,ort,address};
  }catch{
    const address=`${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    return{street:address,plz:'',ort:'',address};
  }
}

function setGPS(gps,txt){
  const tico=document.getElementById('gpsIco'),ttxt=document.getElementById('gpsTxt'),tsub=document.getElementById('gpsSub');
  if(gps){
    tico.textContent='✅';
    ttxt.style.color=gps.accuracy>50?'var(--r)':gps.accuracy>20?'var(--o)':'var(--g)';
    ttxt.textContent=gps.address||`${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`;
    tsub.textContent=`±${gps.accuracy}m | ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`;
  }else{
    tico.textContent='📡';ttxt.style.color='var(--text)';
    ttxt.textContent=txt||'Wird automatisch erfasst';tsub.textContent='';
  }
}

/* ============================================================
   PHOTOS
   ============================================================ */

function triggerPhoto(slot){vibe(20);document.getElementById('fi'+slot).click()}

async function handlePhoto(slot){
  const input=document.getElementById('fi'+slot),file=input.files[0];
  if(!file)return;
  if(file.size>15*1024*1024){toast('⚠️ Foto zu groß (>15MB)');return}
  try{
    const dataUrl=await compressToDataUrl(file);
    cur.photos[slot]=dataUrl;setSlot(slot,dataUrl);input.value='';
    if(firstPhoto&&!gpsLocked){firstPhoto=false;captureGPS(false)}
    if(slot===2&&!cur.barcode){const blob=await compressToBlob(file);await tryBarcode(blob)}
    checkDups();
  }catch(err){toast('Foto-Fehler: '+err.message)}
}

function setSlot(slot,src){
  const el=document.getElementById('slot'+slot),lbl=PHOTO_NAMES[slot].replace('_',' ');
  el.innerHTML=`<img src="${src}" onclick="event.stopPropagation();fullscreen(this)"><div class="plabel">${lbl}</div><button class="pdel" onclick="event.stopPropagation();delPhoto(${slot})">✕</button>`;
  el.classList.add('hp');el.onclick=()=>fullscreen(el.querySelector('img'));
}

function delPhoto(slot){
  vibe(30);cur.photos[slot]=null;
  const el=document.getElementById('slot'+slot);
  el.innerHTML=`<span class="pico">${slot===2?'🔍':'📷'}</span><span class="psub">${PHOTO_NAMES[slot].replace('_',' ')}</span>`;
  el.classList.remove('hp');el.onclick=()=>triggerPhoto(slot);
  if(slot===2)clearBarcode();
}

/* ============================================================
   BARCODE
   ============================================================ */

async function tryBarcode(blob){
  if(!window.BarcodeDetector)return;
  try{
    const det=new BarcodeDetector(),bmp=await createImageBitmap(blob),codes=await det.detect(bmp);
    bmp.close();
    if(codes&&codes.length>0){
      cur.barcode=codes[0].rawValue;
      document.getElementById('bcBox').classList.remove('hidden');
      document.getElementById('bcVal').textContent=cur.barcode;
      vibe([50,30,50]);toast('📊 Barcode erkannt: '+cur.barcode);captureGPS(false);
    }
  }catch(e){console.error('Barcode-Error:',e)}
}

function clearBarcode(){cur.barcode=null;document.getElementById('bcBox').classList.add('hidden')}

/* ============================================================
   DUPLICATES
   ============================================================ */

function haversine(a,b,c,d){
  const R=6371000,dl=(c-a)*Math.PI/180,dk=(d-b)*Math.PI/180;
  const x=Math.sin(dl/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dk/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function findDups(entry){
  const seen=new Set(),res=[];
  entries.forEach(e=>{
    if(e.id===entry.id||seen.has(e.id))return;
    let dup=false;
    if(entry.barcode&&e.barcode&&entry.barcode===e.barcode)dup=true;
    if(!dup&&entry.gps&&e.gps&&haversine(entry.gps.lat,entry.gps.lng,e.gps.lat,e.gps.lng)<=DUP_M)dup=true;
    if(dup){seen.add(e.id);res.push(e)}
  });
  return res.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
}

function checkDups(){
  if(!cur)return;
  const dups=findDups(cur),w=document.getElementById('dupWarn'),l=document.getElementById('dupList');
  if(dups.length>0){
    w.classList.remove('hidden');
    l.innerHTML=dups.map(d=>`<div style="padding:4px;font-size:11px;border-bottom:1px solid var(--gray2)">📅 ${fmtDT(d.createdAt)} · ${d.category} ${d.archived?'(Archiv)':''}</div>`).join('');
  }else{w.classList.add('hidden')}
}

/* ============================================================
   FORM
   ============================================================ */

function selCat(cat){
  vibe(20);cur.category=cat;
  document.querySelectorAll('#catGrid .cbtn').forEach(b=>b.classList.toggle('sel',b.dataset.k===cat));
  const isSch=(cat===NO_PHOTO);
  document.getElementById('schInfo').classList.toggle('hidden',!isSch);
  document.getElementById('photoCard').classList.toggle('hidden',isSch);
  document.getElementById('actionField').style.visibility=isSch?'hidden':'visible';
  if(isSch)cur.actionTaken='';
  checkDups();
}
function updateWaste(val){vibe(20);cur.wasteType=val}
function updateAction(val){vibe(20);cur.actionTaken=val}
function highlightSelect(s){s.classList.toggle('has-value',!!s.value)}

function resetForm(){
  newEntry();gpsLocked=false;firstPhoto=true;
  document.querySelectorAll('.catgrid .cbtn').forEach(b=>b.classList.remove('sel'));
  const wSel=document.getElementById('wasteSelect'),aSel=document.getElementById('actionSelect');
  wSel.value=settings.defaultWasteType;aSel.value='Geleert';
  cur.wasteType=settings.defaultWasteType;cur.actionTaken='Geleert';
  highlightSelect(wSel);highlightSelect(aSel);
  for(let i=0;i<3;i++)delPhoto(i);
  setGPS(null);clearBarcode();
  document.getElementById('notesIn').value='';
  document.getElementById('schInfo').classList.add('hidden');
  document.getElementById('photoCard').classList.remove('hidden');
  document.getElementById('actionField').style.visibility='visible';
  document.getElementById('dupWarn').classList.add('hidden');
}

/* ============================================================
   SEND / EMAIL
   ============================================================ */

function buildSubj(e){return`Mülltonnen-Meldung | ${e.category} | ${fmtD(e.createdAt)}`}

function buildBody(e,dups=[]){
  const ln=[
    `Datum: ${fmtDT(e.createdAt)}`,'',
    `Firma: Augustin Entsorgung Friesland GmbH & Co. KG`,
    `Fahrer: ${e.driverName||'-'}`,`Fahrzeug: ${e.licensePlate||'-'}`,`Landkreis: ${e.district||'-'}`,'',
    `Barcode: ${e.barcode||'-'}`,
    `Müllart: ${e.wasteType||'-'}`,`Kategorie: ${e.category}`,`Aktion: ${e.actionTaken||'-'}`,
    `Standort: ${e.gps?.address||'-'}`,
    `GPS: ${e.gps?`${e.gps.lat.toFixed(6)}, ${e.gps.lng.toFixed(6)}`:'-'}`,
    `Karte: ${e.gps?`https://www.google.com/maps?q=${e.gps.lat},${e.gps.lng}`:'-'}`,'',
  ];
  if(dups.length>0){ln.push('⚠️ DUPLIKATE:');dups.forEach((d,i)=>ln.push(`${i+1}. ${fmtDT(d.createdAt)} | ${d.category} | ${d.actionTaken||'–'}`))}
  else{ln.push('Keine Duplikate gefunden.')}
  ln.push('','---','© Michael Elvey');
  return ln.join('\n');
}

async function sendEntry(){
  const reqA=cur.category!==NO_PHOTO;
  if(!cur.category||(reqA&&!cur.actionTaken)){vibe(100);toast('⚠️ Bitte Kategorie und Aktion auswählen!');return}
  const btn=document.getElementById('sendBtn');btn.disabled=true;
  if(!cur.gps){
    btn.innerHTML='GPS wird erfasst…';
    await new Promise(res=>{
      navigator.geolocation.getCurrentPosition(
        async pos=>{const{latitude:lat,longitude:lng,accuracy:acc}=pos.coords;const geo=await revGeo(lat,lng);cur.gps={lat,lng,accuracy:Math.round(acc),...geo};setGPS(cur.gps);res()},
        ()=>res(),{enableHighAccuracy:true,timeout:20000,maximumAge:0}
      );
    });
  }
  btn.innerHTML='Wird vorbereitet…';
  cur.notes=document.getElementById('notesIn').value.trim();cur.updatedAt=new Date().toISOString();
  const dups=findDups(cur),subj=buildSubj(cur),body=buildBody(cur,dups);
  const photoFiles=await dataUrlsToFiles(cur.photos.filter(Boolean),cur.id);
  let sent=false;
  if(navigator.share){
    try{
      let sd={title:subj,text:body};
      if(photoFiles.length>0&&navigator.canShare&&navigator.canShare({files:photoFiles}))sd.files=photoFiles;
      await navigator.share(sd);sent=true;
    }catch(err){if(err.name!=='AbortError'){}}
  }
  if(!sent){
    // E-Mail-Adresse aus den Einstellungen lesen (nicht mehr hardcoded)
    const districtEmail=getDistrictEmail(cur.district);
    const dispoEmail=settings.email||'';
    let rec=districtEmail?`mailto:${districtEmail}?cc=${dispoEmail}`:`mailto:${dispoEmail}`;
    const sep=rec.includes('?')?'&':'?';
    if(photoFiles.length>0)toast('ℹ️ Fotos bitte manuell anhängen.');
    window.open(`${rec}${sep}subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`,'_blank');
    sent=true;
  }
  cur.sentCount++;await dbPut('entries',{...cur});entries.unshift({...cur});vibe([0,50,50]);
  toast('✅ Meldung versendet!');
  setTimeout(()=>{resetForm();showTab('m');btn.innerHTML='📤 Meldung senden';btn.disabled=false;document.getElementById('wrap').scrollTo({top:0})},800);
}

async function dataUrlsToFiles(dataUrls,id){
  return dataUrls.filter(Boolean).map((du,i)=>{
    if(typeof du==='string'&&du.startsWith('data:')){
      const[header,b64]=du.split(','),mime=header.match(/:(.*?);/)[1];
      const bin=atob(b64),arr=new Uint8Array(bin.length);
      for(let j=0;j<bin.length;j++)arr[j]=bin.charCodeAt(j);
      return new File([arr],`Muell_${id}_${i+1}.jpg`,{type:'image/jpeg'});
    }
    if(du instanceof Blob)return new File([du],`Muell_${id}_${i+1}.jpg`,{type:'image/jpeg'});
    return null;
  }).filter(Boolean);
}

/* ============================================================
   VOICE
   ============================================================ */

function toggleVoice(){
  if(!('webkitSpeechRecognition' in window)&&!('SpeechRecognition' in window)){toast('❌ Spracheingabe nicht unterstützt');return}
  if(recognition&&recognition.state==='recording'){recognition.stop();return}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  recognition=new SR();recognition.lang='de-DE';
  recognition.onstart=()=>{vibe(100);document.getElementById('voiceBtn').classList.add('listening');toast('🎤 Ich höre zu...')};
  recognition.onresult=e=>{const t=e.results[0][0].transcript,a=document.getElementById('notesIn');a.value+=(a.value?' ':'')+t;vibe(50)};
  recognition.onend=()=>document.getElementById('voiceBtn').classList.remove('listening');
  recognition.start();
}

/* ============================================================
   HISTORY
   ============================================================ */

async function renderHistory(){
  const txt=(document.getElementById('stxt').value||'').toLowerCase(),cat=document.getElementById('scat').value;
  entries=await dbGetAll('entries');
  let filtered=entries.filter(e=>{
    if(cat&&e.category!==cat)return false;
    if(txt){const s=[e.category,e.wasteType,e.actionTaken,e.driverName,e.licensePlate,e.district,e.gps?.address,e.barcode,e.notes].join(' ').toLowerCase();if(!s.includes(txt))return false}
    return true;
  });
  filtered.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const list=document.getElementById('histList');
  if(!filtered.length){list.innerHTML=`<div style="text-align:center;padding:40px;color:var(--gray4)">📭 Keine Einträge gefunden</div>`;return}
  list.innerHTML=filtered.map(e=>renderHE(e)).join('');
}

function renderHE(e){
  const cat=CATS.find(c=>c.k===e.category)||{i:'🗑️'};
  const photos=(e.photos||[]).filter(Boolean);
  const stehenClass=e.actionTaken==='Stehen gelassen'?'stehen-gelassen':'';
  const photoHtml=photos.length
    ?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">${
        photos.map(p=>{const url=photoToDisplayUrl(p);return url?`<img src="${url}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;cursor:pointer" onclick="fullscreen(this)">`:''}).join('')
      }</div>`:''
  return`<div class="hentry ${stehenClass}" style="background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:10px;overflow:hidden">
    <div onclick="toggleHE('${e.id}')" style="padding:13px 14px;display:flex;align-items:flex-start;gap:10px;cursor:pointer">
      <span>${cat.i}</span>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700;color:var(--g)">${e.category} <span style="font-weight:400;color:var(--gray);font-size:12px">(${e.wasteType||'–'})</span></div>
        <div style="font-size:11.5px;color:var(--gray4);margin-top:2px">${fmtDT(e.createdAt)} · ${e.driverName||'–'}</div>
        ${e.actionTaken==='Stehen gelassen'?'<div style="font-size:10px;color:var(--r);font-weight:700;margin-top:2px">⚠️ STEHEN GELASSEN</div>':''}
      </div>
      ${e.archived?'<span style="font-size:10px;background:var(--yl);color:var(--y);padding:3px 7px;border-radius:9px">Archiv</span>':''}
      <span class="hchev" id="chev-${e.id}" style="color:var(--gray4);font-size:14px">▼</span>
    </div>
    <div class="hbody" id="hb-${e.id}" style="display:none;padding:12px 14px 15px;border-top:1px solid var(--gray3)">
      ${photoHtml}
      <div style="font-size:12.5px;margin-bottom:4px;display:flex;gap:6px"><span style="color:var(--gray4);min-width:80px">Aktion:</span><strong style="color:var(--g)">${e.actionTaken||'–'}</strong></div>
      <div style="font-size:12.5px;margin-bottom:4px;display:flex;gap:6px"><span style="color:var(--gray4);min-width:80px">Standort:</span><span>${e.gps?.address||'Kein GPS'}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
        <button class="sm btn-s" onclick="editEntry('${e.id}')">✏️ Bearbeiten</button>
        <button class="sm btn-p" style="background:var(--g2);color:#fff" onclick="resend('${e.id}')">📤 Senden</button>
        <button class="sm btn-d" style="background:var(--r);color:#fff" onclick="confirmAction('Löschen?',()=>delEntry('${e.id}'))">🗑️ Löschen</button>
      </div>
    </div>
  </div>`;
}

function toggleHE(id){
  const b=document.getElementById('hb-'+id),c=document.getElementById('chev-'+id);
  if(b){b.classList.toggle('open');if(c)c.classList.toggle('open')}
}

/* ============================================================
   EDIT / DELETE / CONFIRM
   ============================================================ */

function editEntry(id){
  vibe(20);editId=id;const e=entries.find(x=>x.id===id);if(!e)return;
  document.getElementById('edCat').innerHTML=CATS.map(c=>`<option value="${c.k}"${c.k===e.category?' selected':''}>${c.k}</option>`).join('');
  document.getElementById('edNotes').value=e.notes||'';
  document.getElementById('editModal').classList.remove('h');
}
async function saveEdit(){
  const e=entries.find(x=>x.id===editId);if(!e)return;
  e.category=document.getElementById('edCat').value;
  e.notes=document.getElementById('edNotes').value.trim();
  e.updatedAt=new Date().toISOString();
  await dbPut('entries',e);closeEdit();renderHistory();toast('✅ Gespeichert');
}
function closeEdit(){editId=null;document.getElementById('editModal').classList.add('h')}
function closeT(){closeEdit()}
async function delEntry(id){await dbDelete('entries',id);renderHistory();toast('🗑️ Gelöscht')}
function confirmAction(text,cb){
  document.getElementById('gmText').textContent=text;
  document.getElementById('gmConfirm').onclick=()=>{vibe(30);cb();closeGenericModal()};
  document.getElementById('genericModal').classList.remove('h');
}
function closeGenericModal(){document.getElementById('genericModal').classList.add('h')}

/* ============================================================
   ZIP EXPORT
   ============================================================ */

function showExport(){
  exportPeriod=null;
  document.getElementById('exportManual').classList.add('hidden');
  document.querySelectorAll('.export-choice').forEach(b=>b.classList.remove('active'));
  document.getElementById('exportModal').classList.remove('h');
}
function closeExport(){document.getElementById('exportModal').classList.add('h')}

function selectExportPeriod(period,btn){
  exportPeriod=period;
  document.querySelectorAll('.export-choice').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(period==='manual'){
    const today=new Date(),from=new Date(today);from.setDate(from.getDate()-30);
    document.getElementById('exFrom').value=fmtISO(from);
    document.getElementById('exTo').value=fmtISO(today);
    document.getElementById('exportManual').classList.remove('hidden');
  }else{doExport()}
}

function getExportDateRange(){
  const now=new Date();
  switch(exportPeriod){
    case 'today': return{from:new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,0),to:new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59,59,999)};
    case 'week':{const day=now.getDay()||7,from=new Date(now);from.setDate(now.getDate()-day+1);from.setHours(0,0,0,0);const to=new Date(now);to.setHours(23,59,59,999);return{from,to}}
    case 'month':{const from=new Date(now.getFullYear(),now.getMonth(),1,0,0,0,0);const to=new Date(now);to.setHours(23,59,59,999);return{from,to}}
    case 'manual':{const from=new Date(document.getElementById('exFrom').value);from.setHours(0,0,0,0);const to=new Date(document.getElementById('exTo').value);to.setHours(23,59,59,999);return{from,to}}
    default:return{from:new Date(0),to:new Date()};
  }
}

function getCalendarWeek(date){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const dn=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-dn);
  const ys=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d-ys)/86400000)+1)/7);
}

function getZipFilename(from,to){
  const name=(settings.driverName||'Fahrer').replace(/[^\w\-äöüÄÖÜß]/g,'_');
  const year=from.getFullYear(),pad=n=>String(n).padStart(2,'0');
  const MO=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  switch(exportPeriod){
    case 'today':  return`Meldung_${name}-${year}_${pad(from.getDate())}.${pad(from.getMonth()+1)}.zip`;
    case 'week':   return`Meldung_${name}-${year}_KW${String(getCalendarWeek(from)).padStart(2,'0')}.zip`;
    case 'month':  return`Meldung_${name}-${year}_${MO[from.getMonth()]}.zip`;
    case 'manual': return`Meldung_${name}-${year}_${pad(from.getDate())}-${pad(from.getMonth()+1)} bis ${pad(to.getDate())}-${pad(to.getMonth()+1)}.zip`;
    default:       return`Meldung_${name}-${year}_Export.zip`;
  }
}

async function doExport(){
  if(!window.JSZip){toast('⚠️ JSZip nicht geladen – Internetverbindung prüfen');return}
  const{from,to}=getExportDateRange();
  const allEntries=await dbGetAll('entries');
  const rows=allEntries.filter(e=>{const d=new Date(e.createdAt);return d>=from&&d<=to}).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  if(!rows.length){toast('⚠️ Keine Daten im gewählten Zeitraum.');return}
  toast('⏳ ZIP wird erstellt…');

  const zip=new JSZip(),imgFolder=zip.folder('images');
  const photoMap={};
  for(const e of rows){
    const photos=e.photos||[null,null,null],fnames=[null,null,null];
    for(let i=0;i<3;i++){
      const b64=await photoToBase64(photos[i]);
      if(!b64)continue;
      const fname=`${e.id}-${PHOTO_NAMES[i]}.jpg`;
      imgFolder.file(fname,b64,{base64:true});
      fnames[i]=fname;
    }
    photoMap[e.id]=fnames;
  }

  const HCOLS=['ID','Datum/Zeit','Barcode','Müllart','Kategorie','Aktion','Adresse','PLZ','Ort',
               'Breitengrad','Längengrad','Google Maps',
               'Fahrername','Kennzeichen','Landkreis','Anmerkungen',
               'Foto Tonne','Foto Zusatz','Foto Barcode','Gesendet','Status'];
  let csv='\uFEFF';
  csv+=HCOLS.map(h=>`"${h}"`).join(';')+'\n';
  for(const e of rows){
    const fn=photoMap[e.id]||[null,null,null];
    const cols=[
      e.id,fmtDT(e.createdAt),e.barcode||'',e.wasteType||'',e.category||'',e.actionTaken||'',
      e.gps?.street||e.gps?.address||'',
      e.gps?.plz||'',
      e.gps?.ort||'',
      e.gps?.lat!=null?e.gps.lat.toFixed(6):'',
      e.gps?.lng!=null?e.gps.lng.toFixed(6):'',
      e.gps?`https://www.google.com/maps?q=${e.gps.lat},${e.gps.lng}`:'',
      e.driverName||'',e.licensePlate||'',e.district||'',
      (e.notes||'').replace(/\r?\n/g,' '),
      fn[0]||'',fn[1]||'',fn[2]||'',
      e.sentCount||0,e.archived?'Archiv':'Aktiv'
    ];
    csv+=cols.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')+'\n';
  }
  zip.file('Meldungen.csv',csv);
  zip.file('Bericht.html',buildHtmlReport(rows,photoMap,from,to));
  zip.file('HINWEIS.txt',['MÜLLTONNEN-BERICHT – ANLEITUNG','================================','','INHALT:','  Bericht.html  → Im Browser öffnen (Fotos direkt sichtbar)','  Meldungen.csv → Für Excel-Import','  images/       → Alle Fotos','','FOTOS ANZEIGEN:','  1. ZIP vollständig entpacken','  2. Bericht.html doppelklicken → Browser öffnet sich','  3. Fotos erscheinen direkt als klickbare Thumbnails','','© Michael Elvey · Mülltonnen-Meldung 2.7 Pro'].join('\n'));

  const zipName=getZipFilename(from,to);
  const content=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  closeExport();

  const zipFile=new File([content],zipName,{type:'application/zip'});
  let shared=false;

  // Teilen-Dialog: funktioniert auf Android & iOS wenn ZIP unterstützt wird
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[zipFile]})){
    try{
      await navigator.share({files:[zipFile],title:zipName});
      shared=true;
    }catch(err){
      // Nutzer hat abgebrochen → kein Download, kein Fehler
      if(err?.name==='AbortError'||err?.name==='NotAllowedError'){
        toast('📦 Teilen abgebrochen');return;
      }
      // Alle anderen Fehler (inkl. iOS-Inkompatibilität) → still zum Download
    }
  }

  // Fallback: direkter Download (Desktop + iOS ohne ZIP-Share-Support)
  if(!shared){
    const url=URL.createObjectURL(content);
    const a=document.createElement('a');a.href=url;a.download=zipName;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }

  toast(`📦 ${rows.length} Meldung${rows.length!==1?'en':''} exportiert`);
}

function buildHtmlReport(rows,photoMap,from,to){
  const MO=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const period=exportPeriod==='today'?fmtD(from.toISOString())
    :exportPeriod==='week'?`KW ${String(getCalendarWeek(from)).padStart(2,'0')} / ${from.getFullYear()}`
    :exportPeriod==='month'?`${MO[from.getMonth()]} ${from.getFullYear()}`
    :`${fmtD(from.toISOString())} – ${fmtD(to.toISOString())}`;

  const stCount=rows.filter(e=>e.actionTaken==='Stehen gelassen').length;
  const phCount=rows.filter(e=>(photoMap[e.id]||[]).some(Boolean)).length;
  const gpCount=rows.filter(e=>e.gps).length;

  const rowsHtml=rows.map(e=>{
    const fn=photoMap[e.id]||[null,null,null];
    const labels=['Tonne','Zusatz','Barcode'];
    const photosHtml=fn.some(Boolean)
      ?`<div class="photos">${fn.map((f,i)=>f?`<a href="images/${f}" target="_blank" title="Foto ${labels[i]} öffnen"><img src="images/${f}" alt="${labels[i]}" loading="lazy"><span>${labels[i]}</span></a>`:'').join('')}</div>`
      :'<span class="nophoto">Keine Fotos</span>';
    const isSt=e.actionTaken==='Stehen gelassen';
    const street=e.gps?(e.gps.street||e.gps.address||'–'):'–';
    const plz=e.gps?.plz||'–';
    const ort=e.gps?.ort||'–';
    const mapsLink=e.gps?`https://www.google.com/maps?q=${e.gps.lat},${e.gps.lng}`:'';
    const notes=(e.notes||'').replace(/\n/g,'<br>')||'–';
    return`<tr${isSt?' class="stehen"':''}
      data-id="${e.id.slice(-8)}"
      data-dt="${e.createdAt}"
      data-barcode="${(e.barcode||'').toLowerCase()}"
      data-waste="${(e.wasteType||'').toLowerCase()}"
      data-cat="${(e.category||'').toLowerCase()}"
      data-action="${(e.actionTaken||'').toLowerCase()}"
      data-street="${street.toLowerCase()}"
      data-plz="${plz.toLowerCase()}"
      data-ort="${ort.toLowerCase()}"
      data-notes="${(e.notes||'').toLowerCase()}">
      <td><code>${e.id.slice(-8)}</code></td>
      <td>${fmtDT(e.createdAt)}</td>
      <td>${e.barcode?`<code style="font-size:11px">${e.barcode}</code>`:'–'}</td>
      <td>${e.wasteType||'–'}</td>
      <td>${e.category||'–'}</td>
      <td${isSt?' class="warn"':''}>${e.actionTaken||'–'}</td>
      <td>${e.gps?`${street}<br><a class="ml" href="${mapsLink}" target="_blank">📍 Karte</a>`:'–'}</td>
      <td>${plz}</td>
      <td>${ort}</td>
      <td>${notes}</td>
      <td>${photosHtml}</td>
    </tr>`;
  }).join('');

  return`<!DOCTYPE html>
<html lang="de"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mülltonnen-Bericht – ${period}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f7f5;color:#1a1a1a;padding:20px}
h1{font-size:20px;color:#1a5c1a;margin-bottom:4px}
.meta{font-size:12px;color:#555;margin-bottom:16px;line-height:1.7}
.stats{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}
.stat{background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:10px 14px;font-size:12px;color:#555}
.stat b{display:block;font-size:20px;color:#1a5c1a;font-weight:700}
.wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.1);font-size:12px;min-width:700px}
th{background:#1a5c1a;color:#fff;padding:9px 11px;text-align:left;font-weight:600;white-space:nowrap;user-select:none}
th[data-col]{cursor:pointer;transition:background .15s}
th[data-col]:hover{background:#226b22}
th[data-col]::after{content:' ⇅';opacity:.45;font-size:10px}
th[data-col].asc::after{content:' ▲';opacity:1}
th[data-col].desc::after{content:' ▼';opacity:1}
td{padding:9px 11px;border-bottom:1px solid #f0f0f0;vertical-align:top}
tr:last-child td{border-bottom:none}
tr.stehen td{background:#fff5f5}
.warn{color:#b91c1c;font-weight:700}
.ml{font-size:11px;color:#1d4ed8;text-decoration:none}
.ml:hover{text-decoration:underline}
.nophoto{font-size:11px;color:#aaa;font-style:italic}
.photos{display:flex;gap:6px;flex-wrap:wrap}
.photos a{display:flex;flex-direction:column;align-items:center;gap:3px;text-decoration:none}
.photos img{width:90px;height:68px;object-fit:cover;border-radius:5px;border:2px solid #e5e7eb;transition:all .15s;cursor:zoom-in}
.photos img:hover{border-color:#1a5c1a;transform:scale(1.06)}
.photos span{font-size:10px;color:#888}
code{font-size:10px;color:#555;background:#f3f4f6;padding:2px 4px;border-radius:3px}
footer{margin-top:14px;font-size:11px;color:#aaa;text-align:right}
.search-bar{display:flex;align-items:center;gap:8px;background:#fff;border:1.5px solid #d1d5db;border-radius:9px;padding:8px 12px;margin-bottom:6px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.search-bar:focus-within{border-color:#1a5c1a;box-shadow:0 0 0 3px rgba(26,92,26,.12)}
.search-icon{font-size:15px;flex-shrink:0;color:#6b7280}
.search-bar input{flex:1;border:none;outline:none;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#111;background:transparent}
.search-bar input::placeholder{color:#9ca3af}
#searchClear{display:none;align-items:center;justify-content:center;background:#e5e7eb;border:none;border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer;color:#374151;flex-shrink:0;font-weight:700}
#searchClear:hover{background:#d1d5db}
#searchInfo{font-size:12px;color:#6b7280;margin-bottom:8px;display:none}
</style></head><body>
<h1>🗑️ Mülltonnen-Bericht</h1>
<div class="meta">
  <strong>Fahrer:</strong> ${settings.driverName||'–'} &nbsp;|&nbsp;
  <strong>Fahrzeug:</strong> ${settings.licensePlate||'–'} &nbsp;|&nbsp;
  <strong>Landkreis:</strong> ${settings.district||'–'} &nbsp;|&nbsp;
  <strong>Zeitraum:</strong> ${period}
</div>
<div class="stats">
  <div class="stat"><b>${rows.length}</b>Meldungen gesamt</div>
  <div class="stat"><b>${stCount}</b>Stehen gelassen</div>
  <div class="stat"><b>${phCount}</b>Mit Fotos</div>
  <div class="stat"><b>${gpCount}</b>Mit GPS</div>
</div>
<div class="search-bar">
  <span class="search-icon">🔍</span>
  <input type="text" id="searchInput" placeholder="Suche in allen Spalten … (ID, Ort, Kategorie, Barcode …)" oninput="applySearch()">
  <button id="searchClear" onclick="clearSearch()" title="Suche zurücksetzen">✕</button>
</div>
<div id="searchInfo"></div>
<div class="wrap">
<table id="reportTable">
<thead><tr>
  <th data-col="id">ID</th>
  <th data-col="dt">Datum/Zeit</th>
  <th data-col="barcode">Barcode</th>
  <th data-col="waste">Müllart</th>
  <th data-col="cat">Kategorie</th>
  <th data-col="action">Aktion</th>
  <th data-col="street">Adresse</th>
  <th data-col="plz">PLZ</th>
  <th data-col="ort">Ort</th>
  <th>Anmerkungen</th>
  <th>Fotos</th>
</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
</div>
<footer>© Michael Elvey · Mülltonnen-Meldung 2.7 Pro · Erstellt: ${fmtDT(new Date().toISOString())}</footer>
<script>
(function(){
  /* ---------- SORT ---------- */
  var sortCol=null,sortAsc=true;
  var thead=document.querySelector('#reportTable thead');
  thead.querySelectorAll('th[data-col]').forEach(function(th){
    th.addEventListener('click',function(){
      var col=th.dataset.col;
      if(sortCol===col){sortAsc=!sortAsc}else{sortCol=col;sortAsc=true}
      thead.querySelectorAll('th[data-col]').forEach(function(h){h.classList.remove('asc','desc')});
      th.classList.add(sortAsc?'asc':'desc');
      var tbody=document.querySelector('#reportTable tbody');
      var rows=Array.from(tbody.querySelectorAll('tr'));
      rows.sort(function(a,b){
        var av=a.dataset[col]||'',bv=b.dataset[col]||'';
        if(col==='dt') return sortAsc?(av<bv?-1:av>bv?1:0):(av>bv?-1:av<bv?1:0);
        if(col==='plz'){var an=parseFloat(av),bn=parseFloat(bv);if(!isNaN(an)&&!isNaN(bn))return sortAsc?an-bn:bn-an}
        return sortAsc?av.localeCompare(bv,'de'):bv.localeCompare(av,'de');
      });
      rows.forEach(function(r){tbody.appendChild(r)});
    });
  });

  /* ---------- SEARCH ---------- */
  var totalRows=document.querySelectorAll('#reportTable tbody tr').length;

  window.applySearch=function(){
    var q=document.getElementById('searchInput').value.trim().toLowerCase();
    var rows=document.querySelectorAll('#reportTable tbody tr');
    var visible=0;
    rows.forEach(function(tr){
      /* Durchsuche alle data-* Attribute (lowercase) */
      var hay=Object.values(tr.dataset).join(' ');
      var match=!q||hay.includes(q);
      tr.style.display=match?'':'none';
      if(match)visible++;
    });
    /* Clear-Button ein-/ausblenden */
    document.getElementById('searchClear').style.display=q?'flex':'none';
    /* Treffer-Info */
    var info=document.getElementById('searchInfo');
    if(q){
      info.textContent=visible+' von '+totalRows+' Einträgen gefunden';
      info.style.display='block';
    }else{
      info.style.display='none';
    }
  };

  window.clearSearch=function(){
    document.getElementById('searchInput').value='';
    applySearch();
    document.getElementById('searchInput').focus();
  };
})();
</script>
</body></html>`;
}

/* ============================================================
   RESEND
   ============================================================ */

async function resend(id){
  const e=entries.find(x=>x.id===id);if(!e)return;
  const dups=findDups(e),subj=buildSubj(e),body=buildBody(e,dups);
  const photoFiles=await dataUrlsToFiles((e.photos||[]).filter(Boolean),e.id);
  let sent=false;
  if(navigator.share){
    try{
      let sd={title:subj,text:body};
      if(photoFiles.length>0&&navigator.canShare&&navigator.canShare({files:photoFiles}))sd.files=photoFiles;
      await navigator.share(sd);sent=true;
    }catch{}
  }
  if(!sent){
    // E-Mail-Adresse aus den Einstellungen lesen
    const districtEmail=getDistrictEmail(e.district);
    const dispoEmail=settings.email||'';
    let rec=districtEmail?`mailto:${districtEmail}?cc=${dispoEmail}`:`mailto:${dispoEmail}`;
    const sep=rec.includes('?')?'&':'?';
    window.open(`${rec}${sep}subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`);
  }
  e.sentCount++;e.updatedAt=new Date().toISOString();
  await dbPut('entries',e);renderHistory();toast('📤 Erneut gesendet');
}

/* ============================================================
   SETUP LINK
   ============================================================ */

/**
 * Beim App-Start: URL auf ?setup=BASE64 prüfen und Einstellungen importieren.
 * Wird aufgerufen bevor die UI aufgebaut wird.
 */
function checkSetupLink(){
  const params=new URLSearchParams(window.location.search);
  const setup=params.get('setup');
  if(!setup)return;
  try{
    const decoded=JSON.parse(atob(decodeURIComponent(setup)));
    // Nur bekannte Felder übernehmen
    const allowed=['driverName','licensePlate','district','districtMails','email','defaultWasteType','theme'];
    allowed.forEach(k=>{if(decoded[k]!==undefined)settings[k]=decoded[k]});
    // districtMails mit Defaults zusammenführen
    settings.districtMails={...DISTRICT_MAIL_DEFAULTS,...(decoded.districtMails||{})};
    applyTheme(settings.theme||'auto');
    // In DB speichern
    dbPut('settings',settings,'config');
    // URL bereinigen ohne Seiten-Reload
    window.history.replaceState({},'',window.location.pathname+window.location.hash);
    // Fahrer informieren und direkt in Einstellungen springen
    setTimeout(()=>{
      toast('✅ Einstellungen erfolgreich importiert!');
      showTab('e');
    },600);
  }catch(e){
    console.warn('Setup-Link ungültig:',e);
    toast('⚠️ Setup-Link ungültig oder beschädigt.');
  }
}

/**
 * Generiert einen Setup-Link aus den aktuellen Einstellungen
 * und öffnet den Teilen-Dialog (WhatsApp, SMS, E-Mail …).
 *
 * Fahrername + Kennzeichen werden MIT übertragen wenn ausgefüllt,
 * damit der Disponent auch fahrerspezifische Links erzeugen kann.
 */
function generateSetupLink(){
  // Aktuelle Feldwerte lesen (inkl. noch nicht gespeicherter Änderungen)
  const payload={
    driverName:       document.getElementById('sName').value.trim(),
    licensePlate:     document.getElementById('sPlate').value.trim(),
    district:         document.getElementById('sDist').value,
    districtMails:    settings.districtMails||{},
    email:            document.getElementById('sEmail').value.trim(),
    defaultWasteType: document.getElementById('sWaste').value,
    theme:            document.getElementById('sTheme').value
  };
  // Leere Felder entfernen (kleinerer Link)
  Object.keys(payload).forEach(k=>{if(payload[k]===''||payload[k]===null)delete payload[k]});
  // Aktuellen districtMail-Wert des gewählten Landkreises eintragen
  const currentDist=document.getElementById('sDist').value;
  const currentDistMail=document.getElementById('sDistMail').value.trim();
  if(currentDistMail){
    payload.districtMails=payload.districtMails||{};
    payload.districtMails[currentDist]=currentDistMail;
  }

  const base64=encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
  const appUrl='https://michaelelvey.github.io/tonnenmeldung/';
  const fullUrl=`${appUrl}?setup=${base64}`;

  const msg=`🗑️ Mülltonnen-Meldung – Einrichtungslink\n\n`
    +`Tippe auf den Link – die App öffnet sich und alle Einstellungen werden automatisch geladen:\n\n`
    +`${fullUrl}\n\n`
    +`Danach einmal „Zum Homescreen hinzufügen" tippen für die Vollbild-App.`;

  if(navigator.share){
    navigator.share({title:'Mülltonnen-App Einrichtung',text:msg}).catch(()=>{});
  }else{
    // Fallback: Zwischenablage
    navigator.clipboard.writeText(fullUrl)
      .then(()=>toast('🔗 Link in Zwischenablage kopiert!'))
      .catch(()=>{
        // Letzter Fallback: WhatsApp Web
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank');
      });
  }
}