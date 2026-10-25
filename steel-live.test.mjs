import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {steelHistoryRange} from './steel-data.mjs';
import {steelContentSignature,overlayManifest,fetchPublicAsset} from './steel-live-sync.mjs';
test('History defaults to 2016 and follows Vietnam month boundaries',()=>{
 assert.deepEqual(steelHistoryRange(new Date('2026-10-31T16:59:59Z')),{from:'2016-01',to:'2026-10'});
 assert.deepEqual(steelHistoryRange(new Date('2026-10-31T17:00:00Z')),{from:'2016-01',to:'2026-11'});
 assert.deepEqual(steelHistoryRange(new Date('2027-01-15Z'),24),{from:'2025-02',to:'2027-01'});
});
const sample=()=>({schema:1,updatedAt:'2026-10-24',series:[{id:'iron.price',observations:[{period:'2016-01',value:41.88,url:'https://example.org/report',checkedAt:'2026-10-24'}]}],documents:[],checks:{vsa:{lastAttempt:'2026-10-24',error:null}}});
test('No redeployment for check timestamps; values, source corrections and failures publish',()=>{
 const a=sample(),b=structuredClone(a);b.updatedAt='2026-10-25';b.series[0].observations[0].checkedAt='2026-10-25';b.checks.vsa.lastAttempt='2026-10-25';
 assert.equal(steelContentSignature(a),steelContentSignature(b));
 for(const mutate of [x=>x.series[0].observations[0].value++,x=>x.series[0].observations[0].url+='?revision=2',x=>x.checks.vsa.error='HTTP 503',x=>x.documents.push({url:'https://example.org/new-report'})]){const c=structuredClone(b);mutate(c);assert.notEqual(steelContentSignature(a),steelContentSignature(c));}
});
test('Industry overlay retains every financial asset and scheduler state',()=>{
 const base={companies:[{symbol:'HPG',asset:'/data/old.bin'}],earnings:{'2026Q3':'/data/q3.bin'},analysis:{asset:'/data/a.bin'},industries:{HPG:'Thép'},research:[1],status:{reports:197114,scheduler:{enabled:true}}};
 const old=structuredClone(base),next=overlayManifest(base,{updatedAt:'2026-10-25'},'/data/'+'a'.repeat(64)+'.bin','2026-10-25');
 for(const key of ['companies','earnings','analysis','industries','research'])assert.deepEqual(next[key],base[key]);
 assert.deepEqual(next.status.scheduler,base.status.scheduler);assert.deepEqual(base,old);assert.throws(()=>overlayManifest(base,{},'/../../secret','2026'));
});
test('Preserving Pages HTML uses its canonical URL and still refuses corrupt immutable assets',async()=>{
 const requests=[];
 const request=async (url,options)=>{requests.push(url.href);assert.equal(options.redirect,'error');if(url.pathname.endsWith('.html'))throw Error('unexpected redirect');return new Response(url.pathname==='/'?'<!doctype html><title>VietLedger</title>':'{}');};
 assert.match((await fetchPublicAsset('index.html',request)).toString(),/VietLedger/);
 assert.equal(requests[0],'https://vietledger.pages.dev/');
 await fetchPublicAsset('manifest.json',request);assert.ok(requests.includes('https://vietledger.pages.dev/manifest.json'));
 await assert.rejects(fetchPublicAsset('data/'+'a'.repeat(64)+'.bin',request),/hash mismatch/);
 await assert.rejects(fetchPublicAsset('../private',request),/Unexpected public asset/);
});
test('Fast collector skips large historical APIs and retains history on source errors',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'steel-fast-test-'));process.env.DATA_DIR=dir;
 const {saveSteel,refreshSteel}=await import('./steel-sources.mjs');
 const previous=sample();previous.sources={};previous.documents=[];saveSteel(previous);
 const requests=[];const got=await refreshSteel({rapid:true,download:async u=>{requests.push(u);throw Error('Fixture offline');}});
 assert.deepEqual(got.series,previous.series);assert.ok(requests.length>=5);
 assert.ok(!requests.some(u=>/worldbank|comtrade|industry.gov.au/.test(u)));
 for(const id of ['vnsteel_catalog','worldsteel','steelonline','vsa','vietnambiz'])assert.match(got.checks[id].error,/Fixture offline/);
 // Temporary test directory contains only this test's JSON files.
 assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('steel-fast-test-'));
 fs.rmSync(dir,{recursive:true,force:true});
});
