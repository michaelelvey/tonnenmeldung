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

/**
 * Komprimiert ein Base64-Foto auf Thumbnail-Größe (THUMB_W / THUMB_Q).
 * Wird beim Archivieren (>31 Tage) aufgerufen um DB-Speicher zu sparen.
 * Gibt null zurück wenn das Foto bereits ein Thumbnail ist oder fehlt.
 */
function compressToThumbnail(dataUrl){
  return new Promise(res=>{
    if(!dataUrl||typeof dataUrl!=='string'){res(null);return}
    const img=new Image();
    img.onload=()=>{
      // Nicht erneut komprimieren wenn bereits klein genug
      if(img.width<=THUMB_W){res(dataUrl);return}
      const canvas=document.createElement('canvas');
      const ratio=THUMB_W/img.width;
      canvas.width=THUMB_W;canvas.height=Math.round(img.height*ratio);
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      res(canvas.toDataURL('image/jpeg',THUMB_Q));
    };
    img.onerror=()=>res(dataUrl); // Im Fehlerfall Original behalten
    img.src=dataUrl;
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

// Verfolgt alle via createObjectURL erzeugten URLs für spätere Freigabe
const _blobUrls=new Set();

function photoToDisplayUrl(photo){
  if(!photo)return null;
  if(typeof photo==='string')return photo;
  if(photo instanceof Blob){
    const url=URL.createObjectURL(photo);
    _blobUrls.add(url);
    return url;
  }
  return null;
}

// Gibt alle gespeicherten Blob-URLs frei (aufrufen vor Re-Render oder Löschung)
function revokeBlobUrls(){
  _blobUrls.forEach(url=>URL.revokeObjectURL(url));
  _blobUrls.clear();
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

