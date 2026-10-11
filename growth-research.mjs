import fs from 'node:fs';
import {latestEarningsPeriod,summarizeEarnings} from './earnings.mjs';
import {safeSourceUrl,researchFingerprint} from './growth.mjs';
const seeds=JSON.parse(fs.readFileSync(new URL('./growth-research.json',import.meta.url),'utf8'));
const key='earningsResearchV1';
export function readResearch(db){const stored=JSON.parse(db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value||'{}');return {...stored,...seeds};}
export function restoreResearch(db,manifest){if(manifest.research&&typeof manifest.research==='object')db.prepare('INSERT OR REPLACE INTO meta VALUES(?,?)').run(key,JSON.stringify(manifest.research));}
const text=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/\s+/g,' ').trim();
const plain=s=>text(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/đ/g,'d').toLowerCase();
export function matchDisclosure(item,symbol,period,scope){
  const t=plain(item.Title),q=period.at(-1),year=period.slice(0,4),roman={1:'i',2:'ii',3:'iii',4:'iv'}[q];
  if(!new RegExp('^'+symbol.toLowerCase()+'\\s*:').test(t)||!/(bao cao tai chinh|bctc)/.test(t)||/(ke hoach|du kien|cham|gia han|khong phai|dinh chinh|dieu chinh)/.test(t))return false;
  if(!new RegExp(`(?:quy\\s*(?:${q}|${roman})(?![iv0-9])|q${q}(?![0-9]))(?:\\s*(?:nam|tai chinh|nien do))?\\s*[/.-]?\\s*${year}(?![0-9])`).test(t))return false;
  if(scope==='consolidated')return /hop nhat/.test(t)&&!/rieng le/.test(t);
  if(scope==='separate')return /rieng le|cong ty me/.test(t)&&!/hop nhat/.test(t);
  return true;
}
export function disclosureDate(value){const n=String(value).match(/^\/Date\((\d+)(?:[+-]\d{4})?\)\/$/);if(!n)return null;const d=new Date(Number(n[1]));return Number.isFinite(+d)?d.toISOString():null;}
export function matchExplanation(item,symbol,period){
  const t=plain(item.Title),q=period.at(-1),year=period.slice(0,4),roman={1:'i',2:'ii',3:'iii',4:'iv'}[q];
  return new RegExp('^'+symbol.toLowerCase()+'\\s*:').test(t)&&/giai trinh/.test(t)&&new RegExp(`(?:quy\\s*(?:${q}|${roman})(?![iv0-9])|q${q})(?:\\s*nam)?\\s*[/.-]?\\s*${year}(?![0-9])`).test(t);
}
export function pdfAttachments(html,articleUrl){
  return [...String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>{try{const url=new URL(m[1].replace(/&amp;/g,'&'),articleUrl);return /\.pdf$/i.test(url.pathname)&&['cafef1.mediacdn.vn','cafefnew.mediacdn.vn','cafefcdn.com','cafef.vn'].includes(url.hostname)?{url:safeSourceUrl(url.href),title:text(m[2])||'Tài liệu đính kèm'}:null;}catch{return null;}}).filter(x=>x?.url);
}
export async function refreshCompanyResearch(db,symbol,reports,download,{now=new Date(),force=false}={}){
  const period=latestEarningsPeriod(now),report=reports.find(r=>r.period===period&&!r.missing);
  if(!report)return null;
  const id=`${symbol}:${period}`,all=readResearch(db),previous=all[id];
  if(seeds[id])return seeds[id];
  const signature=researchFingerprint(summarizeEarnings({symbol},reports,period));
  if(!force&&previous?.dataFingerprint===signature&&+new Date(now)-Date.parse(previous.checkedAt)<6*3600000)return previous;
  const record={...previous,symbol,period,scope:report.scope,dataFingerprint:signature,checkedAt:new Date(now).toISOString()};
  try{
    const seen=new Set();let candidates=[],explanations=[];
    for(let page=1;page<=4;page++){
      const url=`https://cafef.vn/du-lieu/Ajax/PageNew/News.ashx?Symbol=${encodeURIComponent(symbol)}&NewsType=0&PageIndex=${page}&PageSize=30`;
      const result=JSON.parse((await download(url,true)).text);
      if(!Array.isArray(result.Data))throw Error('CafeF đổi cấu trúc tin công bố.');
      const fresh=result.Data.filter(x=>!seen.has(x.LinkDetail));for(const x of fresh)seen.add(x.LinkDetail);
      candidates.push(...fresh.filter(x=>matchDisclosure(x,symbol,period,report.scope)));
      explanations.push(...fresh.filter(x=>matchExplanation(x,symbol,period)));
      if(candidates.length||fresh.length<30)break;
    }
    candidates.sort((a,b)=>Date.parse(disclosureDate(b.DeployDate))-Date.parse(disclosureDate(a.DeployDate)));
    const item=candidates[0];
    if(explanations.length){const explanation=explanations[0],u=new URL(explanation.LinkDetail,'https://cafef.vn');if(u.protocol==='https:'&&u.hostname==='cafef.vn')Object.assign(record,{explanationUrl:u.href,explanationTitle:text(explanation.Title),explanationPublishedAt:disclosureDate(explanation.DeployDate)});}
    if(item){
      const articleUrl=new URL(item.LinkDetail,'https://cafef.vn');
      if(articleUrl.protocol!=='https:'||articleUrl.hostname!=='cafef.vn')throw Error('Liên kết công bố không thuộc CafeF.');
      const html=(await download(articleUrl.href,true)).text,attachments=pdfAttachments(html,articleUrl.href);
      Object.assign(record,{articleUrl:articleUrl.href,documentTitle:text(item.Title),publishedAt:disclosureDate(item.DeployDate),attachments,sourceStatus:'found',error:null});
    }else Object.assign(record,{sourceStatus:previous?.articleUrl?'found':'pending',error:null});
  }catch(error){record.error='Chưa kiểm tra lại được nguồn báo cáo.';record.sourceStatus=previous?.articleUrl?'found':'pending';}
  // Merge just this entry: parallel company requests must not overwrite one another.
  const latest=readResearch(db);latest[id]=record;db.prepare('INSERT OR REPLACE INTO meta VALUES(?,?)').run(key,JSON.stringify(latest));
  return record;
}
