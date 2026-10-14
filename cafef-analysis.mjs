import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {ANALYSIS_SOURCE,normalizeAnalysis,analysisUrl} from './analysis-data.mjs';
const key='cafefAnalysisArchive',errorKey=key+'Error',pending=new WeakMap();
export function analysisPageUrl(page=1,size=100){
  const u=new URL('https://apiweb.cafef.vn/api/v1/StockPrice/AnalysisReport/smallsreach');
  u.search=new URLSearchParams({symbol:'',resourceCode:'',reportType:'0',fromDate:'',toDate:'',type:'1',pageIndex:String(page),pageSize:String(size)});
  return u.href;
}
export async function readAnalysisPage(url){
  for(let attempt=0;attempt<3;attempt++){
    try{const r=await fetch(url,{signal:AbortSignal.timeout(60000),redirect:'error'});if(!r.ok)throw Error(`CafeF báo cáo phân tích: HTTP ${r.status}`);return await r.json();}
    catch(error){if(attempt===2)throw error;await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
  }
}
export async function fetchAnalysisArchive(read=readAnalysisPage,{now=new Date(),size=100,progress=()=>{}}={}){
  const items=[],seen=new Set(),prefetched=new Map();let total=null,pageSize=null,firstIds='';
  for(let page=1;total===null||items.length<total;page++){
    const response=prefetched.has(page)?prefetched.get(page):await read(analysisPageUrl(page,size)),v=response?.value;prefetched.delete(page);
    if(!response?.isSuccess||!Array.isArray(v?.items)||!v.items.length)throw Error('Danh mục báo cáo CafeF trả trang rỗng hoặc sai cấu trúc.');
    if(!Number.isInteger(v.totalCount)||v.totalCount<1||v.totalCount>500000||v.pageIndex!==page||!Number.isInteger(v.pageSize)||v.pageSize<1||v.pageSize>size)throw Error('Phân trang báo cáo CafeF không hợp lệ.');
    if(total!==null&&(v.totalCount!==total||v.pageSize!==pageSize))throw Error('Danh mục báo cáo CafeF thay đổi giữa lượt quét; giữ bản đã lưu.');
    total=v.totalCount;pageSize=v.pageSize;
    if(v.items.length!==Math.min(pageSize,total-items.length))throw Error('CafeF trả thiếu báo cáo trong một trang; giữ bản đã lưu.');
    for(const raw of v.items){let item;try{item=normalizeAnalysis(raw);}catch(error){throw Error(`${error.message} (trang ${page}, mã ${String(raw.id||raw.objectId||'không có')})`);}if(seen.has(item.id))throw Error('Danh mục báo cáo CafeF trùng trang hoặc thay đổi khi đang đọc.');seen.add(item.id);items.push(item);}
    if(page===1)firstIds=v.items.map(r=>r.id||r.objectId).join(',');
    progress({page,loaded:items.length,total});
    if(!prefetched.size&&items.length<total){
      const pages=Array.from({length:Math.min(4,Math.ceil(total/pageSize)-page)},(_,i)=>page+i+1);
      const results=await Promise.all(pages.map(p=>read(analysisPageUrl(p,size))));
      pages.forEach((p,i)=>prefetched.set(p,results[i]));
    }
  }
  // A new publication during pagination must not silently shift the archive.
  const check=await read(analysisPageUrl(1,size));
  if(!check?.isSuccess||check.value?.totalCount!==total||check.value.items?.map(r=>r.id||r.objectId).join(',')!==firstIds)throw Error('CafeF vừa thay đổi danh mục; cần quét lại để không bỏ sót báo cáo.');
  items.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  return {schema:1,source:ANALYSIS_SOURCE,complete:true,checkedAt:new Date(now).toISOString(),totalAtSource:total,retained:0,items};
}
export function validateAnalysisArchive(snapshot){
  if(snapshot?.schema!==1||snapshot.source!==ANALYSIS_SOURCE||!snapshot.complete||!Number.isFinite(Date.parse(snapshot.checkedAt))||!Array.isArray(snapshot.items)||!Number.isInteger(snapshot.totalAtSource)||snapshot.totalAtSource<1||snapshot.totalAtSource>snapshot.items.length)throw Error('Bản lưu báo cáo phân tích không đầy đủ hoặc không hợp lệ.');
  const seen=new Set();let retained=0;
  for(const r of snapshot.items){
    if(!r||!r.id||seen.has(r.id)||typeof r.title!=='string'||!r.title||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||!Array.isArray(r.symbols)||r.symbols.some(s=>!(/^[A-Z][A-Z0-9]{2,9}$/.test(s)))||typeof r.sourceCode!=='string'||typeof r.category!=='string'||analysisUrl(r.url)!==r.url||(r.pdfUrl!==null&&analysisUrl(r.pdfUrl,'pdf')!==r.pdfUrl))throw Error('Bản lưu báo cáo phân tích chứa dòng hoặc liên kết không hợp lệ.');
    seen.add(r.id);if(r.archived)retained++;
    if(r.documentUrl!=null&&analysisUrl(r.documentUrl,'document')!==r.documentUrl)throw Error('Liên kết tài liệu gốc không hợp lệ.');
  }
  if(snapshot.items.length-retained!==snapshot.totalAtSource||retained!==(snapshot.retained||0))throw Error('Số lượng báo cáo lưu và số lượng nguồn không khớp.');
  return snapshot;
}
export function readAnalysis(db){
  const value=db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value;
  const error=db.prepare('SELECT value FROM meta WHERE key=?').get(errorKey)?.value;
  return {...(value?JSON.parse(value):{schema:1,source:ANALYSIS_SOURCE,complete:false,checkedAt:null,totalAtSource:0,items:[]}),...(error?JSON.parse(error):{error:null})};
}
export function refreshAnalysis(db,read=readAnalysisPage,options={}){
  if(pending.has(db))return pending.get(db);
  const task=(async()=>{
    const previous=readAnalysis(db);
    if(!options.force&&previous.complete&&!previous.error&&Date.now()-Date.parse(previous.checkedAt)<300000)return previous;
    try{
      const next=await fetchAnalysisArchive(read,options),ids=new Set(next.items.map(r=>r.id));
      const retained=previous.items.filter(r=>!ids.has(r.id)).map(r=>({...r,archived:true}));
      next.items.push(...retained);next.retained=retained.length;
      validateAnalysisArchive(next);
      db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(key,JSON.stringify(next));
      db.prepare('DELETE FROM meta WHERE key=?').run(errorKey);
      return next;
    }catch(error){db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(errorKey,JSON.stringify({error:error.message,lastAttempt:new Date().toISOString()}));throw error;}
  })().finally(()=>pending.delete(db));pending.set(db,task);return task;
}
export async function restoreAnalysis(db,manifest,download){
  const asset=manifest.analysis?.asset;if(!asset)return;
  if(!/^\/data\/[a-f0-9]{64}\.bin$/.test(asset))throw Error('Đường dẫn bản lưu báo cáo phân tích không hợp lệ.');
  const body=await download(asset);
  if(createHash('sha256').update(body).digest('hex')!==asset.slice(6,-4))throw Error('Bản lưu báo cáo phân tích sai dấu vân tay.');
  const snapshot=validateAnalysisArchive(JSON.parse(gunzipSync(body)));
  db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(key,JSON.stringify(snapshot));
}
