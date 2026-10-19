import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseTrade,parseVsa,mergeSteel,emptySteel,seriesDefinition,growthAt,monthRange,seriesCoverage} from './steel-data.mjs';
const context={period:'2023-01',url:'https://comtradeapi.un.org/test',checkedAt:'2026-10-19T00:00:00Z'};
const row=(cmdCode,netWgt,primaryValue,extra={})=>({period:202301,reporterCode:704,partnerCode:0,partner2Code:0,customsCode:'C00',motCode:0,flowCode:'M',cmdCode,netWgt,primaryValue,isNetWgtEstimated:false,classificationCode:'H6',...extra});
const trade=rows=>parseTrade({count:rows.length,data:rows},context);
test('Trade aggregates both construction headings and computes weighted unit value',()=>{
 const out=trade([row('7213',1000,800),row('7214',3000,2100,{isNetWgtEstimated:true})]);
 assert.equal(out.find(s=>s.metric==='imports').observations[0].value,4);
 const p=out.find(s=>s.metric==='import_price').observations[0];assert.equal(p.value,725);assert.equal(p.estimated,true);assert.deepEqual(p.raw.codes,['7213','7214']);
 assert.equal(trade([row('7213',1000,800)]).length,0);
});
test('Unavailable mass never becomes zero; absent months remain gaps',()=>{
 assert.equal(trade([row('7306',0,1234)]).length,0);assert.equal(trade([row('7306',null,1234)]).length,0);assert.equal(trade([]).length,0);
 const zero=trade([row('7306',0,0)]);assert.equal(zero.length,1);assert.equal(zero[0].observations[0].value,0);
});
test('Reject incomplete, duplicated or wrong-scope customs responses',()=>{
 assert.throws(()=>parseTrade({count:2,data:[row('7208',1000,500)]},context));
 assert.throws(()=>trade([row('7208',1000,500,{partnerCode:156})]));
 assert.throws(()=>trade([row('7208',1000,500),row('7208',1000,500)]));
});
const post=text=>({link:'https://vsa.com.vn/test/',date:'2025-07-21',title:{rendered:'Thị trường thép tháng 6/2025'},content:{rendered:text}});
test('VSA dated quotes retain the actual date; monthly means and YTD stay separate',()=>{
 const out=parseVsa(post('<p>Thép cuộn cán nóng (HRC): Giá HRC ngày 8/7/2025 ở mức 491 USD/tấn, CFR Việt Nam.</p><p>Giá HRC bình quân tháng 6/2025 ở mức 485 USD/tấn.</p><p>Giá HRC bình quân 6 tháng 2025 ở mức 490 USD/tấn.</p>'));
 assert.equal(out.length,2);assert.equal(out[0].observations[0].period,'2025-07');assert.equal(out[0].observations[0].observedAt,'2025-07-08');assert.equal(out[1].observations[0].value,485);
 assert.equal(parseVsa(post('Tính chung 6 tháng năm 2025: Sản xuất thép thành phẩm đạt 12 triệu tấn.')).length,0);
 assert.equal(parseVsa(post('Tháng 6/2025: Sản xuất thép thành phẩm đạt 2,5 triệu tấn. Tính chung 6 tháng đạt 12 triệu tấn.'))[0].observations[0].value,2500000);
});
test('Older articles cannot overwrite the latest quote in the same month',()=>{
 const point=(day,value)=>({...seriesDefinition('hrc','price','vsa-dated-cfr-vietnam'),observations:[{period:'2025-07',observedAt:'2025-07-'+day,value,url:'https://vsa.com.vn/test'}]});
 const data=mergeSteel(mergeSteel(emptySteel(),[point('20',500)]),[point('08',490)]);assert.equal(data.series[0].observations[0].value,500);
 assert.throws(()=>mergeSteel(data,[{...point('21',500),observations:[{period:'2025-13',value:3,url:'https://vsa.com.vn/'}]}]));
});
test('Growth uses exact calendar periods and never bridges a missing month',()=>{
 const ps=[{period:'2024-01',value:100},{period:'2024-03',value:120},{period:'2025-01',value:150}];assert.equal(growthAt(ps,'2024-03',1),null);assert.equal(growthAt(ps,'2025-01',12),50);assert.equal(monthRange('2015-01','2026-09').length,141);
});
test('Published seed has source-backed unique observations and explicit coverage gaps',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('./steel-seed.json',import.meta.url)));assert.equal(data.schema,1);
 for(const s of data.series){assert.equal(new Set(s.observations.map(o=>o.period)).size,s.observations.length);for(const o of s.observations){assert.ok(o.url.startsWith('https://'));assert.ok(Number.isFinite(o.value)&&o.value>=0);assert.ok(o.period>='2015-01');}}
 const ore=data.series.find(s=>s.id==='iron.price.wb');assert.equal(ore.observations[0].period,'2015-01');assert.ok(ore.observations.length>=141);assert.equal(ore.observations[0].value,68.2);
 const actual=id=>data.series.find(s=>s.id===id).observations.find(o=>o.period==='2023-08').value;
 // Visually checked against page 2 of the KIS report dated 05/10/2023.
 assert.equal(actual('coated.production.vsa'),412733);assert.equal(actual('coated.sales.vsa'),365454);assert.equal(actual('pipe.sales.vsa'),163055);assert.equal(actual('construction.vsa_exports.vsa'),155393);
 assert.equal(data.series.find(s=>s.id==='billet.production.vsa').observations.length,0);assert.ok(seriesCoverage(ore,'2026-10').missing.includes('2026-10'));
});
test('Failed source refresh preserves every saved historical point and reports failure',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vietledger-steel-test-'));process.env.DATA_DIR=dir;
 const {readSteel,refreshSteel}=await import('./steel-sources.mjs');const before=readSteel();const after=await refreshSteel({download:async()=>{throw Error('fixture offline');}});
 assert.deepEqual(after.series,before.series);assert.match(after.checks.worldbank.error,/fixture offline/);assert.ok(after.checks.worldbank.lastSuccess);
 // Only the single file produced by this isolated test is removed.
 fs.unlinkSync(path.join(dir,'steel.json'));fs.rmdirSync(dir);
});
