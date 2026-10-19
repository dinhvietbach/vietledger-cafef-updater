import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseAustralia,parseSteelOnlineChart,newestReqEdition} from './steel-extra.mjs';
import {combineSteelSeries,coverageYears} from './steel-data.mjs';
import {parseTrade,parseVsa,mergeSteel,emptySteel,seriesDefinition,growthAt,monthRange,seriesCoverage,periodRange,periodLabel,selectSteelSeries} from './steel-data.mjs';
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

test('Workbook import preserves periods, source cells, product scope and missing versus zero',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('./steel-seed.json',import.meta.url)));
 const find=(product,metric,frequency='month',entity='industry',segment='total')=>data.series.find(s=>s.basis==='workbook'&&s.product===product&&s.metric===metric&&s.frequency===frequency&&s.entity===entity&&s.segment===segment&&!s.label.includes('Update KQKD'));
 const value=(s,p)=>s?.observations.find(o=>o.period===p)?.value;
 assert.equal(value(find('coated','production'),'2016-01'),261325);
 assert.equal(value(find('coated','production'),'2025-06'),434444);
 assert.equal(value(find('coated','inventory','quarter'),'2016-Q1'),150698);
 assert.equal(value(find('coated','inventory_sum','quarter'),'2016-Q1'),487193);
 assert.equal(value(find('hrc','production','quarter'),'2016-Q1'),25656);
 assert.equal(value(find('flat_steel','production','quarter'),'2016-Q1'),811049);
 assert.equal(value(find('crc','production','quarter'),'2016-Q1'),785393);
 assert.equal(value(find('iron','price'),'2017-01'),80.9);
 assert.equal(value(find('coated','inventory','month','NKG','zinc'),'2017-07'),undefined);
 assert.equal(value(find('hrc','production','quarter','HPG'),'2016-Q1'),0);
 assert.equal(value(find('construction','production','quarter','HPG','section'),'2016-Q1'),undefined);
 const imported=data.series.filter(s=>s.basis==='workbook');assert.equal(imported.reduce((n,s)=>n+s.observations.length,0),24708);
 for(const s of imported)for(const p of s.observations){assert.ok(p.raw.sheet&&p.raw.cell&&p.raw.file);assert.ok(p.value>=0);if(s.label.includes('Update KQKD'))assert.ok(p.period<='2025-Q3');}
 assert.equal(data.sources.workbook.comparisons.length,4);
 assert.equal(data.sources.workbook.validation.formulaChecks,4943);
});

test('Monthly, quarterly and annual filters and growth do not mix periods or companies',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('./steel-seed.json',import.meta.url)));
 const chosen=selectSteelSeries(data.series,{product:'hrc',frequency:'quarter',entity:'HPG',tab:'volume',source:'workbook',metric:'production'});
 assert.ok(chosen.length>0);assert.ok(chosen.every(s=>s.entity==='HPG'&&s.frequency==='quarter'&&s.product==='hrc'));
 assert.deepEqual(periodRange('2024-01','2025-06','quarter'),['2024-Q1','2024-Q2','2024-Q3','2024-Q4','2025-Q1','2025-Q2']);
 assert.equal(periodLabel('2025-Q2'),'Q2/2025');assert.equal(periodLabel('2024'),'2024');
 assert.equal(growthAt([{period:'2024-Q2',value:100},{period:'2025-Q2',value:150}],'2025-Q2',12),50);
 assert.equal(growthAt([{period:'2023',value:100},{period:'2024',value:125}],'2024',12),25);
 assert.equal(growthAt([{period:'2024-Q1',value:100},{period:'2025-Q2',value:150}],'2025-Q2',12),null);
});

test('A later workbook import survives restoration of an older public snapshot',()=>{
 const make=(value,checkedAt)=>({id:'coated.production.workbook.quarter.industry.total',product:'coated',metric:'production',basis:'workbook',frequency:'quarter',observations:[{period:'2025-Q2',value,url:'https://vietledger.pages.dev/steel-workbook-source.csv',source:'workbook',checkedAt}]});
 const newer=mergeSteel(emptySteel(),[make(30,'2026-10-20T00:00:00Z')]);
 assert.equal(mergeSteel(newer,[make(20,'2026-10-19T00:00:00Z')]).series[0].observations[0].value,30);
});

test('REQ source cells preserve units, na gaps and the 2026 Fe specification break',()=>{
 const rows=parseAustralia(fs.readFileSync(new URL('./fixtures/req-australia-extract.xlsx',import.meta.url)),{checkedAt:'2026-10-20T00:00:00Z'});
 assert.equal(rows.reduce((n,s)=>n+s.observations.length,0),524);
 const at=id=>rows.find(s=>s.id===id);
 const iron62=at('iron.price.au-iron-62fe'),iron61=at('iron.price.au-iron-61fe');
 assert.equal(iron62.observations.length,132);assert.equal(iron62.observations[0].raw.cell,'L313');assert.equal(iron62.observations[0].value,63.25419875);
 assert.equal(iron62.observations.at(-1).period,'2025-12');assert.equal(iron61.observations[0].period,'2026-01');assert.equal(iron61.observations.length,7);
 assert.equal(at('coking_coal.price.au-phcc').observations.at(-1).period,'2023-11');assert.equal(at('iron.export_price.au-unit').unit,'AUD/tấn');
 assert.throws(()=>parseAustralia(Buffer.alloc(0)));assert.throws(()=>parseAustralia(Buffer.alloc(0),{url:'https://example.com/forecast.xlsx'}));
 assert.equal(newestReqEdition('<a href="/publications/resources-and-energy-quarterly-september-2026">September</a><a href="/publications/resources-and-energy-quarterly-december-2026">Future</a>','2026-10-20'), 'https://www.industry.gov.au/publications/resources-and-energy-quarterly-september-2026');
});
test('SteelOnline quotes retain observed dates, exclude future values and never become monthly averages',()=>{
 const payload={labels:['30-09-2026','01-10-2026','19-10-2026','30-10-2026'],datasets:[{label:'Thép cuộn CB240',data:[14000,14100,14920,16000]}]};
 const s=parseSteelOnlineChart(payload,{id:12,region:'miền Bắc',checkedAt:'2026-10-20T00:00:00Z'})[0];
 assert.deepEqual(s.observations.map(o=>[o.period,o.value,o.observedAt]),[['2026-09',14000,'2026-09-30'],['2026-10',14920,'2026-10-19']]);assert.equal(s.unit,'VND/kg');assert.equal(s.observations[0].kind,'dated-quote');
 assert.throws(()=>parseSteelOnlineChart({...payload,datasets:[{label:'Unknown grade',data:[1,2,3,4]}]},{id:12}));
});
test('Combined view retains evidence conflicts and does not blend prices, customs, quarters or companies',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('./steel-seed.json',import.meta.url)));const combined=combineSteelSeries(data.series);
 const s=combined.find(s=>s.id==='coated.production.combined'),march=s.observations.find(o=>o.period==='2023-03');
 assert.equal(march.value,391798);assert.equal(march.conflict,true);assert.equal(march.alternatives[0].value,393340);
 assert.equal(s.observations.find(o=>o.period==='2016-01').source,'workbook');assert.equal(s.observations.find(o=>o.period==='2015-09').source,'vsa');assert.equal(s.observations.find(o=>o.period==='2015-10'),undefined);
 for(const raw of data.series.filter(s=>s.basis==='trade'||/price/.test(s.metric)||s.frequency==='quarter'||s.entity==='HPG'))assert.ok(combined.includes(raw));
 assert.equal(coverageYears(s,'2015-12')[0].count,1);assert.equal(coverageYears(s,'2015-12')[0].missing.length,11);
 const big=data.series.filter(s=>s.basis.startsWith('bigmint'));assert.equal(big.length,3);assert.ok(big.every(s=>s.observations[0].period==='2025-12'));
});
