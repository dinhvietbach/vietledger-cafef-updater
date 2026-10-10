// Keep the original evidence for unchanged reports, even when an API page hash
// changes because a different period on that page was revised.
const content=report=>JSON.stringify(report,(key,value)=>['hash','updated','fetched'].includes(key)?undefined:value);

export function storeSeries(db,{symbol,kind,frequency,reports,checkedAt=new Date().toISOString()}){
 const changes={added:0,revised:0,removed:0,unchanged:0};
 if(!reports.length)return changes; // An empty/error response must not erase saved data.
 const condition=frequency==='quarter'?"period LIKE '%-Q%'":"period NOT LIKE '%-Q%'";
 const old=new Map(db.prepare(`SELECT period,payload FROM reports WHERE symbol=? AND kind=? AND source='CafeF' AND ${condition}`).all(symbol,kind).map(r=>[r.period,r.payload]));
 const incoming=new Map(reports.map(r=>[r.period,r]));
 if(incoming.size!==reports.length)throw Error('CafeF trả kỳ báo cáo trùng; giữ dữ liệu đã lưu.');
 const insert=db.prepare('INSERT OR REPLACE INTO reports VALUES(?,?,?,?,?,?)');
 const remove=db.prepare("DELETE FROM reports WHERE symbol=? AND kind=? AND period=? AND source='CafeF'");
 db.exec('BEGIN');
 try{
  for(const [period,report] of incoming){
   const previous=old.get(period);
   if(previous&&content(JSON.parse(previous))===content(report)){changes.unchanged++;continue;}
   insert.run(symbol,kind,period,'CafeF',JSON.stringify(report),checkedAt);
   changes[previous?'revised':'added']++;
  }
  for(const period of old.keys())if(!incoming.has(period)){remove.run(symbol,kind,period);changes.removed++;}
  db.exec('COMMIT');return changes;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
