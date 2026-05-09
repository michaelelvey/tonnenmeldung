/* ============================================================
   ZIP EXPORT
   ============================================================ */

function showExport(){
  exportPeriod=null;
  const now=new Date(),y=now.getFullYear();
  ['exWeekYear','exMonthYear'].forEach(id=>{
    const sel=document.getElementById(id);sel.innerHTML='';
    for(let i=y;i>=y-2;i--){const o=document.createElement('option');o.value=i;o.textContent=i;sel.appendChild(o)}
  });
  const kwSel=document.getElementById('exWeekKW');
  const curKW=getCalendarWeek(now);kwSel.innerHTML='';
  for(let i=1;i<=53;i++){const o=document.createElement('option');o.value=i;o.textContent='KW '+String(i).padStart(2,'0');if(i===curKW)o.selected=true;kwSel.appendChild(o)}
  document.getElementById('exMonthMonth').value=now.getMonth();
  document.getElementById('exDay').value=fmtISO(now);
  ['exportDay','exportWeek','exportMonth'].forEach(id=>document.getElementById(id).classList.add('hidden'));
  document.querySelectorAll('.export-choice').forEach(b=>b.classList.remove('active'));
  document.getElementById('exportModal').classList.remove('h');
}

function toggleExportSection(section,btn){
  const ids={day:'exportDay',week:'exportWeek',month:'exportMonth'};
  const targetId=ids[section];
  const isOpen=!document.getElementById(targetId).classList.contains('hidden');
  Object.values(ids).forEach(id=>document.getElementById(id).classList.add('hidden'));
  document.querySelectorAll('.export-choice').forEach(b=>b.classList.remove('active'));
  if(!isOpen){document.getElementById(targetId).classList.remove('hidden');btn.classList.add('active')}
}

function closeExport(){document.getElementById('exportModal').classList.add('h')}

function selectExportPeriod(period,btn){
  exportPeriod=period;
  if(period==='today'){
    document.querySelectorAll('.export-choice').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }
  doExport();
}

function getExportDateRange(){
  const now=new Date();
  switch(exportPeriod){
    case 'today':{
      return{from:new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,0),
             to:  new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59,59,999)};
    }
    case 'day-pick':{
      const d=new Date(document.getElementById('exDay').value);
      return{from:new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0,0),
             to:  new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59,999)};
    }
    case 'week-pick':{
      const year=parseInt(document.getElementById('exWeekYear').value);
      const kw=parseInt(document.getElementById('exWeekKW').value);
      const jan4=new Date(year,0,4);
      const mon=new Date(jan4);mon.setDate(jan4.getDate()-(jan4.getDay()||7)+1+(kw-1)*7);
      const sun=new Date(mon);sun.setDate(mon.getDate()+6);
      mon.setHours(0,0,0,0);sun.setHours(23,59,59,999);
      return{from:mon,to:sun};
    }
    case 'month-pick':{
      const year=parseInt(document.getElementById('exMonthYear').value);
      const month=parseInt(document.getElementById('exMonthMonth').value);
      return{from:new Date(year,month,1,0,0,0,0),
             to:  new Date(year,month+1,0,23,59,59,999)};
    }
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
  const plate=(settings.licensePlate||'Unbekannt').replace(/[^\w\-]/g,'_');
  const now=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const datePart=`${pad(from.getDate())}-${pad(from.getMonth()+1)}-${from.getFullYear()}`;
  const timePart=`${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return`${plate}_${datePart}_${timePart}.zip`;
}

function showZipProgress(txt,pct){
  document.getElementById('zipProgress').classList.remove('h');
  document.getElementById('zipProgressTxt').textContent=txt;
  document.getElementById('zipProgressBar').style.width=pct+'%';
}
function hideZipProgress(){
  document.getElementById('zipProgress').classList.add('h');
  document.getElementById('zipProgressBar').style.width='0%';
}

async function doExport(){
  if(!window.JSZip){toast('⚠️ JSZip nicht geladen – Internetverbindung prüfen');return}
  const{from,to}=getExportDateRange();
  const allEntries=await dbGetAll('entries');
  const rows=allEntries.filter(e=>{const d=new Date(e.createdAt);return d>=from&&d<=to}).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  if(!rows.length){toast('⚠️ Keine Daten im gewählten Zeitraum.');return}

  // Fortschrittsanzeige starten
  closeExport();
  showZipProgress('Fotos werden verarbeitet…',5);

  const zip=new JSZip(),imgFolder=zip.folder('images');
  const photoMap={};
  const totalPhotos=rows.reduce((n,e)=>(e.photos||[]).filter(Boolean).length+n,0);
  let processedPhotos=0;

  for(const e of rows){
    const photos=e.photos||[null,null,null],fnames=[null,null,null];
    for(let i=0;i<3;i++){
      const b64=await photoToBase64(photos[i]);
      if(!b64)continue;
      const fname=`${e.id}-${PHOTO_NAMES[i]}.jpg`;
      imgFolder.file(fname,b64,{base64:true});
      fnames[i]=fname;
      processedPhotos++;
      const pct=totalPhotos>0?Math.round(5+processedPhotos/totalPhotos*55):60;
      showZipProgress(`Fotos werden verarbeitet… (${processedPhotos}/${totalPhotos})`,pct);
    }
    photoMap[e.id]=fnames;
  }

  showZipProgress('CSV und Bericht werden erstellt…',65);
  const HCOLS=['ID','Datum/Zeit','Barcode','Müllart','Kategorie','Aktion','Adresse','PLZ','Ort','OT',
               'Breitengrad','Längengrad','Google Maps',
               'Kennzeichen','Landkreis','Anmerkungen',
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
      e.gps?.ot||'',
      e.gps?.lat!=null?e.gps.lat.toFixed(6):'',
      e.gps?.lng!=null?e.gps.lng.toFixed(6):'',
      e.gps?`https://www.google.com/maps?q=${e.gps.lat},${e.gps.lng}`:'',
      e.licensePlate||'',e.district||'',
      (e.notes||'').replace(/\r?\n/g,' '),
      fn[0]||'',fn[1]||'',fn[2]||'',
      e.sentCount||0,e.archived?'Archiv':'Aktiv'
    ];
    csv+=cols.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')+'\n';
  }
  zip.file('Meldungen.csv',csv);
  zip.file('Bericht.html',buildHtmlReport(rows,photoMap,from,to));
  zip.file('HINWEIS.txt',['MÜLLTONNEN-BERICHT – ANLEITUNG','================================','','INHALT:','  Bericht.html  → Im Browser öffnen (Fotos direkt sichtbar)','  Meldungen.csv → Für Excel-Import','  images/       → Alle Fotos','','FOTOS ANZEIGEN:','  1. ZIP vollständig entpacken','  2. Bericht.html doppelklicken → Browser öffnet sich','  3. Fotos erscheinen direkt als klickbare Thumbnails','','© Michael Elvey · Mülltonnen-Meldung '+APP_VERSION].join('\n'));

  showZipProgress('ZIP wird komprimiert…',80);
  const zipName=getZipFilename(from,to);
  const content=await zip.generateAsync(
    {type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},
    meta=>showZipProgress(`ZIP wird komprimiert… ${meta.percent.toFixed(0)}%`, 80+meta.percent*0.19)
  );

  showZipProgress('Fertig!',100);
  setTimeout(()=>hideZipProgress(),400);

  const url=URL.createObjectURL(content);
  const a=document.createElement('a');a.href=url;a.download=zipName;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);

  toast(`📦 ${rows.length} Meldung${rows.length!==1?'en':''} exportiert`);
  setTimeout(()=>{
    confirmAction(
      '📁 Die ZIP-Datei wurde in Ihrem Download-Ordner gespeichert.\n\nBitte öffnen Sie den Download-Ordner, tippen Sie auf die Datei und versenden Sie sie über die Teilen-Funktion manuell an die entsprechende WhatsApp-Gruppe.',
      ()=>{},
      '📦 ZIP gespeichert – Hinweis'
    );
  },600);
}

function buildHtmlReport(rows,photoMap,from,to){
  const MO=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const period=exportPeriod==='today'?fmtD(from.toISOString())
    :exportPeriod==='week-pick'?`KW ${String(getCalendarWeek(from)).padStart(2,'0')} / ${from.getFullYear()}`
    :exportPeriod==='month-pick'?`${MO[from.getMonth()]} ${from.getFullYear()}`
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
    const ot=e.gps?.ot||'–';
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
      data-ot="${ot.toLowerCase()}"
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
      <td>${ot!=='–'?ot:'–'}</td>
      <td>${notes}</td>
      <td>${photosHtml}</td>
    </tr>`;
  }).join('');

  return`<!DOCTYPE html>
<html lang="de"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tonnenmeldesystem – Bericht ${period}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f0;color:#1a1a1a}
/* ── HEADER ── */
.ae-header{background:#fff;border-bottom:4px solid #009FE3;padding:0}
.ae-header-inner{max-width:1400px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
.ae-logo{height:52px;object-fit:contain}
.ae-logo-fallback{font-size:15px;font-weight:700;color:#009FE3;letter-spacing:.3px}
.ae-header-right{text-align:right;font-size:11.5px;color:#555;line-height:1.7}
.ae-header-right strong{color:#1a1a1a}
/* ── TITLE BAR ── */
.ae-titlebar{background:linear-gradient(135deg,#009FE3 0%,#0080BF 100%);color:#fff;padding:14px 24px}
.ae-titlebar-inner{max-width:1400px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.ae-titlebar h1{font-size:18px;font-weight:700;letter-spacing:.3px}
.ae-titlebar .ae-period{font-size:13px;opacity:.85;background:rgba(255,255,255,.15);padding:4px 12px;border-radius:20px}
/* ── CONTENT ── */
.ae-content{max-width:1400px;margin:0 auto;padding:20px 24px}
/* ── META CARDS ── */
.ae-meta{background:#fff;border-radius:8px;box-shadow:0 1px 5px rgba(0,0,0,.08);padding:14px 20px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:20px;font-size:12.5px}
.ae-meta-item{display:flex;flex-direction:column;gap:2px}
.ae-meta-item span{font-size:10.5px;text-transform:uppercase;letter-spacing:.6px;color:#888;font-weight:600}
.ae-meta-item strong{color:#1a1a1a;font-size:13px}
/* ── STATS ── */
.stats{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.stat{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px 16px;font-size:12px;color:#555;border-top:3px solid #009FE3}
.stat b{display:block;font-size:22px;color:#009FE3;font-weight:700;line-height:1.2}
.stat.warn-stat{border-top-color:#b91c1c}
.stat.warn-stat b{color:#b91c1c}
/* ── TABLE ── */
.wrap{overflow-x:auto;border-radius:8px;box-shadow:0 1px 5px rgba(0,0,0,.08)}
table{width:100%;border-collapse:collapse;background:#fff;font-size:12px;min-width:700px}
th{background:#009FE3;color:#fff;padding:10px 11px;text-align:left;font-weight:600;white-space:nowrap;user-select:none}
th[data-col]{cursor:pointer;transition:background .15s}
th[data-col]:hover{background:#0080BF}
th[data-col]::after{content:' ⇅';opacity:.45;font-size:10px}
th[data-col].asc::after{content:' ▲';opacity:1}
th[data-col].desc::after{content:' ▼';opacity:1}
td{padding:9px 11px;border-bottom:1px solid #f0f0f0;vertical-align:top}
tr:last-child td{border-bottom:none}
tr:hover td{background:#f0f8fd}
tr.stehen td{background:#fff5f5}
tr.stehen:hover td{background:#fee2e2}
.warn{color:#b91c1c;font-weight:700}
.ml{font-size:11px;color:#1d4ed8;text-decoration:none}
.ml:hover{text-decoration:underline}
.nophoto{font-size:11px;color:#aaa;font-style:italic}
.photos{display:flex;gap:6px;flex-wrap:wrap}
.photos a{display:flex;flex-direction:column;align-items:center;gap:3px;text-decoration:none}
.photos img{width:90px;height:68px;object-fit:cover;border-radius:5px;border:2px solid #e5e7eb;transition:all .15s;cursor:zoom-in}
.photos img:hover{border-color:#009FE3;transform:scale(1.06)}
.photos span{font-size:10px;color:#888}
code{font-size:10px;color:#555;background:#f3f4f6;padding:2px 4px;border-radius:3px}
/* ── SEARCH ── */
.search-bar{display:flex;align-items:center;gap:8px;background:#fff;border:1.5px solid #d1d5db;border-radius:9px;padding:8px 12px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.search-bar:focus-within{border-color:#009FE3;box-shadow:0 0 0 3px rgba(0,159,227,.12)}
.search-icon{font-size:15px;color:#6b7280}
.search-bar input{flex:1;border:none;outline:none;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#111;background:transparent}
.search-bar input::placeholder{color:#9ca3af}
#searchClear{display:none;align-items:center;justify-content:center;background:#e5e7eb;border:none;border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer;color:#374151;font-weight:700}
#searchClear:hover{background:#d1d5db}
#searchInfo{font-size:12px;color:#6b7280;margin-bottom:8px;display:none}
/* ── FOOTER ── */
.ae-footer{background:#009FE3;color:rgba(255,255,255,.7);font-size:11px;text-align:center;padding:14px 24px;margin-top:24px}
.ae-footer a{color:rgba(255,255,255,.85);text-decoration:none}
</style></head><body>

<!-- HEADER mit Logo -->
<div class="ae-header">
  <div class="ae-header-inner">
    <img class="ae-logo"
      src="https://augustin-entsorgung.de/wp-content/uploads/2018/07/cropped-AE-Logo_transparenter_HG_500px-e1552993813616-1.png"
      alt="Augustin Entsorgung"
      onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
    <span class="ae-logo-fallback" style="display:none">AUGUSTIN ENTSORGUNG</span>
    <div class="ae-header-right">
      <strong>Augustin Entsorgung Friesland GmbH &amp; Co. KG</strong><br>
      JadeWeserPark 12 · 26419 Schortens<br>
      Tel: (04421) 500 49 500 · <a href="mailto:friesland@augustin-entsorgung.de" style="color:#009FE3">friesland@augustin-entsorgung.de</a>
    </div>
  </div>
</div>

<!-- TITEL-LEISTE -->
<div class="ae-titlebar">
  <div class="ae-titlebar-inner">
    <h1>Tonnenmeldesystem – Meldungsbericht</h1>
    <span class="ae-period">📅 ${period}</span>
  </div>
</div>

<!-- INHALT -->
<div class="ae-content">

<!-- META -->
<div class="ae-meta">
  <div class="ae-meta-item"><span>Fahrzeug</span><strong>${settings.licensePlate||'–'}</strong></div>
  <div class="ae-meta-item"><span>Landkreis</span><strong>${settings.district||'–'}</strong></div>
  <div class="ae-meta-item"><span>Erstellt am</span><strong>${fmtDT(new Date().toISOString())}</strong></div>
</div>

<!-- STATISTIKEN -->
<div class="stats">
  <div class="stat"><b>${rows.length}</b>Meldungen gesamt</div>
  <div class="stat warn-stat"><b>${stCount}</b>Stehen gelassen</div>
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
  <th data-col="ot">OT</th>
  <th>Anmerkungen</th>
  <th>Fotos</th>
</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
</div>
</div><!-- /.ae-content -->
<div class="ae-footer">
  Augustin Entsorgung Friesland GmbH &amp; Co. KG &nbsp;·&nbsp; JadeWeserPark 12, 26419 Schortens &nbsp;·&nbsp;
  <a href="https://augustin-entsorgung.de" style="color:rgba(255,255,255,.85)">augustin-entsorgung.de</a>
  &nbsp;·&nbsp; Erstellt: ${fmtDT(new Date().toISOString())} &nbsp;·&nbsp; Mülltonnen-Meldung ${APP_VERSION}
</div>
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
  /* Hinweis: #searchInput, #searchClear, #searchInfo existieren nur im generierten
     Bericht.html, NICHT in der App-index.html – daher kein ID-Konflikt */
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

