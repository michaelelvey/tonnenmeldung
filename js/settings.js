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
/* Setzt den Müllsorte-Select robust – versucht exakten Match,
   dann normalisierten Match (Umlaute), dann ersten Eintrag als Fallback */
function setWasteSelect(value){
  const sel=document.getElementById('sWaste');
  if(!value){sel.selectedIndex=0;return}
  // Versuch 1: exakter Match
  sel.value=value;
  if(sel.value===value)return;
  // Versuch 2: normalisierter Match (Kodierungsvarianten)
  const norm=s=>fixUtf8(s||'').toLowerCase().replace(/\s+/g,'');
  const target=norm(value);
  for(const opt of sel.options){
    if(norm(opt.value)===target||norm(opt.text)===target){
      sel.value=opt.value;return;
    }
  }
  // Fallback: ersten Eintrag
  sel.selectedIndex=0;
}

const DISTRICT_ABBR={
  'Landkreis Wittmund':'WTM',
  'Landkreis Friesland':'FRI',
  'Landkreis Wilhelmshaven':'WHV'
};

function updateDistrictMailField(){
  const dist=document.getElementById('sDist').value;
  const abbr=DISTRICT_ABBR[dist]||dist;
  document.getElementById('distMailLabel').textContent=`📧 Mailadresse LK ${abbr}`;
  const currentMail=(settings.districtMails||{})[dist]||'';
  document.getElementById('sDistMail').value=currentMail;
}

async function updateStats(){
  const all=await dbGetAll('entries');
  document.getElementById('stActive').textContent=all.filter(e=>!e.archived).length;
  document.getElementById('stArchived').textContent=all.filter(e=>e.archived).length;
  document.getElementById('stTotal').textContent=all.length;
}

async function loadSettingsUI(){
  document.getElementById('sPlate').value=settings.licensePlate||'';
  document.getElementById('sDist').value=settings.district||'Landkreis Wittmund';
  document.getElementById('sEmail').value=settings.email||'';
  setWasteSelect(settings.defaultWasteType||WASTE_TYPES[0]);
  document.getElementById('sTheme').value=settings.theme||'auto';
  updateDistrictMailField();
  await updateStats();
}

async function saveSettings(){
  vibe(50);
  const emailDispo=document.getElementById('sEmail').value.trim();
  const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if(emailDispo&&!emailRe.test(emailDispo)){toast('⚠️ Ungültige E-Mail-Adresse (Dispo)');return}
  const distMailVal=document.getElementById('sDistMail').value.trim();
  if(distMailVal&&!emailRe.test(distMailVal)){toast('⚠️ Ungültige Mailadresse für den Landkreis');return}
  settings.licensePlate=document.getElementById('sPlate').value.trim();
  settings.district=document.getElementById('sDist').value;
  settings.email=emailDispo;
  settings.defaultWasteType=document.getElementById('sWaste').value;
  settings.theme=document.getElementById('sTheme').value;
  // Landkreis-Mailadresse speichern
  if(!settings.districtMails)settings.districtMails={...DISTRICT_MAIL_DEFAULTS};
  settings.districtMails[settings.district]=distMailVal;

  applyTheme(settings.theme);
  await dbPut('settings',settings,'config');
  applyDistrictFilter();
  if(cur){cur.district=settings.district;cur.licensePlate=settings.licensePlate;}
  toast('✅ Gespeichert');
  const wSel=document.getElementById('wasteSelect');
  setWasteSelect(settings.defaultWasteType);
  wSel.value=settings.defaultWasteType;
  cur.wasteType=settings.defaultWasteType;
  highlightSelect(wSel);
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
  applyDistrictFilter();
}

function showTab(name){
  vibe(20);
  document.querySelectorAll('.tb').forEach(b=>b.classList.remove('on'));
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('on'));
  document.getElementById('tb-'+name).classList.add('on');
  document.getElementById('pane-'+name).classList.add('on');
  if(name==='v'){renderHistory(true);updateStats()}
  if(name==='e')loadSettingsUI();
}

