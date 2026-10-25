// Fast industry-only publishing. All financial assets remain byte-for-byte unchanged.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const BASE='https://vietledger.pages.dev/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const volatile=new Set(['updatedAt','checkedAt','lastAttempt','lastSuccess','lastDataChange','added','revised','hash','discoveredAt']);
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>!volatile.has(k)).map(k=>[k,canonical(value[k])]));
 return value;
}
export function steelContentSignature(data){
 // A repeated successful check must not cause another deployment of identical data.
 const {checks,tradeChecked,pdfChecked,...content}=data;
 content.series=[...(content.series||[])].sort((a,b)=>a.id.localeCompare(b.id)).map(s=>({...s,observations:[...s.observations].sort((a,b)=>a.period.localeCompare(b.period))}));
 content.documents=[...(content.documents||[])].sort((a,b)=>a.url.localeCompare(b.url));
 content.sourceErrors=Object.fromEntries(Object.entries(checks||{}).map(([k,v])=>[k,v.error||null]));
 return hash(JSON.stringify(canonical(content)));
}
export function overlayManifest(base,steel,asset,now){
 assert.match(asset,/^\/data\/[a-f0-9]{64}\.bin$/);
 const m=structuredClone(base);
 m.steel={asset,updatedAt:steel.updatedAt};m.generatedAt=now;
 m.version=hash(JSON.stringify({companies:m.companies,earningsIndex:m.earnings,analysis:m.analysis,steel:m.steel}));
 m.status={...m.status,generatedAt:now,lastFinished:m.version};
 return m;
}
const staticFiles=['404.html','analysis-data.mjs','analysis-ui.js','analysis.css','app.js','earnings-ui.js','earnings.css','earnings.mjs','financial-charts.css','financial-charts.js','financial-charts.mjs','growth-ui.js','growth.mjs','index.html','public-data.js','public-data.mjs','ratios-ui.js','ratios.css','ratios.mjs','robots.txt','steel-data.mjs','steel-four-workbooks.csv','steel-industry-workbook-source.csv','steel-reconciliation.csv','steel-ui.js','steel-workbook-source.csv','steel.css','style.css'];
async function get(name){
 assert.ok(name==='manifest.json'||staticFiles.includes(name)||/^data\/[a-f0-9]{64}\.bin$/.test(name),'Unexpected public asset path');
 for(let n=0;n<3;n++)try{
  const r=await fetch(new URL(name,BASE),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60000)});
  assert.equal(r.status,200,`HTTP ${r.status}: ${name}`);
  const b=Buffer.from(await r.arrayBuffer());assert.ok(b.length<25e6,'Asset exceeds Pages limit');
  if(name.startsWith('data/'))assert.equal(hash(b),path.basename(name,'.bin'),'Public asset hash mismatch');
  return b;
 }catch(e){if(n===2)throw e;}
}
async function main(){
 assert.equal(process.env.CI,'true','Run only in the approved GitHub workflow');
 assert.equal(process.env.PUBLIC_SITE_URL,BASE);
 assert.equal(process.env.DATA_DIR,'/tmp/vietledger-steel-fast-data');
 const out=path.resolve('release/steel-live'),receiptFile=path.resolve('release/steel-live-receipt.json');
 if(process.argv.includes('--verify-base')){
  const receipt=JSON.parse(fs.readFileSync(receiptFile));
  assert.equal(hash(await get('manifest.json')),receipt.baseManifestHash,'A newer public release exists; keep it and retry at the next scheduled run');
  console.log('Public base unchanged; safe to publish industry overlay.');return;
 }
 const bytes=await get('manifest.json'),base=JSON.parse(bytes),old=JSON.parse(gunzipSync(await get(base.steel.asset.replace(/^\//,'')),{maxOutputLength:100e6}));
 const {restoreSteel,refreshSteel}=await import('./steel-sources.mjs');
 restoreSteel(old);const steel=await refreshSteel({rapid:true});
 const changed=steelContentSignature(old)!==steelContentSignature(steel);
 fs.mkdirSync(path.dirname(receiptFile),{recursive:true});
 const receipt={checkedAt:new Date().toISOString(),changed,baseManifestHash:hash(bytes),checks:Object.fromEntries(Object.entries(steel.checks||{}).filter(([,c])=>c.lastAttempt>=old.updatedAt).map(([k,c])=>[k,{lastAttempt:c.lastAttempt,lastSuccess:c.lastSuccess,error:c.error}]))};
 fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2));
 if(!changed){if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'changed=false\n');console.log(JSON.stringify(receipt));return;}
 assert.ok(!fs.existsSync(out),'Never overwrite an existing release');fs.mkdirSync(path.join(out,'data'),{recursive:true});
 const assets=[...new Set([...base.companies.map(c=>c.asset),...Object.values(base.earnings),base.analysis.asset].map(n=>n.replace(/^\//,'')))];
 const names=[...assets,...staticFiles];let index=0;
 await Promise.all(Array.from({length:8},async()=>{while(index<names.length){const name=names[index++];fs.writeFileSync(path.join(out,name),await get(name));}}));
 const body=gzipSync(JSON.stringify(steel),{level:6}),asset='/data/'+hash(body)+'.bin';assert.ok(body.length<25e6);
 fs.writeFileSync(path.join(out,asset.slice(1)),body);
 const next=overlayManifest(base,steel,asset,new Date().toISOString());
 for(const key of ['companies','earnings','analysis','industries','research'])assert.deepEqual(next[key],base[key]);
 for(const name of assets)assert.equal(hash(fs.readFileSync(path.join(out,name))),path.basename(name,'.bin'));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(next));
 fs.writeFileSync(path.join(out,'.nojekyll'),'');
 fs.writeFileSync(path.join(out,'_headers'),"/*\n  Cache-Control: no-cache\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n  Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'\n/data/*\n  Content-Type: application/octet-stream\n  Cache-Control: public, max-age=31536000, immutable\n");
 assert.equal(hash(await get('manifest.json')),receipt.baseManifestHash,'Public site advanced during collection; discard this overlay');
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'changed=true\n');
 console.log(JSON.stringify({...receipt,financialAssetsPreserved:assets.length,steelPoints:steel.series.reduce((n,s)=>n+s.observations.length,0)}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
