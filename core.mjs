import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {sourceUrl,parseApi,parseExact,moneyDisplay,shareDisplay,publishedUnit} from './cafef-api.mjs';
import {sectorOf,supplementUrl} from './cafef-sectors.mjs';
import {storeSeries} from './report-store.mjs';
import {refreshIndustries} from './cafef-industries.mjs';
export const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const DATA=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.join(ROOT,'data');
fs.mkdirSync(path.join(DATA,'raw'),{recursive:true});
export const db=new DatabaseSync(path.join(DATA,'ledger.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS companies(symbol TEXT PRIMARY KEY,name TEXT,exchange TEXT,url TEXT);
CREATE TABLE IF NOT EXISTS reports(symbol TEXT,kind TEXT,period TEXT,source TEXT,payload TEXT,updated TEXT,PRIMARY KEY(symbol,kind,period,source));
CREATE TABLE IF NOT EXISTS revisions(hash TEXT PRIMARY KEY,url TEXT,fetched TEXT,file TEXT);
CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY,started TEXT,finished TEXT,symbol TEXT,status TEXT,message TEXT);
CREATE TABLE IF NOT EXISTS tracked(symbol TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS queue(symbol TEXT PRIMARY KEY,added TEXT);
CREATE TABLE IF NOT EXISTS checks(symbol TEXT,kind TEXT,period TEXT,code TEXT,source TEXT,value TEXT,url TEXT,page INTEGER,note TEXT,PRIMARY KEY(symbol,kind,period,code,source));
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT);
CREATE TABLE IF NOT EXISTS batches(id INTEGER PRIMARY KEY,started TEXT,finished TEXT,total INTEGER);
CREATE TABLE IF NOT EXISTS batch_items(batch INTEGER,symbol TEXT,status TEXT,updated TEXT,message TEXT,PRIMARY KEY(batch,symbol));
CREATE TABLE IF NOT EXISTS series_status(symbol TEXT,kind TEXT,frequency TEXT,status TEXT,reports INTEGER,first TEXT,last TEXT,updated TEXT,message TEXT,PRIMARY KEY(symbol,kind,frequency));
CREATE TABLE IF NOT EXISTS excluded_instruments(symbol TEXT PRIMARY KEY,name TEXT,reason TEXT);
CREATE INDEX IF NOT EXISTS runs_symbol_id ON runs(symbol,id DESC);
PRAGMA busy_timeout=10000;`);
export const clean=s=>s.replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).trim();
export function number(s){s=clean(s);if(!s||/^(?:-|—|n\/a)$/i.test(s))return null;let neg=s.startsWith('(')&&s.endsWith(')');s=s.replace(/[().\s]/g,'');if(!/^-?\d+$/.test(s))throw Error('Định dạng số chưa hỗ trợ: '+s);return (BigInt(s)*(neg?-1n:1n)).toString();}
export function billions(s){if(s===null||s===undefined)return null;let n=BigInt(s),sign=n<0n?-1n:1n;n=n*sign;return (sign*((n+500000000n)/1000000000n)).toString();}
export function parseCafe(html,{symbol,kind,url}){
 const periods=[...html.matchAll(/<td\s+class="h_t"[^>]*>([\s\S]*?)<\/td>/g)].map(x=>{let v=clean(x[1]),q=v.match(/Quý\s*(\d)\s*-\s*(\d{4})/i);if(q)return q[2]+'-Q'+q[1];if(/^\d{4}$/.test(v))return v;throw Error('Kỳ không nhận diện: '+v);});
 if(periods.length!==4)throw Error('Nguồn đổi cấu trúc: không có 4 kỳ');
 const rows=[];const content=html.split('id="tableContent"')[1];if(!content)throw Error('Thiếu bảng chi tiết');
 for(const m of content.matchAll(/<tr\s+class=['"]r_item[^>]*id=['"]([^'"]*)['"][^>]*>([\s\S]*?)(?=<tr\s+class=['"]r_item|<\/table>\s*<div)/g)){
  const cells=[...m[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].slice(0,5);if(cells.length<5)continue;
  const label=clean(cells[0][1]),code=m[1];
  rows.push({code:code||'heading-'+rows.length,label,level:+(m[2].match(/Lever_(\d)/)?.[1]||0),values:cells.slice(1).map(c=>number(c[1])),unit:/\bEPS\b|trên.*cổ phiếu|cơ bản trên/i.test(label)?'VND/share':'VND',heading:!code});
 }
 if(rows.length<15||!rows.some(r=>r.values.some(v=>v!==null)))throw Error('Nguồn trả bảng rỗng hoặc không đủ cấu trúc');
 return periods.map((period,i)=>({symbol,kind,period,source:'CafeF',url,scope:'source-unspecified',basis:kind.startsWith('CashFlow')&&period.includes('Q')?'ytd':period.includes('Q')?'quarter':'annual',unitNote:'HTML nguồn chứa số nguyên VND dù nhãn trang ghi tỷ đồng; EPS giữ VND/cổ phiếu.',rows:rows.map(r=>({...r,value:r.values[i],values:undefined}))}));
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function download(url,force=false){
 const source=new URL(url);if(source.protocol!=='https:'||!['cafef.vn','apiweb.cafef.vn','cafefnew.mediacdn.vn','www.hoaphat.com.vn','file.hoaphat.com.vn'].includes(source.hostname))throw Error('Nguồn không được hỗ trợ');
 const key=createHash('sha256').update(url).digest('hex'),dest=path.join(DATA,'raw',key+'.html');
 if(!force&&fs.existsSync(dest))return {text:fs.readFileSync(dest,'utf8'),file:dest};
 for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok){const error=Error('CafeF HTTP '+r.status);error.retry=r.status===429||r.status>=500;throw error;}fs.writeFileSync(dest,Buffer.from(await r.arrayBuffer()));break;}
  catch(e){if(attempt===2||e.retry===false)throw Error(e.message+(e.cause?.code?' ('+e.cause.code+')':''));await pause(2000*2**attempt);}
 }
 const body=fs.readFileSync(dest),hash=createHash('sha256').update(body).digest('hex'),archive=path.join(DATA,'raw',hash+'.html');if(!fs.existsSync(archive))fs.copyFileSync(dest,archive);
 db.prepare('INSERT OR IGNORE INTO revisions VALUES(?,?,?,?)').run(hash,url,new Date().toISOString(),archive);
 return {text:body.toString('utf8'),file:archive,hash};
}
export async function catalog(){
 const {text}=await download('https://cafefnew.mediacdn.vn/Search/company.json',true),count=importCatalog(JSON.parse(text.replace(/^\uFEFF/,'')));
 try{await refreshIndustries(db,async url=>JSON.parse((await download(url,true)).text));}catch(error){console.warn('Giữ phân ngành đã lưu:',error.message);}
 return count;
}
export function excludedInstrument(symbol,name){return /^(?:chứng quyền|quỹ\s|chứng chỉ quỹ|trái phiếu)/i.test(name)||/^C[A-Z]{3}\d{4}$/.test(symbol);}
export function pruneInstruments(){
 const excluded=db.prepare('SELECT symbol,name FROM companies').all().filter(c=>excludedInstrument(c.symbol,c.name));
 db.exec('BEGIN');try{for(const c of excluded){db.prepare('INSERT OR REPLACE INTO excluded_instruments VALUES(?,?,?)').run(c.symbol,c.name,'Chứng quyền, chứng chỉ quỹ hoặc trái phiếu; không phải mã doanh nghiệp.');for(const table of ['queue','tracked','companies','batch_items'])db.prepare(`DELETE FROM ${table} WHERE symbol=?`).run(c.symbol);}db.prepare('UPDATE batches SET total=(SELECT count(*) FROM batch_items WHERE batch=batches.id) WHERE finished IS NULL').run();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return excluded.length;
}
export function catalogMarket(url){const market=url?.match(/\/du-lieu\/(hose|hnx|hastc|upcom)\//i)?.[1]?.toUpperCase();return market==='HASTC'?'HNX':market;}
export function importCatalog(items){const ins=db.prepare('INSERT OR REPLACE INTO companies VALUES(?,?,?,?)');let count=0;db.exec('BEGIN');try{for(const c of items){const market=catalogMarket(c.RedirectUrl);if(!market||!/^[A-Z0-9]{3,10}$/i.test(c.Symbol))continue;ins.run(c.Symbol.toUpperCase(),c.Title,market,'https://cafef.vn'+c.RedirectUrl);if(!excludedInstrument(c.Symbol,c.Title))count++;}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}pruneInstruments();return count;}
export function saveReports(reports,hash){const stmt=db.prepare('INSERT OR REPLACE INTO reports VALUES(?,?,?,?,?,?)');const fetched=db.prepare('SELECT fetched FROM revisions WHERE hash=?').get(hash)?.fetched||new Date().toISOString();db.exec('BEGIN');try{for(const r of reports){if(+r.period.slice(0,4)<2016||r.rows.every(x=>x.value===null))continue;r.hash=hash;stmt.run(r.symbol,r.kind,r.period,r.source,JSON.stringify(r),fetched);}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
export const jobs={running:false,symbol:null,done:0,total:0,error:null,active:[],queue:[]};
const active=new Map();let draining=false;
function updateJobs(){jobs.active=[...active.values()];jobs.running=!!active.size;const first=jobs.active[0];jobs.symbol=first?.symbol||null;jobs.done=first?.done||0;jobs.total=first?.total||7;}
export function enqueue(symbol,{priority=true}={}){if(!db.prepare('SELECT 1 FROM companies WHERE symbol=?').get(symbol))throw Error('Mã không có trong danh mục');db.prepare('INSERT OR IGNORE INTO tracked VALUES(?)').run(symbol);if(!active.has(symbol)){db.prepare('INSERT OR IGNORE INTO queue VALUES(?,?)').run(symbol,new Date().toISOString());if(priority)db.prepare('UPDATE queue SET added=? WHERE symbol=?').run('0000-'+new Date().toISOString(),symbol);}drain();return {...jobs};}
export function batchStatus(){const b=db.prepare('SELECT * FROM batches ORDER BY id DESC LIMIT 1').get();if(!b)return null;const counts=Object.fromEntries(db.prepare('SELECT status,count(*) n FROM batch_items WHERE batch=? GROUP BY status').all(b.id).map(x=>[x.status,x.n]));return {...b,counts,completed:b.total-(counts.pending||0)-(counts.running||0)};}
export function enqueueAll(){
 db.prepare("INSERT OR REPLACE INTO meta VALUES('allMarket','true')").run();
 const previous=batchStatus();if(previous&&!previous.finished){
  const newItems=db.prepare('SELECT symbol FROM companies WHERE symbol NOT IN (SELECT symbol FROM batch_items WHERE batch=?)').all(previous.id),now=new Date().toISOString();
  db.exec('BEGIN');try{for(const {symbol} of newItems){db.prepare('INSERT OR IGNORE INTO tracked VALUES(?)').run(symbol);db.prepare('INSERT OR IGNORE INTO queue VALUES(?,?)').run(symbol,now);db.prepare('INSERT INTO batch_items VALUES(?,?,?,?,?)').run(previous.id,symbol,'pending',now,'');}db.prepare('UPDATE batches SET total=(SELECT count(*) FROM batch_items WHERE batch=?) WHERE id=?').run(previous.id,previous.id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  drain();return {...batchStatus(),queued:batchStatus().total};
 }
 const items=db.prepare('SELECT symbol FROM companies ORDER BY symbol').all(),now=new Date().toISOString();
 if(!items.length)throw Error('Danh mục chưa có doanh nghiệp; cần tải lại danh mục CafeF.');
 db.exec('BEGIN');try{const id=db.prepare('INSERT INTO batches(started,total) VALUES(?,?)').run(now,items.length).lastInsertRowid;
  for(const {symbol} of items){db.prepare('INSERT OR IGNORE INTO tracked VALUES(?)').run(symbol);db.prepare('INSERT OR IGNORE INTO queue VALUES(?,?)').run(symbol,now);db.prepare('INSERT INTO batch_items VALUES(?,?,?,?,?)').run(id,symbol,active.has(symbol)?'running':'pending',now,'');}
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 drain();return {...batchStatus(),queued:items.length};
}
export function resumeQueue(){db.prepare("UPDATE runs SET status='interrupted',finished=?,message='Máy chủ đã dừng giữa lượt; hàng đợi sẽ tiếp tục khi mở lại.' WHERE status='running'").run(new Date().toISOString());drain();}
async function drain(){if(draining)return;draining=true;
 const worker=async()=>{while(true){const next=db.prepare('SELECT symbol FROM queue ORDER BY added,symbol').all().find(x=>!active.has(x.symbol));if(!next)break;const s=next.symbol;try{await syncCompany(s);}catch(e){jobs.error=e.message;}db.prepare('DELETE FROM queue WHERE symbol=?').run(s);}};
 try{await Promise.all(Array.from({length:Math.max(1,Math.min(4,Number(process.env.SYNC_WORKERS)||4))},worker));}finally{draining=false;updateJobs();if(db.prepare('SELECT 1 FROM queue LIMIT 1').get())setImmediate(drain);}
}
export async function syncCompany(symbol,{full=false}={}){
 if(active.has(symbol))throw Error('Đang đồng bộ '+symbol);const progress={symbol,done:0,total:7};active.set(symbol,progress);updateJobs();
 db.prepare("UPDATE batch_items SET status='running',updated=? WHERE symbol=? AND batch IN (SELECT id FROM batches WHERE finished IS NULL)").run(new Date().toISOString(),symbol);
 const run=db.prepare('INSERT INTO runs(started,symbol,status) VALUES(?,?,?)').run(new Date().toISOString(),symbol,'running').lastInsertRowid;
 try{
 const company=db.prepare('SELECT * FROM companies WHERE symbol=?').get(symbol);if(!company)throw Error('Mã không hợp lệ');
 const requests=['BSheet','IncSta','CashFlow'].flatMap(kind=>['quarter','year'].map(frequency=>({kind,frequency}))).concat({kind:'CafeFRatios',frequency:'year'});
 let errors=[],seriesWithData=0,empty=0,companySector='enterprise';const changes={added:0,revised:0,removed:0,unchanged:0};
 for(const {kind,frequency} of requests){
  try{
   const collected=[];let page=1,size=kind==='CashFlow'&&companySector==='security'?4:50;progress.kind=kind;progress.frequency=frequency;
   while(true){
    const url=sourceUrl(symbol,kind,frequency,page,size),d=await download(url,true),raw=parseExact(d.text),sector=raw.value?.templace?sectorOf(raw.value,kind):null;
    if(sector&&sector!=='enterprise')companySector=sector;
    if(kind==='CashFlow'&&sector==='security'&&size!==4){size=4;continue;}
    let supplement;
    if((kind==='IncSta'&&sector==='insurance')||(kind==='CashFlow'&&sector==='security')){const extraUrl=supplementUrl(symbol,sector,frequency,page,size),extra=await download(extraUrl,true);supplement={...extra,url:extraUrl,type:sector};}
    const parsed=parseApi(d.text,{symbol,kind,frequency,url,supplement});
    const hash=d.hash||createHash('sha256').update(d.text).digest('hex');collected.push(...parsed.reports.map(r=>({...r,hash})));
    if(page*size>=parsed.count||parsed.hasOlder||!parsed.reports.length)break;
    if(page>=30)throw Error('CafeF phân trang vượt giới hạn an toàn; cần kiểm tra số lượng kỳ.');
    page++;await pause(200);
   }
   if(!collected.length){empty++;db.prepare('INSERT OR REPLACE INTO series_status VALUES(?,?,?,?,?,?,?,?,?)').run(symbol,kind,frequency,'empty',0,null,null,new Date().toISOString(),'CafeF chưa trả dữ liệu từ năm 2016; giữ bản đã lưu nếu có.');continue;}
   const delta=storeSeries(db,{symbol,kind,frequency,reports:collected});for(const key of Object.keys(changes))changes[key]+=delta[key];
   seriesWithData++;const periods=collected.map(r=>r.period).sort();db.prepare('INSERT OR REPLACE INTO series_status VALUES(?,?,?,?,?,?,?,?,?)').run(symbol,kind,frequency,'success',collected.length,periods[0],periods.at(-1),new Date().toISOString(),`Đã kiểm tra nguồn: ${delta.added} bảng mới, ${delta.revised} điều chỉnh, ${delta.unchanged} không đổi, ${delta.removed} không còn trong phản hồi nguồn. Kỳ thiếu không thay bằng 0.`);
  }catch(e){errors.push(kind+' '+frequency+': '+e.message);db.prepare('INSERT OR REPLACE INTO series_status VALUES(?,?,?,?,?,?,?,?,?)').run(symbol,kind,frequency,'error',0,null,null,new Date().toISOString(),e.message);}
  finally{progress.done++;updateJobs();await pause(200);}
 }
 const summary=`Đã kiểm tra 7 nhóm dữ liệu: ${seriesWithData} nhóm có số liệu, ${empty} nhóm CafeF chưa có dữ liệu từ 2016. ${changes.added} bảng mới, ${changes.revised} điều chỉnh, ${changes.unchanged} không đổi, ${changes.removed} không còn trong phản hồi nguồn.`;
 const message=summary+(errors.length?'\n'+errors.join('\n'):'');
 const state=errors.length?(seriesWithData||empty?'partial':'error'):seriesWithData?'success':'empty';
 db.prepare('UPDATE runs SET finished=?,status=?,message=? WHERE id=?').run(new Date().toISOString(),state,message,run);jobs.error=errors.length?message:null;
 }catch(e){db.prepare('UPDATE runs SET finished=?,status=?,message=? WHERE id=?').run(new Date().toISOString(),'error',e.message,run);throw e;}
 finally{
  const result=db.prepare('SELECT status,message,finished FROM runs WHERE id=?').get(run);
  db.prepare('UPDATE batch_items SET status=?,message=?,updated=? WHERE symbol=? AND batch=(SELECT max(id) FROM batches)').run(result.status,result.message,result.finished,symbol);
  db.prepare("UPDATE batches SET finished=? WHERE finished IS NULL AND NOT EXISTS(SELECT 1 FROM batch_items WHERE batch=batches.id AND status IN ('pending','running'))").run(new Date().toISOString());
  active.delete(symbol);updateJobs();
 }
}
export function getReport(symbol,kind,frequency){
 const reps=db.prepare('SELECT payload,updated FROM reports WHERE symbol=? AND kind=? ORDER BY period DESC').all(symbol,kind).map(r=>({...JSON.parse(r.payload),updated:r.updated})).filter(r=>frequency==='year'?!r.period.includes('Q'):r.period.includes('Q'));
 for(const r of reps){
  r.issues=integrity(r);
  const mappingIssue=r.issues.some(x=>/mã và nhãn|mã 270|nhãn\/mã/i.test(x));
  // User authorized temporarily using CafeF as published for these two quarters.
  r.provisional=mappingIssue&&r.source==='CafeF'&&!r.mappingVerified&&['2026-Q1','2026-Q2'].includes(r.period);
  r.mappingBlocked=mappingIssue&&!r.provisional&&!r.mappingVerified;
  if(r.provisional)r.issues.unshift('Số CafeF tạm dùng theo yêu cầu: giữ số và nhãn nguồn, chưa xác minh lại ánh xạ chỉ tiêu.');
  const checks=db.prepare('SELECT * FROM checks WHERE symbol=? AND kind=? AND period=?').all(symbol,kind,r.period);
  for(const row of r.rows){if(kind==='CafeFRatios')row.unit=publishedUnit(row.code);row.display=r.adapter==='cafef-api-2026'?(row.unit==='VND'?moneyDisplay(row.value,kind):row.unit==='VND/share'?shareDisplay(row.value,row.templateCode):kind==='CafeFRatios'?shareDisplay(row.value,'ratio'):row.sourceZero?null:row.value):row.unit==='VND'?billions(row.value):row.value;row.checks=checks.filter(c=>c.code===row.code);row.status=!row.checks.length?'single':row.checks.every(c=>c.value===row.value)?'matched':'conflict';if(r.issues.length){row.status=r.mappingBlocked?'invalid':'warning';if(r.mappingBlocked)row.display=null;}}
 }
 if(reps.length){const latest=db.prepare("SELECT max(period) p FROM reports WHERE symbol=? AND period LIKE '%-Q%'").get(symbol).p;const maxYear=frequency==='year'?new Date().getFullYear()-1:+(latest||reps[0].period).slice(0,4);const maxIndex=frequency==='year'?maxYear:maxYear*4+(+(latest||'0000-Q4').slice(-1))-1;const start=frequency==='year'?2016:2016*4;for(let i=start;i<=maxIndex;i++){const p=frequency==='year'?String(i):Math.floor(i/4)+'-Q'+(i%4+1);if(!reps.some(r=>r.period===p))reps.push({symbol,kind,period:p,source:'Chưa có',missing:true,issues:[],rows:reps[0].rows.map(r=>({...r,value:null,display:null,status:'single',checks:[]}))});}reps.sort((a,b)=>b.period.localeCompare(a.period));}
 return reps;
}
export function integrity(r){
 if(!r.mappingVerified&&r.symbol==='HPG'&&Number(r.period?.slice(0,4))>=2026)return ['Mã và nhãn của bảng CafeF cũ chưa được ánh xạ với mẫu báo cáo HPG năm 2026 đã kiểm tra trong PDF chính thức.'];
 const val=code=>r.rows.find(x=>x.code===code)?.value;
 const check=(codes,fn,message)=>codes.every(c=>val(c)!=null&&/^-?\d+$/.test(val(c)))&&!fn(...codes.map(c=>BigInt(val(c))))?message:null;
 // These tests are only applicable when the provider presents the general-enterprise codes.
 if(r.kind==='BSheet'&&/TỔNG CỘNG TÀI SẢN/i.test(r.rows.find(x=>x.code==='270')?.label||''))return [check(['100','200','270'],(a,b,c)=>a+b===c,'Tài sản ngắn hạn + dài hạn không bằng tổng tài sản (mã 270). Có thể nguồn dùng nhãn/mã cũ cho mẫu mới.'),check(['270','440'],(a,b)=>a===b,'Tổng tài sản khác tổng nguồn vốn.')].filter(Boolean);
 if(r.kind==='IncSta'&&/doanh thu thuần/i.test(r.rows.find(x=>x.code==='10')?.label||''))return [check(['01','02','10'],(a,b,c)=>a-b===c,'Doanh thu thuần không khớp doanh thu trừ giảm trừ.'),check(['10','11','20'],(a,b,c)=>a-b===c,'Lợi nhuận gộp không khớp doanh thu thuần trừ giá vốn.'),check(['50','51','52','60'],(a,b,c,d)=>a-b-c===d,'Lợi nhuận sau thuế không khớp lợi nhuận trước thuế trừ thuế.')].filter(Boolean);
 if(r.kind.startsWith('CashFlow'))return [check(['20','30','40','50'],(a,b,c,d)=>a+b+c===d,'Tổng dòng tiền ba hoạt động không khớp lưu chuyển thuần.'),check(['50','60','61','70'],(a,b,c,d)=>a+b+c===d,'Tiền cuối kỳ không khớp tiền đầu kỳ + biến động + tỷ giá.')].filter(Boolean);
 return [];
}

