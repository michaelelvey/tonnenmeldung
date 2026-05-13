/* ============================================================
   ARCHIV BEREINIGEN
   ============================================================ */

let _archivePendingAction=null;

function openArchiveDelete(){
  if(!ADMIN_PASSWORD){toast('Kein Admin-Passwort hinterlegt.');return}
  _archivePendingAction='archiveDelete';
  const modal=document.getElementById('adminPassModal');
  document.getElementById('adminPassInput').value='';
  document.getElementById('adminPassError').classList.add('hidden');
  modal.classList.remove('h');
  setTimeout(()=>document.getElementById('adminPassInput').focus(),100);
}

function _openArchiveDeleteModal(){
  document.getElementById('archiveDeleteDate').value=fmtISO(new Date());
  document.getElementById('archiveDeleteModal').classList.remove('h');
}

async function confirmArchiveDelete(mode){
  document.getElementById('archiveDeleteModal').classList.add('h');
  const allEntries=await dbGetAll('entries');
  const archived=allEntries.filter(e=>e.archived);
  let cutoff;
  if(mode==='date'){
    const d=new Date(document.getElementById('archiveDeleteDate').value);
    if(isNaN(d)){toast('Ungültiges Datum');return}
    d.setHours(23,59,59,999);cutoff=d;
  }else{
    cutoff=new Date();cutoff.setFullYear(cutoff.getFullYear()-1);cutoff.setHours(23,59,59,999);
  }
  const toDelete=archived.filter(e=>new Date(e.createdAt)<=cutoff);
  if(!toDelete.length){toast('Keine Meldungen in diesem Zeitraum gefunden.');return}
  confirmAction(
    `${toDelete.length} archivierte Meldung${toDelete.length!==1?'en':''} endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
    async()=>{
      for(const e of toDelete)await dbDelete('entries',e.id);
      entries=await dbGetAll('entries');
      renderHistory(true);
      await loadSettingsUI();
      toast(`${toDelete.length} Meldung${toDelete.length!==1?'en':''} gelöscht`);
    },
    'Archiv bereinigen'
  );
}

/* ============================================================
   SETUP LINK
   ============================================================ */

function checkSetupLink(){
  const params=new URLSearchParams(window.location.search);
  const setup=params.get('setup');
  if(!setup)return;
  try{
    const _raw=atob(decodeURIComponent(setup));
    const _ba=new Uint8Array(_raw.length);
    for(let _i=0;_i<_raw.length;_i++)_ba[_i]=_raw.charCodeAt(_i);
    const jsonStr=new TextDecoder('utf-8').decode(_ba);
    const decoded=JSON.parse(jsonStr);
    const allowed=['licensePlate','district','districtMails','email','defaultWasteType','theme'];
    allowed.forEach(k=>{
      if(decoded[k]!==undefined){
        settings[k]=typeof decoded[k]==='string'?fixUtf8(decoded[k]):decoded[k];
      }
    });
    settings.districtMails={...DISTRICT_MAIL_DEFAULTS,...(decoded.districtMails||{})};
    applyTheme(settings.theme||'auto');
    dbPut('settings',settings,'config');
    window.history.replaceState({},'',window.location.pathname+window.location.hash);
    setTimeout(async()=>{await loadSettingsUI();toast('App erfolgreich eingerichtet!');showTab('e');},600);
  }catch(e){
    console.warn('Setup-Link ungültig:',e);
    toast('Setup-Link ungültig oder beschädigt.');
  }
}

function generateSetupLink(){
  if(!ADMIN_PASSWORD){toast('Kein Admin-Passwort hinterlegt.');return}
  _archivePendingAction=null;
  const modal=document.getElementById('adminPassModal');
  document.getElementById('adminPassInput').value='';
  document.getElementById('adminPassError').classList.add('hidden');
  modal.classList.remove('h');
  setTimeout(()=>document.getElementById('adminPassInput').focus(),100);
}

function confirmAdminPass(){
  const entered=document.getElementById('adminPassInput').value;
  if(entered!==ADMIN_PASSWORD){
    document.getElementById('adminPassError').classList.remove('hidden');
    document.getElementById('adminPassInput').value='';
    document.getElementById('adminPassInput').focus();
    return;
  }
  closeAdminPassModal();
  if(_archivePendingAction==='archiveDelete'){
    _archivePendingAction=null;
    _openArchiveDeleteModal();
  }else{
    _doGenerateSetupLink();
  }
}

function closeAdminPassModal(){
  document.getElementById('adminPassModal').classList.add('h');
}

function _doGenerateSetupLink(){
  const districtMails={...settings.districtMails};
  const curDist=document.getElementById('sDist').value;
  const distMailEl=document.getElementById('sDistMail');
  const curMail=distMailEl?distMailEl.value.trim():'';
  if(curMail)districtMails[curDist]=curMail;
  const payload={
    licensePlate:     document.getElementById('sPlate').value.trim(),
    district:         curDist,
    districtMails:    districtMails,
    email:            document.getElementById('sEmail').value.trim(),
    defaultWasteType: document.getElementById('sWaste').value,
    theme:            document.getElementById('sTheme').value
  };
  Object.keys(payload.districtMails).forEach(k=>{if(!payload.districtMails[k])delete payload.districtMails[k]});
  Object.keys(payload).forEach(k=>{if(payload[k]===''||payload[k]===null||payload[k]===undefined)delete payload[k]});
  const base64=encodeURIComponent(_b64enc(JSON.stringify(payload)));
  const appUrl=window.location.origin+window.location.pathname;
  const fullUrl=`${appUrl}?setup=${base64}`;
  const msg='Tonnenmeldesystem - Einrichtungslink\n\n'
    +'Tippe auf den Link - die App öffnet sich und alle Einstellungen werden automatisch geladen:\n\n'
    +fullUrl+'\n\n'
    +'Danach nur noch unter Einstellungen die Daten kontrollieren und ggf. korrigieren.\n\n'
    +'"Zum Homescreen hinzufügen" für die Vollbild-App.';
  if(navigator.share){
    navigator.share({title:'Tonnenmeldesystem Einrichtung',text:msg}).catch(()=>{});
  }else{
    navigator.clipboard.writeText(fullUrl)
      .then(()=>toast('Link in Zwischenablage kopiert!'))
      .catch(()=>{window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,'_blank')});
  }
}

/* ============================================================
   DATENBANK KOMPLETT LÖSCHEN (Admin)
   ============================================================ */

/**
 * Löscht ALLE Einträge aus der Datenbank (nicht nur archivierte).
 * Wird über den "Komplette Datenbank löschen"-Button aufgerufen.
 */
async function deleteCompleteDatabase(){
  confirmAction(
    '⛔ ACHTUNG: Alle Meldungen werden unwiderruflich gelöscht!\n\nDiese Aktion kann nicht rückgängig gemacht werden.',
    async()=>{
      const allEntries=await dbGetAll('entries');
      for(const e of allEntries)await dbDelete('entries',e.id);
      entries=[];
      renderHistory(true);
      await loadSettingsUI();
      toast('\uD83D\uDDD1\uFE0F Alle Meldungen gelöscht');
    },
    '\u26D4 Komplette Datenbank löschen'
  );
}
