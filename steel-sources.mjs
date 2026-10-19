import fs from 'node:fs';
import path from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {emptySteel,mergeSteel,parseTrade,parseVsa,seriesDefinition,TRADE_CODES,monthRange,cleanText} from './steel-data.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const DATA=process.env.DATA_DIR||path.join(ROOT,'data');
const FILE=path.join(DATA,'steel.json');
export const WB_PAGE='https://www.worldbank.org/en/research/commodity-markets';
export const WB_FILE='https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function readSteel(){let seed=emptySteel();try{seed=JSON.parse(fs.readFileSync(path.join(ROOT,'steel-seed.json'),'utf8'));}catch{}try{const live=JSON.parse(fs.readFileSync(FILE,'utf8'));if(live.schema===1)return live;}catch{}return seed;}
export function saveSteel(data){fs.mkdirSync(DATA,{recursive:true});const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data));fs.renameSync(tmp,FILE);return data;}
export function restoreSteel(data){if(!data||data.schema!==1||!Array.isArray(data.series))throw Error('Kho dữ liệu ngành không hợp lệ');const seed=readSteel();const merged=mergeSteel(seed,data.series);const docs=new Map([...seed.documents,...(data.documents||[])].map(d=>[d.url,d]));const sources={...seed.sources,...data.sources};if(seed.sources.workbook?.importedAt>(data.sources?.workbook?.importedAt||''))sources.workbook=seed.sources.workbook;return saveSteel({...merged,sources,documents:[...docs.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)),checks:{...seed.checks,...data.checks},tradeChecked:{...seed.tradeChecked,...data.tradeChecked},pdfChecked:{...seed.pdfChecked,...data.pdfChecked}});}
// Read only the public workbook's ZIP/XML; no macros, external links or formulas execute.
function unzip(buffer){const files={};let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}if(end<0)throw Error('Invalid XLSX ZIP');let pos=buffer.readUInt32LE(end+16);for(let i=0;i<buffer.readUInt16LE(end+10);i++){if(buffer.readUInt32LE(pos)!==0x02014b50)throw Error('Invalid ZIP directory');const method=buffer.readUInt16LE(pos+10),size=buffer.readUInt32LE(pos+20),uncompressed=buffer.readUInt32LE(pos+24),nl=buffer.readUInt16LE(pos+28),el=buffer.readUInt16LE(pos+30),cl=buffer.readUInt16LE(pos+32),offset=buffer.readUInt32LE(pos+42),name=buffer.subarray(pos+46,pos+46+nl).toString();if(uncompressed>20e6)throw Error('Workbook entry too large');const start=offset+30+buffer.readUInt16LE(offset+26)+buffer.readUInt16LE(offset+28);if(name.endsWith('.xml')){const b=buffer.subarray(start,start+size);files[name]=(method===8?inflateRawSync(b,{maxOutputLength:20e6}):b).toString();}pos+=46+nl+el+cl;}return files;}
const xmlText=s=>s.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
export function parseWorldBank(buffer,{url=WB_FILE,checkedAt=new Date().toISOString()}={}){
 const files=unzip(buffer),strings=[...(files['xl/sharedStrings.xml']||'').matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t=>xmlText(t[1])).join(''));
 const candidates=Object.entries(files).filter(([n])=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n));let observations=[];
 for(const [name,xml] of candidates){const rows=[...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(row=>{const cells={};for(const c of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){const col=c[1].match(/\br="([A-Z]+)\d+"/)?.[1],v=c[2].match(/<v[^>]*>([^<]*)<\/v>/)?.[1];if(col)cells[col]=/\bt="s"/.test(c[1])?strings[Number(v)]:v??xmlText(c[2]);}return cells;});
  const head=rows.find(r=>Object.values(r).some(v=>/^Iron ore/i.test(v||'')));if(!head)continue;const col=Object.keys(head).find(k=>/^Iron ore/i.test(head[k]||''));
  const unitRow=rows[rows.indexOf(head)+1];
  const points=rows.flatMap(r=>{const p=String(r.A||'').match(/^(20\d{2})M(\d{2})$/);if(!p||p[1]<'2015')return[];const value=Number(r[col]);if(!Number.isFinite(value)||value<=0)return[];return [{period:p[1]+'-'+p[2],value,url,source:'worldbank',checkedAt,hash:sha(buffer),kind:'monthly-average',raw:{sheet:name,column:col,cellValue:r[col]},note:'World Bank Pink Sheet · giá danh nghĩa bình quân tháng, USD/tấn khô.'}];});
  if(points.length>observations.length)observations=points;
 }
 if(observations.length<120)throw Error('Không nhận diện đủ lịch sử quặng sắt World Bank.');
 const s=seriesDefinition('iron','price','wb');s.label='Quặng sắt 62% Fe · bình quân tháng';s.observations=observations.filter(o=>o.period<=checkedAt.slice(0,7));return[s];
}
export function tradeUrl(period){return `https://comtradeapi.un.org/public/v1/preview/C/M/HS?period=${period.replace('-','')}&reporterCode=704&cmdCode=${TRADE_CODES.join(',')}&flowCode=M,X&partnerCode=0&partner2Code=0&customsCode=C00&motCode=0&maxRecords=500`;}
export async function fetchSteel(url){for(let attempt=0;attempt<3;attempt++){const r=await fetch(url,{signal:AbortSignal.timeout(60000),headers:{'User-Agent':'VietLedger industry research; public-source monthly statistics'}});if(r.status===429){if(attempt===2)throw Error('Nguồn giới hạn truy cập (429); giữ số đã lưu.');const retry=Number(r.headers.get('retry-after')||5);await new Promise(resolve=>setTimeout(resolve,Math.min(60000,Math.max(3000,retry*1000))));continue;}if(!r.ok)throw Error(`HTTP ${r.status} · ${new URL(url).hostname}`);const b=Buffer.from(await r.arrayBuffer());if(b.length>20e6)throw Error('Phản hồi nguồn quá lớn');return b;}throw Error('Không đọc được nguồn');}
let busy=null;
export function refreshSteel(options={}){if(busy)return busy;busy=refresh(options).finally(()=>busy=null);return busy;}
export function pdfSeries(rows,report,checkedAt=new Date().toISOString()){
 return rows.map(row=>{const s=seriesDefinition(row.product,row.metric,'vsa');s.scope=`Số thành viên VSA, theo bảng KIS trích dẫn. ${row.product==='coated'?'Tôn mạ và sơn phủ màu.':row.product==='pipe'?'Ống thép.':'Thép xây dựng.'}`;s.observations=[{period:row.period,value:row.value,url:(report.pdfUrl||report.documentUrl)+'#page='+row.page,source:'kis-vsa',checkedAt,publishedAt:report.date,evidence:row.evidence,note:`Bảng nguồn VSA trong báo cáo KIS, trang ${row.page}. ${row.metric==='sales'?'Bán hàng gồm nội địa và xuất khẩu.':''}`}];return s;});
}
async function refresh({backfill=false,download=fetchSteel,reports=[]}={}){
 let data=readSteel();const now=new Date().toISOString();
 const sources={worldbank:{name:'World Bank · Pink Sheet',url:WB_PAGE},vsa:{name:'Hiệp hội Thép Việt Nam (VSA)',url:'https://vsa.com.vn/'},comtrade:{name:'UN Comtrade · Việt Nam / Thế giới',url:'https://comtradeplus.un.org/'}};data.sources={...data.sources,...sources};
 async function update(id,fn){const before=data.checks[id]||{};try{await fn();data.checks[id]={...before,lastAttempt:now,lastSuccess:now,error:null};}catch(e){data.checks[id]={...before,lastAttempt:now,error:String(e.message).slice(0,240)};console.warn('DATA NGÀNH',id,e.message);}saveSteel(data);}
 await update('worldbank',async()=>{const html=(await download(WB_PAGE)).toString();const found=html.match(/https:\/\/thedocs\.worldbank\.org\/[^"\s<>]+CMO-Historical-Data-Monthly\.xlsx/i)?.[0]||WB_FILE;data=mergeSteel(data,parseWorldBank(await download(found),{url:found,checkedAt:now}),{now});});
 await update('vsa',async()=>{const docs=new Map(data.documents.map(d=>[d.url,d]));for(let page=1;page<=(backfill?6:1);page++){const url=`https://vsa.com.vn/wp-json/wp/v2/posts?search=${encodeURIComponent('tháng')}&per_page=100&page=${page}`;const posts=JSON.parse((await download(url)).toString());if(!Array.isArray(posts))throw Error('Sai cấu trúc bản tin VSA');for(const p of posts){if(!/thi-truong-thep.*thang|tinh-hinh-san-xuat.*thang/.test(p.slug)||/toan-cau/.test(p.slug))continue;data=mergeSteel(data,parseVsa(p,now),{now});docs.set(p.link,{title:cleanText(p.title.rendered),url:p.link.replace(/^http:/,'https:'),publishedAt:p.date,source:'vsa',note:'Có thể gồm biểu đồ ảnh; dữ liệu chưa đọc được thành số được giữ trong tài liệu nguồn.'});}if(posts.length<100)break;}data.documents=[...docs.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));});
 if(reports.length)await update('kis',async()=>{
  data.pdfChecked||={};const candidates=reports.filter(r=>r.sourceCode==='KIS'&&/thép/i.test(r.title||'')&&(r.pdfUrl||r.documentUrl)).sort((a,b)=>b.date.localeCompare(a.date));
  const docs=new Map(data.documents.map(d=>[d.url,d]));
  for(const report of candidates.filter(r=>!data.pdfChecked[r.pdfUrl||r.documentUrl]).slice(0,backfill?30:4)){
   const url=report.pdfUrl||report.documentUrl,u=new URL(url);if(u.protocol!=='https:'||!(/(^|\.)cafef\.vn$/.test(u.hostname)||u.hostname==='cafefnew.mediacdn.vn'))continue;
   const bytes=await download(url);if(!bytes.subarray(0,8).toString().includes('%PDF-'))throw Error('Tài liệu KIS chưa phải PDF');
   const dir=path.join(DATA,'steel-raw');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,sha(bytes)+'.pdf');fs.writeFileSync(file,bytes);
   const bundled=path.join(process.env.USERPROFILE||'', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');const python=process.env.STEEL_PYTHON||(process.platform==='win32'&&fs.existsSync(bundled)?bundled:'python3');
   const parsed=JSON.parse(execFileSync(python,['-X','utf8',path.join(ROOT,'steel-pdf.py'),file],{encoding:'utf8',timeout:45000,maxBuffer:5e6,windowsHide:true}));
   data=mergeSteel(data,pdfSeries(parsed.rows,report,now),{now});data.pdfChecked[url]={checkedAt:now,hash:sha(bytes),rows:parsed.rows.length,notes:parsed.notes};
   docs.set(url,{title:report.title,url,publishedAt:report.date,source:'kis-vsa',note:parsed.rows.length?parsed.notes.join(' '):'Chưa nhận diện được bảng số tháng chắc chắn. '+parsed.notes.join(' ')});
  }
  data.documents=[...docs.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
 });
 await update('comtrade',async()=>{const all=monthRange('2015-01',now.slice(0,7)).slice(0,-1);const recent=all.slice(-6);const missing=all.filter(p=>!data.tradeChecked?.[p]);const older=all.slice(0,-6);const rotation=older.length?older[Math.floor(Date.parse(now)/86400000)%older.length]:null;const periods=backfill?all:[...new Set([...recent,...missing.slice(0,3),...(rotation?[rotation]:[])])];data.tradeChecked||={};for(const period of periods){const url=tradeUrl(period),b=await download(url);const payload=JSON.parse(b);data=mergeSteel(data,parseTrade(payload,{period,url,checkedAt:now,hash:sha(b)}),{now});data.tradeChecked[period]={checkedAt:now,count:payload.count};saveSteel(data);await new Promise(r=>setTimeout(r,1500));}});
 data.updatedAt=now;return saveSteel(data);
}
