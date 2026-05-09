/* ============================================================
   HISTORY
   ============================================================ */

async function renderHistory(forceReload=false){
  // DB nur neu laden wenn explizit angefordert (Tab-Wechsel, nach Mutationen)
  if(forceReload||!entries.length){
    revokeBlobUrls(); // Alte Blob-URLs freigeben vor dem Neu-Laden
    entries=await dbGetAll('entries');
  }
  const txt=(document.getElementById('stxt').value||'').toLowerCase();
  const cat=document.getElementById('scat').value;
  let filtered=entries.filter(e=>{
    if(cat&&e.category!==cat)return false;
    if(txt){const s=[e.category,e.wasteType,e.actionTaken,e.licensePlate,e.district,e.gps?.address,e.barcode,e.notes].join(' ').toLowerCase();if(!s.includes(txt))return false}
    return true;
  });
  filtered.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const list=document.getElementById('histList');
  if(!filtered.length){list.innerHTML=`<div style="text-align:center;padding:40px;color:var(--gray4)">📭 Keine Einträge gefunden</div>`;return}
  list.innerHTML=filtered.map(e=>renderHE(e)).join('');
}

function renderHE(e){
  const cat=CATS.find(c=>c.k===e.category)||{i:'<img src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAADbklEQVR4nG2TSWxUdRzHv7//e/PeTGcrXaYzdhgqIzZUOnogEOpSjDGGhJgYhIQLejAhemk0enDFMRqMcTl5MnrgRKzeDAfRkNZUJYGUiOBCpVNbK9NZ38y8Zd5/89qDn/Pn+PkQ/odnLq1Gn//5zY+sxvp+CL8lu538aqV59sT3s+eBebndJQ0QtKbFFx97IH9PYSYxlHxC1Tf2CqdVVN1WzwxczqOJuNfuEtW2bikpr+nUyAUvk1k88PGVDQKApfee2jc9Zl9PZseAWBzoOVBBD8xrgderYAxQfgj/nwak3wcZNq44qRuPf3WsZF6anTV//env22E2/GKHeeOUO5BTkXjKVM6/jNwWtORQfgDf5brZlporEkz1jTu88wlQVuzwYeD0N1e9wp7c0n37MubdWZuNUJtSQU1FRQCLc5iKIQpGmQGDspayxoeTRnF6ehEAzBPlBQaAEDOrZtzEYH6SzFicjBVFQRBCKwUllLY8l2qbHVq7HUKySNBQwx4AsLmzJ+dW3j9yrXJzy+j1hTR4n7UCa2u5GT8fhlwEXGkDmjqh4t0QvkGAZORcHx1tAwCr1Wq/RNx2qXKnl5UKLWuAkavtb/f//vppro0gYRu64evLy23rjZsNcTHCmAaMeiLxoU8AzF0DwWsqwlQxF3unWndTiTEXaeaUlsfn3h2J24m+kADp3fen+KtevqCc9XX4UjvlMil9HIaZSVuPDEYga5udMY9DS9dDOu6WpnYNly5cXXuFUcLc6ujmQznxVlr3xqtCSaX6B88dSB+neWferDa8HzMZe8Z1AtiuRyo/ijCmlRKh3j2YfDoe7MxP5RqJuN1NbK5XhUHMENbA1ylbv3Du0NiCefGHtZObudhMreaP3AvnJd4qTBgZk4RmbE8WBzlfgxQcsgcoRdIwLPIE27grIkvMFB/Q9q5X3n7ws+LOHc+5qaIQm3+YqlNXUCAtBZgb0OqfLXSCKJrQmLIbcLUN88wZsGcrs1alsiCiyVgTBkktpQKY1lIyRgwAoLTWUijNGHEnxK0tWJMdzS6zchlqYgLi0QWIrhv+BSWNmAXLti2ymIZhEiImIUKgKAMjIttOjp76zZV7j35Xf5i2XYnPn5xMHCpYLw+NDB1RvF/QficttY5IX3C34TUbTbHSCPDlsaXqpwCgNeg/P2vPGAJz2BMAAAAASUVORK5CYII=\" style=\"width:18px;height:18px;vertical-align:middle\">'};
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
        <div style="font-size:11.5px;color:var(--gray4);margin-top:2px">${fmtDT(e.createdAt)} · ${e.licensePlate||'–'}</div>
        ${e.actionTaken==='Stehen gelassen'?'<div style="font-size:10px;color:var(--r);font-weight:700;margin-top:2px">⚠️ STEHEN GELASSEN</div>':''}
      </div>
      ${e.archived?'<span style="font-size:10px;background:var(--yl);color:var(--y);padding:3px 7px;border-radius:9px">Archiv</span>':''}
      <span class="hchev" id="chev-${e.id}" style="color:var(--gray4);font-size:14px">▼</span>
    </div>
    <div class="hbody" id="hb-${e.id}" style="display:none;padding:12px 14px 15px;border-top:1px solid var(--gray3)">
      ${photoHtml}
      <div style="font-size:12.5px;margin-bottom:4px;display:flex;gap:6px"><span style="color:var(--gray4);min-width:80px">Aktion:</span><strong style="color:var(--g)">${e.actionTaken||'–'}</strong></div>
      <div style="font-size:12.5px;margin-bottom:4px;display:flex;gap:6px"><span style="color:var(--gray4);min-width:80px">Standort:</span><span>${e.gps?`${e.gps.address||`${e.gps.lat.toFixed(5)}, ${e.gps.lng.toFixed(5)}`} <a href="https://www.google.com/maps?q=${e.gps.lat},${e.gps.lng}" target="_blank" style="font-size:11px;color:var(--blue);text-decoration:none;white-space:nowrap">📍 Karte</a>`:'Kein GPS'}</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
        <button class="sm btn-s" onclick="editEntry('${e.id}')">✏️ Bearbeiten</button>
        <button class="sm btn-p" style="background:var(--g2);color:#fff" onclick="resend('${e.id}')">📤 Senden</button>
        <button class="sm btn-d" style="background:var(--r);color:#fff" onclick="confirmAction('Eintrag vom ${fmtDT(e.createdAt)} wirklich löschen?',()=>delEntry('${e.id}'),'Eintrag löschen')"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAADbklEQVR4nG2TSWxUdRzHv7//e/PeTGcrXaYzdhgqIzZUOnogEOpSjDGGhJgYhIQLejAhemk0enDFMRqMcTl5MnrgRKzeDAfRkNZUJYGUiOBCpVNbK9NZ38y8Zd5/89qDn/Pn+PkQ/odnLq1Gn//5zY+sxvp+CL8lu538aqV59sT3s+eBebndJQ0QtKbFFx97IH9PYSYxlHxC1Tf2CqdVVN1WzwxczqOJuNfuEtW2bikpr+nUyAUvk1k88PGVDQKApfee2jc9Zl9PZseAWBzoOVBBD8xrgderYAxQfgj/nwak3wcZNq44qRuPf3WsZF6anTV//env22E2/GKHeeOUO5BTkXjKVM6/jNwWtORQfgDf5brZlporEkz1jTu88wlQVuzwYeD0N1e9wp7c0n37MubdWZuNUJtSQU1FRQCLc5iKIQpGmQGDspayxoeTRnF6ehEAzBPlBQaAEDOrZtzEYH6SzFicjBVFQRBCKwUllLY8l2qbHVq7HUKySNBQwx4AsLmzJ+dW3j9yrXJzy+j1hTR4n7UCa2u5GT8fhlwEXGkDmjqh4t0QvkGAZORcHx1tAwCr1Wq/RNx2qXKnl5UKLWuAkavtb/f//vppro0gYRu64evLy23rjZsNcTHCmAaMeiLxoU8AzF0DwWsqwlQxF3unWndTiTEXaeaUlsfn3h2J24m+kADp3fen+KtevqCc9XX4UjvlMil9HIaZSVuPDEYga5udMY9DS9dDOu6WpnYNly5cXXuFUcLc6ujmQznxVlr3xqtCSaX6B88dSB+neWferDa8HzMZe8Z1AtiuRyo/ijCmlRKh3j2YfDoe7MxP5RqJuN1NbK5XhUHMENbA1ylbv3Du0NiCefGHtZObudhMreaP3AvnJd4qTBgZk4RmbE8WBzlfgxQcsgcoRdIwLPIE27grIkvMFB/Q9q5X3n7ws+LOHc+5qaIQm3+YqlNXUCAtBZgb0OqfLXSCKJrQmLIbcLUN88wZsGcrs1alsiCiyVgTBkktpQKY1lIyRgwAoLTWUijNGHEnxK0tWJMdzS6zchlqYgLi0QWIrhv+BSWNmAXLti2ymIZhEiImIUKgKAMjIttOjp76zZV7j35Xf5i2XYnPn5xMHCpYLw+NDB1RvF/QficttY5IX3C34TUbTbHSCPDlsaXqpwCgNeg/P2vPGAJz2BMAAAAASUVORK5CYII=" style="width:14px;height:14px;vertical-align:middle;margin-right:3px"> Löschen</button>
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
  await dbPut('entries',e);closeEdit();renderHistory(true);toast('✅ Gespeichert');
}
function closeEdit(){editId=null;document.getElementById('editModal').classList.add('h')}
// closeT() wird als onclick-Handler in der index.html verwendet (Alias für closeEdit)
function closeT(){closeEdit()}
async function delEntry(id){await dbDelete('entries',id);renderHistory(true);toast('Gelöscht')}
function confirmAction(text,cb,title='Bestätigung'){
  document.getElementById('gmTitle').textContent=title;
  document.getElementById('gmText').textContent=text;
  document.getElementById('gmConfirm').onclick=()=>{vibe(30);cb();closeGenericModal()};
  document.getElementById('genericModal').classList.remove('h');
}
function closeGenericModal(){document.getElementById('genericModal').classList.add('h')}

