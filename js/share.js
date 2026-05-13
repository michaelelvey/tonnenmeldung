/* ============================================================
   SEND / EMAIL
   ============================================================ */

function buildSubj(e){
  const street=e.gps?.street||e.gps?.address||'';
  const plz=e.gps?.plz||'';
  const ort=e.gps?.ort||'';
  const ot=e.gps?.ot||'';
  // Betreff: alle Adressbestandteile einzeln aufführen
  const parts=[street,plz,ort,ot?`OT: ${ot}`:''].filter(Boolean).join(' – ');
  return parts
    ?`Mülltonnen-Meldung | ${e.category} | ${parts}`
    :`Mülltonnen-Meldung | ${e.category} | ${fmtD(e.createdAt)}`;
}

function buildBody(e,dups=[]){
  const street=e.gps?.street||e.gps?.address||'';
  const plz=e.gps?.plz||'';
  const ort=e.gps?.ort||'';
  const ot=e.gps?.ot||'';
  const plzOrt=[plz,ort].filter(Boolean).join(' ');
  const plzOrtOt=ot?`${plzOrt} (${ot})`:plzOrt;
  const standort=e.gps?(plzOrtOt?`${street}, in ${plzOrtOt}`:street)||'-':'-';
  const ln=[
    `════════════════════════════════════`,
    `AUGUSTIN ENTSORGUNG FRIESLAND`,
    `Tonnenmeldesystem – Meldungsbericht`,
    `════════════════════════════════════`,'',
    `Datum: ${fmtDT(e.createdAt)}`,'',
    `Fahrzeug:  ${e.licensePlate||'-'}`,
    `Landkreis: ${e.district||'-'}`,'',
    `Standort: ${standort}`,
    `Barcode: ${e.barcode||'-'}`,
    `Müllart: ${e.wasteType||'-'}`,
    `Kategorie: ${e.category||'-'}`,
    `Aktion: ${e.actionTaken||'-'}`,
    `GPS: ${e.gps?`${e.gps.lat.toFixed(6)}, ${e.gps.lng.toFixed(6)}`:'-'}`,
    `Karte: ${e.gps?`https://www.google.com/maps?q=${e.gps.lat},${e.gps.lng}`:'-'}`,'',
  ];
  if(dups.length>0){
    ln.push('⚠️ DUPLIKATE:');
    dups.forEach((d,i)=>ln.push(`${i+1}. ${fmtDT(d.createdAt)} | ${d.category} | ${d.actionTaken||'–'}`));
  }else{
    ln.push('Keine Duplikate gefunden.');
  }
  ln.push('','---',`Gesendet im Auftrag von: Augustin Entsorgung Friesland GmbH & Co. KG`,'(Bitte nicht auf diese E-Mail antworten – Antworten an die Disposition richten)','© Michael Elvey');
  return ln.join('\n');
}

async function captureEntry(){
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
  btn.innerHTML='Wird gespeichert…';
  try{
    cur.notes=document.getElementById('notesIn').value.trim();
    cur.updatedAt=new Date().toISOString();
    cur.sentCount=0;
    await dbPut('entries',{...cur});
    entries.unshift({...cur});
    vibe([0,50,50]);
    toast('✅ Meldung erfasst!');
    // Kurz warten damit der Toast sichtbar ist, dann Teilen-Menü öffnen
    await new Promise(r=>setTimeout(r,600));
    const saved={...cur};
    const _resetBtn=()=>{btn.innerHTML='📋 Meldung erfassen';btn.disabled=false;};
    await openShareModal(saved, async()=>{
      const stored=entries.find(x=>x.id===saved.id);
      if(stored){stored.sentCount=(stored.sentCount||0)+1;stored.updatedAt=new Date().toISOString();await dbPut('entries',stored);}
      resetForm();showTab('m');_resetBtn();document.getElementById('wrap').scrollTo({top:0});
    }, ()=>{
      resetForm();showTab('m');_resetBtn();document.getElementById('wrap').scrollTo({top:0});
    });
  }catch(err){
    console.error('captureEntry Fehler:',err);
    toast('⚠️ Fehler: '+err.message);
    resetForm();showTab('m');
    btn.innerHTML='📋 Meldung erfassen';btn.disabled=false;
  }
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
  if(isListening&&recognition){recognition.stop();return}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  recognition=new SR();recognition.lang='de-DE';
  recognition.onstart=()=>{isListening=true;vibe(100);document.getElementById('voiceBtn').classList.add('listening');toast('🎤 Ich höre zu...')};
  recognition.onresult=e=>{const t=e.results[0][0].transcript,a=document.getElementById('notesIn');a.value+=(a.value?' ':'')+t;vibe(50)};
  recognition.onend=()=>{isListening=false;document.getElementById('voiceBtn').classList.remove('listening')};
  recognition.start();
}

/* ============================================================
   RESEND
   ============================================================ */

async function resend(id){
  const e=entries.find(x=>x.id===id);if(!e)return;
  await openShareModal(e, async()=>{
    e.sentCount=(e.sentCount||0)+1;e.updatedAt=new Date().toISOString();
    await dbPut('entries',e);renderHistory(true);toast('📤 Erneut gesendet');
  }, null);
}

/* ============================================================
   SHARE MODAL
   ============================================================ */

let _shareEntry=null, _shareOnSent=null, _shareOnCancel=null;

async function openShareModal(entry, onSent, onCancel){
  _shareEntry=entry;
  _shareOnSent=onSent;
  _shareOnCancel=onCancel;
  const subj=buildSubj(entry);
  const modalEl=document.getElementById('shareModal');
  // Sicherheitscheck: falls Modal-Element noch nicht im DOM (alter Cache)
  if(!modalEl){
    const body=buildBody(entry,findDups(entry));
    const distMail=getDistrictEmail(entry.district||settings.district);
    const dispoMail=settings.email||'';
    let mailto='mailto:'+(distMail?`${encodeURIComponent(distMail)}?cc=${encodeURIComponent(dispoMail)}`:dispoMail?encodeURIComponent(dispoMail):'');
    const sep=mailto.includes('?')?'&':'?';
    window.open(`${mailto}${sep}subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`);
    if(onSent)onSent();
    return;
  }
  const subjEl=document.getElementById('shareModalSubj');
  if(subjEl)subjEl.textContent=subj;
  // Empfänger-Vorschau anzeigen
  const hint=document.getElementById('shareHint');
  if(hint){
    const distMail=getDistrictEmail(entry.district||settings.district);
    const dispoMail=settings.email||'';
    if(distMail||dispoMail){
      let hinweis='';
      if(distMail) hinweis+=`📬 <strong>An:</strong> ${distMail}<br>`;
      if(dispoMail) hinweis+=`📬 <strong>CC:</strong> ${dispoMail}`;
      hint.innerHTML=hinweis;
      hint.style.display='block';
    }else{
      hint.style.display='none';
    }
  }
  const waBtn=document.getElementById('shareBtnWA');
  if(waBtn)waBtn.style.display=navigator.share?'':'none';
  modalEl.classList.remove('h');
}

function copyToClip(text){
  navigator.clipboard&&navigator.clipboard.writeText(text).then(()=>toast('📋 Kopiert: '+text)).catch(()=>{});
}

function closeShareModal(sent=false){
  document.getElementById('shareModal').classList.add('h');
  if(sent&&_shareOnSent)_shareOnSent();
  else if(!sent&&_shareOnCancel)_shareOnCancel();
  _shareEntry=null;_shareOnSent=null;_shareOnCancel=null;
}

/* --- Hilfsfunktionen für EML-Erzeugung --- */
function _b64enc(str){
  // TextEncoder statt veraltetem unescape()
  const bytes=new TextEncoder().encode(str);
  let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));
  return btoa(bin);
}
function _fileToB64(file){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onload=e=>res(e.target.result.split(',')[1]);
    fr.onerror=rej;
    fr.readAsDataURL(file);
  });
}
function _wrapB64(b64){return(b64.match(/.{1,76}/g)||[b64]).join('\r\n');}

async function buildEML(entry,subj,body,photoFiles){
  const bound='FMS_'+Math.random().toString(36).substr(2,12).toUpperCase();
  const distMail=getDistrictEmail(entry.district||settings.district);
  const dispoMail=settings.email||'';
  const subjEnc='=?UTF-8?B?'+_b64enc(subj)+'?=';
  let eml='MIME-Version: 1.0\r\n';
  if(distMail)  eml+=`To: ${distMail}\r\n`;
  if(dispoMail) eml+=`Cc: ${dispoMail}\r\n`;
  eml+=`Subject: ${subjEnc}\r\n`;
  eml+=`Content-Type: multipart/mixed; boundary="${bound}"\r\n\r\n`;
  // Text-Teil
  eml+=`--${bound}\r\n`;
  eml+='Content-Type: text/plain; charset=UTF-8\r\n';
  eml+='Content-Transfer-Encoding: base64\r\n\r\n';
  eml+=_wrapB64(_b64enc(body))+'\r\n\r\n';
  // Foto-Anhänge
  for(let i=0;i<photoFiles.length;i++){
    const f=photoFiles[i];
    const b64=await _fileToB64(f);
    eml+=`--${bound}\r\n`;
    eml+=`Content-Type: image/jpeg; name="${f.name}"\r\n`;
    eml+='Content-Transfer-Encoding: base64\r\n';
    eml+=`Content-Disposition: attachment; filename="${f.name}"\r\n\r\n`;
    eml+=_wrapB64(b64)+'\r\n\r\n';
  }
  eml+=`--${bound}--\r\n`;
  return new Blob([eml],{type:'message/rfc822'});
}

/* --- E-Mail MIT Fotos (EML-Datei) --- */
async function shareViaEmail(){
  if(!_shareEntry)return;
  const e=_shareEntry;
  const subj=buildSubj(e);
  const body=buildBody(e,findDups(e));
  const photoFiles=await dataUrlsToFiles((e.photos||[]).filter(Boolean),e.id);
  const hint=document.getElementById('shareHint');
  const emlBlob=await buildEML(e,subj,body,photoFiles);

  // 1. Versuch: Web Share API (iOS Mail-App unterstützt das)
  if(navigator.share){
    const attempts=[
      new File([emlBlob],'Meldung.eml',{type:'message/rfc822'}),
      new File([emlBlob],'Meldung.eml',{type:'application/octet-stream'}),
    ];
    for(const f of attempts){
      if(navigator.canShare&&navigator.canShare({files:[f]})){
        try{
          await navigator.share({files:[f],title:subj});
          closeShareModal(true);
          return;
        }catch(err){break;}
      }
    }
  }

  // 2. Fallback: EML herunterladen + Hinweis
  const url=URL.createObjectURL(emlBlob);
  const a=document.createElement('a');
  a.href=url;a.download='Meldung.eml';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  hint.textContent='📂 "Meldung.eml" wurde heruntergeladen. Öffne die Datei in deiner Mail-App – Empfänger, Betreff und Fotos sind bereits eingetragen.';
  hint.style.display='block';
  if(_shareOnSent)_shareOnSent();
}

/* --- Meldung senden: Web Share API → Fallback mailto: --- */
async function meldungSenden(){
  if(!_shareEntry)return;
  const e=_shareEntry;
  const subj=buildSubj(e);
  const body=buildBody(e,findDups(e));
  const distMail=getDistrictEmail(e.district||settings.district);
  const dispoMail=settings.email||'';
  // Empfängerzeilen im Text (sichtbar in allen Apps)
  const empfHeader=[
    distMail ?`📧 An:  ${distMail}`:'',
    dispoMail?`📧 CC:  ${dispoMail}`:'',
    distMail||dispoMail?'────────────────────────────────────':''
  ].filter(Boolean).join('\n');
  const fullText=(empfHeader?`${empfHeader}\n\n`:'')+body;
  // 1. Versuch: Web Share API (öffnet Systemteilen-Menü – Fahrer kann Mail-App wählen)
  if(navigator.share){
    try{
      const photoFiles=await dataUrlsToFiles((e.photos||[]).filter(Boolean),e.id);
      let sd={title:subj,text:fullText};
      if(photoFiles.length>0&&navigator.canShare&&navigator.canShare({files:photoFiles,title:subj,text:fullText})){
        sd.files=photoFiles;
      }
      await navigator.share(sd);
      closeShareModal(true);
      return;
    }catch(err){
      if(err.name==='AbortError')return; // Fahrer hat abgebrochen
    }
  }
  // 2. Fallback: mailto: (öffnet Standard-Mail-App direkt mit Betreff + Empfänger)
  _mailtoFallback(e,subj,body,distMail,dispoMail);
}

/* --- mailto:-Hilfsfunktion --- */
function _mailtoFallback(e,subj,body,distMail,dispoMail){
  let mailto='mailto:';
  if(distMail){
    mailto+=`${encodeURIComponent(distMail)}?cc=${encodeURIComponent(dispoMail)}`;
  }else if(dispoMail){
    mailto+=`${encodeURIComponent(dispoMail)}?`;
  }else{
    mailto+='?';
  }
  const sep=mailto.includes('?')?'&':'?';
  window.open(`${mailto}${sep}subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`);
  closeShareModal(true);
}

/* --- E-Mail NUR TEXT (mailto:) – intern weiterhin nutzbar --- */
function shareViaEmailText(){
  if(!_shareEntry)return;
  const e=_shareEntry;
  const subj=buildSubj(e);
  const body=buildBody(e,findDups(e));
  const distMail=getDistrictEmail(e.district||settings.district);
  const dispoMail=settings.email||'';
  _mailtoFallback(e,subj,body,distMail,dispoMail);
}

/* --- Teilen (WhatsApp / E-Mail / …) mit Text + Fotos --- */
async function shareViaApp(){
  if(!_shareEntry||!navigator.share)return;
  const e=_shareEntry;
  const subj=buildSubj(e);
  const body=buildBody(e,findDups(e));
  // Empfängeradressen oben anhängen – sichtbar wenn in Gmail oder anderen Mail-Apps geteilt wird
  const distMail=getDistrictEmail(e.district||settings.district);
  const dispoMail=settings.email||'';
  const empfHeader=[
    distMail ?`📧 AN:  ${distMail}`:'',
    dispoMail?`📧 CC:  ${dispoMail}`:'',
    distMail||dispoMail?'────────────────────────────────────':''
  ].filter(Boolean).join('\n');
  const fullText=empfHeader?`${empfHeader}\n\n${body}`:body;
  const photoFiles=await dataUrlsToFiles((e.photos||[]).filter(Boolean),e.id);
  try{
    let sd={title:subj,text:fullText};
    if(photoFiles.length>0&&navigator.canShare&&navigator.canShare({files:photoFiles,title:subj,text:fullText})){
      sd.files=photoFiles;
    }
    await navigator.share(sd);
    closeShareModal(true);
  }catch(err){/* abgebrochen */}
}

