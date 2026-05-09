/* ============================================================
   INDEXEDDB – Singleton-Verbindung
   ============================================================ */

const DB_NAME='MuelltonnenDB', DB_VERSION=1;
let _dbConn=null; // Singleton-Verbindung

function getDB(){
  if(_dbConn)return Promise.resolve(_dbConn);
  return new Promise((res,rej)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains('entries')) db.createObjectStore('entries',{keyPath:'id'});
      if(!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    };
    req.onsuccess=()=>{_dbConn=req.result;res(_dbConn)};
    req.onerror=()=>rej(req.error);
  });
}
async function dbPut(store,data,key=null){
  const db=await getDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(store,'readwrite'),s=tx.objectStore(store);
    const r=key?s.put(data,key):s.put(data);
    r.onsuccess=()=>res();r.onerror=()=>rej(r.error);
  });
}
async function dbGet(store,key){
  const db=await getDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(store,'readonly'),s=tx.objectStore(store),r=s.get(key);
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
  });
}
async function dbGetAll(store){
  const db=await getDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(store,'readonly'),s=tx.objectStore(store),r=s.getAll();
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
  });
}
async function dbDelete(store,key){
  const db=await getDB();
  return new Promise((res,rej)=>{
    const tx=db.transaction(store,'readwrite'),s=tx.objectStore(store),r=s.delete(key);
    r.onsuccess=()=>res();r.onerror=()=>rej(r.error);
  });
}

