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
    const ort=a.city||a.town||a.village||a.municipality||'';
    const ot=a.suburb||a.quarter||a.neighbourhood||'';
    const street=hn?`${road} in Höhe der Hausnr. ${hn}`:`${road}`;
    const plzOrt=[plz,ort].filter(Boolean).join(' ');
    const plzOrtOt=ot?`${plzOrt} (${ot})`:plzOrt;
    const address=plzOrtOt?`${street}, in ${plzOrtOt}`:street;
    return{street,plz,ort,ot,address};
  }catch{
    // Kein Internet oder Nominatim nicht erreichbar
    toast('⚠️ Adresse nicht verfügbar – nur GPS-Koordinaten gespeichert');
    const address=`${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    return{street:address,plz:'',ort:'',ot:'',address};
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

