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

