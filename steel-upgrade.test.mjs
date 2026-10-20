import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mergeSteel,emptySteel,steelIndicators,steelQuality,combineSteelSeries,selectSteelSeries} from './steel-data.mjs';
import {reviewedSeries,parseVsaExpanded,isVsaIndustryPost} from './steel-reviewed.mjs';
const review=JSON.parse(fs.readFileSync(new URL('./steel-reviewed.json',import.meta.url)));
const seed=JSON.parse(fs.readFileSync(new URL('./steel-seed.json',import.meta.url)));
test('Reviewed values preserve period, page, hash, original total and explicit YTD',()=>{
 const rows=reviewedSeries(review),get=(p,m,period,f)=>rows.find(s=>s.product===p&&s.metric===m&&s.frequency===f&&s.observations[0].period===period);
 assert.equal(get('hrc','production','2026-05','month').observations[0].value,1011338);
 assert.equal(get('hrc','production','2026-05','ytd').observations[0].value,4377474);
 assert.equal(get('coated','sales','2024','year').observations[0].value,5418924);
 for(const s of rows)assert.match(s.observations[0].hash,/^[0-9a-f]{64}$/);
 const total=get('all_steel','production','2026-05','month').observations[0];
 assert.equal(total.value,3236147);assert.equal(total.raw.sumDifference,1);
 assert.ok(review.issues.some(i=>i.period==='2026-05'&&i.metric==='price'));
});
test('Revision archive survives repeat merges without duplicates',()=>{
 const s=value=>({id:'x',product:'hrc',metric:'production',observations:[{period:'2025-01',value,source:'vsa',url:'https://vsa.com.vn/source',publishedAt:value===100?'2025-02-01':'2025-03-01'}]});
 let a=mergeSteel(emptySteel(),[s(100)]);a=mergeSteel(a,[s(102)]);a=mergeSteel(a,[s(102)]);
 assert.equal(a.series[0].observations[0].revisions.length,1);assert.equal(a.series[0].observations[0].revisions[0].value,100);
 assert.equal(mergeSteel(a,[s(100)]).series[0].observations[0].value,102);
});
test('VSA cumulative articles cannot become monthly data or capture projections',()=>{
 const post={slug:'nganh-thep-viet-nam-5-thang',link:'https://vsa.com.vn/test/',date:'2026-06-12',title:{rendered:'Ngành thép Việt Nam 5 tháng đầu năm 2026'},content:{rendered:'<p>Sản xuất thép thành phẩm các loại đạt 14,91 triệu tấn.</p><p>Riêng trong tháng 5/2026, sản lượng thép thành phẩm đạt 3,24 triệu tấn. Bán hàng đạt 3,04 triệu tấn.</p><p>Dự báo sản xuất thép thành phẩm đạt 99 triệu tấn.</p>'}};
 const a=parseVsaExpanded(post,'2026-10-21T00:00:00Z');
 assert.ok(isVsaIndustryPost(post));assert.equal(a.find(s=>s.frequency==='ytd').observations[0].value,14910000);
 assert.equal(a.find(s=>s.frequency==='month'&&s.metric==='production').observations[0].value,3240000);
 assert.equal(a.find(s=>s.frequency==='month'&&s.metric==='sales').observations[0].value,3040000);
 assert.ok(a.every(s=>s.observations[0].value!==99e6));
});
test('Indicators require matching document and never treat a missing month as zero',()=>{
 const make=(metric,values)=>({id:'x.'+metric,product:'coated',metric,basis:'vsa',unit:'tấn',observations:values.map(([period,value,url='https://vsa.com.vn/a'])=>({period,value,url,source:'vsa'}))});
 const rows=[make('sales',[['2025-01',100],['2025-02',200],['2025-03',0]]),make('vsa_exports',[['2025-01',40],['2025-02',80,'https://vsa.com.vn/b'],['2025-03',0]])];
 const out=steelIndicators(rows);assert.deepEqual(out.find(s=>s.metric==='export_share').observations.map(o=>o.value),[40]);
 assert.equal(out.find(s=>s.metric==='sales_domestic').observations[0].value,60);assert.equal(out[0].observations[0].inputs.length,2);
});
test('Industry filters separate YTD, market shares, customs and indicators',()=>{
 const enriched=[...seed.series,...steelIndicators(seed.series)];
 const ytd=selectSteelSeries(enriched,{tab:'volume',frequency:'ytd',product:'hrc'});
 assert.ok(ytd.length);assert.ok(ytd.every(s=>s.frequency==='ytd'));
 const market=selectSteelSeries(enriched,{tab:'market',frequency:'ytd',entity:'NKG'});
 assert.ok(market.some(s=>s.metric==='market_share'&&s.observations.some(o=>o.period==='2026-05'&&o.value===13.9)));
 const trade=selectSteelSeries(enriched,{tab:'trade',metric:'import_value'});
 assert.ok(trade.length);assert.ok(trade.every(s=>s.unit==='USD'));
});
test('Coverage counts unique observed months, not cumulative or company records',()=>{
 const q=steelQuality(seed,'2024-01','2026-10');
 assert.equal(q.length,15);assert.ok(q.every(r=>r.total===34&&r.count+r.missing.length===34));
 assert.ok(q.find(r=>r.product==='hrc'&&r.metric==='production').count>=6);
 assert.ok(q.find(r=>r.product==='billet').missing.includes('2026-10'));
 const mixed=combineSteelSeries(seed.series).find(s=>s.id==='coated.production.combined');
 assert.ok(mixed.observations.find(o=>o.period==='2025-01').alternatives?.some(o=>o.source==='workbook'));
});
