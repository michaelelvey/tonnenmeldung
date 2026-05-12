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

function clearBarcode(){
  cur.barcode=null;
  document.getElementById('bcBox').classList.add('hidden');
}


function haversine(lat1,lng1,lat2,lng2){
  const R=6371000,dl=(lat2-lat1)*Math.PI/180,dk=(lng2-lng1)*Math.PI/180;
  const x=Math.sin(dl/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dk/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function findDups(entry){
  const seen=new Set(),res=[];
  // Prüfen ob aktuelle Meldung einen eindeutigen Identifier hat
  const hasIdentifier=!!(entry.barcode);
  entries.forEach(e=>{
    if(e.id===entry.id||seen.has(e.id))return;
    let dup=false;
    // 1. Barcode-Übereinstimmung (eindeutige Tonne)
    if(entry.barcode&&e.barcode&&entry.barcode===e.barcode)dup=true;
    // 2. GPS-Nähe – NUR wenn KEIN Identifier vorhanden (verhindert Sammelplatz-Fehlalarme)
    if(!dup&&!hasIdentifier&&entry.gps&&e.gps&&haversine(entry.gps.lat,entry.gps.lng,e.gps.lat,e.gps.lng)<=DUP_M)dup=true;
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

