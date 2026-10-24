import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mergeSteel,emptySteel,steelIndicators,steelQuality,combineSteelSeries,selectSteelSeries,referenceSteelSeries,cumulativeSteelReferences,steelDocumentIndex} from './steel-data.mjs';
import {reviewedSeries,parseVsaExpanded,isVsaIndustryPost,parseWorldsteel,worldsteelLinks,vnsteelReportLinks} from './steel-reviewed.mjs';
const review=JSON.parse(fs.readFileSync(new URL('./steel-reviewed.json',import.meta.url)));
const seed=JSON.parse(fs.readFileSync(new URL('./steel-seed.json',import.meta.url)));

test('Four workbooks preserve 2026 quarters, verified NKG scope and quarantine invalid historical claims',()=>{
 const rows=seed.series.filter(s=>s.id.startsWith('four.')),points=rows.flatMap(s=>s.observations);
 assert.equal(points.length,seed.sources.workbook_four.observations);
 assert.equal(seed.sources.workbook_four.files.length,4);
 const find=(entity,product,metric,freq)=>rows.find(s=>s.entity===entity&&s.product===product&&s.metric===metric&&s.frequency===freq&&s.label.includes(entity==='NKG'?'Rồng Việt':'Vận hành HPG'));
 assert.equal(find('NKG','coated','sales','quarter').observations.find(o=>o.period==='2026-Q2').value,203050);
 assert.equal(find('NKG','coated','asp_export','quarter').observations.find(o=>o.period==='2026-Q2').value,21140);
 assert.ok(find('NKG','coated','asp_export','quarter').observations.every(o=>o.estimated&&o.evidenceUrl.includes('NKG_20261005')));
 assert.equal(find('HPG','hrc','sales','quarter').observations.find(o=>o.period==='2026-Q2').value,1924872);
 assert.equal(find('HPG','coated','production','quarter').observations.find(o=>o.period==='2025-Q4').raw.corroboratingFiles.length,1);
 assert.ok(!rows.filter(s=>s.entity==='NKG').flatMap(s=>s.observations).some(o=>o.period==='2021-Q4'));
 assert.ok(!rows.filter(s=>s.entity==='NKG'&&s.metric.startsWith('asp_')).flatMap(s=>s.observations).some(o=>o.period==='2020-Q1'));
 assert.ok(!points.some(o=>o.period==='2026-Q3'||o.period==='2026-Q4'));
 assert.ok(!points.some(o=>o.raw.sheet==='XNK toàn ngành'));
 for(const s of rows){assert.equal(new Set(s.observations.map(o=>o.period)).size,s.observations.length);for(const o of s.observations){assert.ok(Number.isFinite(o.value));assert.match(o.raw.sha256,/^[a-f0-9]{64}$/);}}
 const coal=rows.filter(s=>s.product==='coking_coal').flatMap(s=>s.observations);assert.ok(coal.every(o=>!/^=I\d+$/.test(o.raw.formula||'')));
 const trade=rows.filter(s=>s.metric==='import_value');assert.ok(trade.every(s=>s.product==='steel_articles'&&s.unit==='USD'&&s.observations.every(o=>o.value===o.raw.originalValue*1000)));
 const derived=steelIndicators(rows);assert.ok(!derived.some(s=>s.product==='steel_unspecified'));assert.ok(!derived.some(s=>s.entity==='NKG'&&s.metric==='sales_domestic'));
 assert.equal(selectSteelSeries(rows,{source:'four',entity:'NKG',frequency:'quarter',tab:'company'}).length,rows.filter(s=>s.entity==='NKG'&&s.frequency==='quarter').length);
 assert.ok(selectSteelSeries(rows,{source:'online',entity:'all',tab:'coverage'}).length===0);
 assert.ok(selectSteelSeries(rows,{entity:'industry',tab:'prices'}).every(s=>s.metric==='price'));
});
test('Second workbook imports actual annual data, preserves gaps and exposes independent discrepancies',()=>{
 const rows=seed.series.filter(s=>s.observations.some(o=>o.source==='workbook-industry'));
 assert.equal(rows.flatMap(s=>s.observations).length,373);
 assert.ok(rows.every(s=>s.frequency==='year'&&s.observations.every(o=>o.period>='2016'&&o.period<='2024')));
 const pipeExports=rows.find(s=>s.product==='pipe'&&s.metric==='exports'&&s.entity==='NKG');
 assert.equal(pipeExports.observations.length,6);
 assert.ok(!pipeExports.observations.some(o=>o.period==='2024'));
 const nkg=rows.find(s=>s.product==='coated_pipe'&&s.entity==='NKG'&&s.metric==='sales').observations.find(o=>o.period==='2024');
 assert.equal(nkg.value,1012794);assert.ok(nkg.conflict);
 assert.equal(nkg.alternatives.find(a=>a.source==='nkg-official').value,1022794);
 assert.equal(seed.sources.workbook_industry.validation.matchingChecks,184);
});
test('Backfill covers all 2024 months without fabricating unresolved 2026 values',()=>{
 const q=steelQuality(seed,'2024-01','2024-12');
 for(const p of ['construction','hrc','coated','pipe'])for(const metric of ['production','sales','vsa_exports'])
  assert.equal(q.find(x=>x.product===p&&x.metric===metric).count,12);
 const months=seed.series.filter(s=>s.product==='hrc'&&s.metric==='production'&&s.frequency==='month'&&s.basis==='reviewed-vsa').flatMap(s=>s.observations);
 assert.equal(months.find(o=>o.period==='2026-06').value,1019576);
 assert.ok(!months.some(o=>o.period==='2026-09'));
 const vn=seed.series.find(s=>s.product==='hrc'&&s.basis==='reviewed-2mm-cfr-vietnam');
 const sea=seed.series.find(s=>s.product==='hrc'&&s.basis==='reviewed-sae1006-cfr-se-asia'&&s.frequency==='month');
 assert.notEqual(vn.id,sea.id);
 assert.equal(vn.observations.find(o=>o.period==='2026-05').value,611.3);
});
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
// Completion checks use archived source facts and assert that reconciliation
// affects the combined view only, never the original workbook values.
import {reconciledSteelSeries,latestClosedMonth,growthAt} from './steel-data.mjs';
import {parseVsaHistoricalTotals} from './steel-reviewed.mjs';
import {parseVsa} from './steel-data.mjs';

test('reconciliation audit keeps all original conflicts and separates checked values from unexplained causes',()=>{
 const w=seed.sources.workbook_four,a=w.audit;
 assert.equal(a.volumeCases,281);assert.equal(w.comparisons.length,283);
 assert.equal(a.sourceChecked+a.rounded+a.needsSource,a.volumeCases);
 const q1=w.comparisons.filter(c=>c.period>='2025-01'&&c.period<='2025-03');
 assert.equal(q1.length,12);assert.ok(q1.every(c=>c.review.status==='source-checked'&&c.review.selected.hash.length===64&&c.review.selected.page));
 const march=q1.find(c=>c.period==='2025-03'&&c.metric==='sales'&&c.product==='all_steel');
 assert.equal(march.other,3021000);assert.equal(march.review.selected.value,3021475);assert.equal(march.review.difference,1406);
 assert.ok(w.comparisons.filter(c=>c.metric==='price').every(c=>!c.review.selected&&!c.review.causeResolved));
 assert.ok(w.comparisons.every(c=>c.review.causeResolved===false));
});

test('rounded VSA totals cannot outrank exact tables, including restored legacy snapshots',()=>{
 const p={slug:'tinh-hinh-thi-truong-thep-viet-nam-thang-3-2025',link:'https://vsa.com.vn/test/',date:'2025-04-20',title:{rendered:'Thị trường thép tháng 3/2025'},content:{rendered:'Tháng 3/2025: Bán hàng thép thành phẩm đạt 3,021 triệu tấn.'}};
 const parsed=parseVsa(p,'2026-10-22T00:00:00Z');
 assert.equal(parsed[0].observations[0].approximate,true);
 const legacy=structuredClone(parsed);delete legacy[0].observations[0].approximate;
 const restored=mergeSteel(emptySteel(),legacy,{now:'2026-10-22T00:00:00Z'});
 assert.equal(restored.series[0].observations[0].approximate,true);
 const combined=combineSteelSeries(seed.series).find(s=>s.id==='all_steel.sales.combined');
 assert.equal(combined.observations.find(o=>o.period==='2025-03').value,3021475);
 assert.equal(combined.observations.find(o=>o.period==='2026-07').approximate,true);
});

test('new July and August observations retain declared rounding and benchmark limits',()=>{
 const iron=seed.series.find(s=>s.basis==='reviewed-iron-cfr-china-unspecified-grade');
 assert.equal(iron.unit,'USD/dmt');assert.deepEqual(iron.observations.map(o=>[o.period,o.value]),[['2026-07',98.7],['2026-08',97.1]]);
 assert.ok(iron.scope.includes('không ghi rõ hàm lượng Fe'));
 assert.ok(iron.observations.every(o=>o.approximate));
 const hrc=steelQuality(seed,'2025-01','2025-12').find(s=>s.product==='hrc'&&s.metric==='production');
 assert.ok(hrc.rounded.includes('2025-04'));assert.ok(hrc.missing.includes('2025-04'));
});
test('company reconciliation preserves raw workbook and uses documented annual totals',()=>{
 const d=JSON.parse(fs.readFileSync(new URL('./steel-seed.json',import.meta.url))),snapshot=JSON.stringify(d.series);
 const view=reconciledSteelSeries(d.series,d.reconciliations);
 const at=(product,entity,period)=>view.find(s=>s.id===`${product}.sales.reconciled.year.${entity}`).observations.find(o=>o.period===period);
 assert.equal(at('coated','HPG','2024').value,446411);
 assert.equal(at('pipe','HPG','2024').value,708191);
 assert.equal(at('coated_pipe','HPG','2024').value,1154602);
 assert.equal(at('coated_pipe','NKG','2024').value,1022794);
 assert.equal(at('coated_pipe','NKG','2025').value,781506);
 assert.equal(at('coated','HSG','2024').inputs.length,12);
 assert.equal(JSON.stringify(d.series),snapshot);
 assert.ok(at('coated','HPG','2024').alternatives.some(o=>o.value===424647));
});
test('rounded thresholds do not fill exact monthly coverage or produce a growth percentage',()=>{
 const d=JSON.parse(fs.readFileSync(new URL('./steel-seed.json',import.meta.url)));
 const r=steelQuality(d,'2025-01','2025-12').find(r=>r.product==='hrc'&&r.metric==='sales');
 assert.ok(r.missing.includes('2025-04'));assert.ok(r.rounded.includes('2025-04'));assert.equal(r.count,11);
 assert.equal(latestClosedMonth(new Date('2026-10-21T00:00:00Z')),'2026-09');
 assert.equal(growthAt([{period:'2025-03',value:800000},{period:'2025-04',value:765000,approximate:true}],'2025-04',1),null);
});
test('VSA historical parser refuses cumulative-only titles and malformed leading digits',()=>{
 const p={slug:'thi-truong-thep-viet-nam',link:'https://vsa.com.vn/example/',date:'2020-12-01',title:{rendered:'Thị trường thép tháng 11/2020'},content:{rendered:'<p>Bán hàng thép các loại đạt 2.455.845 tấn.</p><p>Tính chung 11 tháng: Bán hàng thép các loại đạt 21.016.002 tấn.</p>'}};
 assert.equal(parseVsaHistoricalTotals(p)[0].observations[0].value,2455845);
 assert.deepEqual(parseVsaHistoricalTotals({...p,title:{rendered:'Thị trường thép 11 tháng đầu năm 2020'}}),[]);
 assert.deepEqual(parseVsaHistoricalTotals({...p,content:{rendered:'Bán hàng thép các loại đạt 043.799 tấn'}}),[]);
});

test('reference view fills with attributed inputs, preserves raw data and source precedence',()=>{
 const before=JSON.stringify(seed),r=referenceSteelSeries(seed.series,{to:'2026-09'});
 const s=r.find(s=>s.product==='construction'&&s.metric==='production'&&s.basis==='reference');
 const april=s.observations.find(o=>o.period==='2025-04');assert.equal(april.cumulativeDerived,true);assert.equal(april.scopeUnverified,true);
 assert.equal(april.value,1265516);assert.equal(april.value,april.inputs.reduce((n,o)=>n+o.value*o.coefficient,0));
 assert.equal(growthAt(s.observations,'2025-04',1),null);
 assert.equal(s.observations.find(o=>o.period==='2026-09').modelEstimated,true);
 assert.equal(s.observations.find(o=>o.period==='2026-09').inputs.length,3);
 assert.ok(s.observations.some(o=>o.provisional&&o.raw.cell&&o.source==='workbook-four'));
 assert.equal(s.observations.find(o=>o.period==='2024-03').modelEstimated,undefined);
 assert.equal(JSON.stringify(seed),before);
 assert.equal(r.filter(s=>s.product==='hrc'&&s.basis==='reference').flatMap(s=>s.observations).filter(o=>o.provisional&&o.period<'2018-01').length,0);
 assert.equal(r.filter(s=>s.basis==='trade'||s.metric==='price').flatMap(s=>s.observations).filter(o=>o.modelEstimated).length,0);
});
test('estimates never recursively extend a sparse series or imply growth',()=>{
 const base={id:'pipe.sales.vsa',product:'pipe',metric:'sales',basis:'vsa',unit:'tấn',observations:[{period:'2025-01',value:100,url:'https://vsa.com.vn/a',source:'vsa'},{period:'2025-02',value:200,url:'https://vsa.com.vn/a',source:'vsa'},{period:'2025-03',value:300,url:'https://vsa.com.vn/a',source:'vsa'}]};
 const r=referenceSteelSeries([base],{from:'2024-01',to:'2026-09'})[0];
 assert.deepEqual(r.observations.filter(o=>o.modelEstimated).map(o=>[o.period,o.value]),[['2025-04',200],['2025-05',200],['2025-06',200]]);
 assert.equal(growthAt(r.observations,'2025-04',1),null);
 assert.ok(!r.observations.some(o=>o.period<'2025-01'||o.period>'2025-06'));
 const sparse={...base,observations:[base.observations[0],{...base.observations[2],period:'2026-09'}]};
 assert.equal(referenceSteelSeries([sparse],{to:'2026-09'})[0].observations.length,2);
 assert.equal(referenceSteelSeries([base],{to:'2026-09',estimates:false})[0].observations.length,3);
});
test('new VSA images retain historical versions, monthly vs cumulative and arithmetic',()=>{
 const src=seed.series.find(s=>s.product==='construction'&&s.metric==='sales'&&s.basis==='reviewed-vsa'&&s.frequency==='month');
 const feb=src.observations.find(o=>o.period==='2016-02');assert.equal(feb.value,459064);assert.ok(feb.revisions.some(o=>o.value===505518&&o.evidenceUrl.endsWith('/8.png')));
 const p=seed.series.find(s=>s.product==='pipe'&&s.metric==='production'&&s.basis==='reviewed-vsa'&&s.frequency==='month').observations.find(o=>o.period==='2015-02');assert.equal(p.value,61107);
 const c=seed.series.find(s=>s.product==='coated'&&s.metric==='sales'&&s.basis==='reviewed-vsa'&&s.frequency==='month').observations.find(o=>o.period==='2015-03');assert.equal(c.value,158038);assert.equal(c.kind,'calculated');assert.equal(c.inputs.reduce((n,o)=>n+o.value,0),c.value);
 assert.deepEqual(seed.completionAudit.fillResearch.annualChecks.map(r=>r.difference),[-10201,19841,14309]);
 assert.ok(seed.sources.workbook_four.comparisons.find(c=>c.period==='2016-02').review.earlierReference);
 assert.equal(seed.series.flatMap(s=>s.observations).filter(o=>o.modelEstimated).length,0);
});

test('cumulative references never claim a monthly actual or use rounded/workbook inputs',()=>{
 const obs=(period,value)=>({period,value,source:'vsa',url:'https://vsa.com.vn/'+period});
 const monthly={id:'pipe.production.vsa',product:'pipe',metric:'production',unit:'tấn',basis:'vsa',frequency:'month',observations:[obs('2025-01',10),obs('2025-03',30)]};
 const ytd={...monthly,id:'pipe.production.reviewed-vsa.ytd',basis:'reviewed-vsa',frequency:'ytd',observations:[obs('2025-03',60)]};
 const result=cumulativeSteelReferences([monthly,ytd]);assert.equal(result[0].observations[0].value,20);assert.equal(result[0].observations[0].period,'2025-02');assert.ok(result[0].observations[0].scopeUnverified);
 for(const overrides of [{approximate:true},{source:'workbook'},{scopeUnverified:true}])assert.equal(cumulativeSteelReferences([monthly,{...ytd,observations:[{...ytd.observations[0],...overrides}]}]).length,0);
 assert.equal(cumulativeSteelReferences([{...monthly,observations:[monthly.observations[0]]},ytd]).length,0);
 assert.equal(cumulativeSteelReferences([monthly,{...ytd,observations:[obs('2025-03',30)]}]).length,0);
 const actual={...monthly,observations:[...monthly.observations,obs('2025-02',25)]};
 assert.equal(referenceSteelSeries([actual,ytd],{to:'2025-03'}).find(s=>s.basis==='reference').observations.find(o=>o.period==='2025-02').value,25);
 assert.ok(!referenceSteelSeries([monthly,ytd],{to:'2025-09'}).find(s=>s.basis==='reference').observations.some(o=>o.period>'2025-03'));
});

test('new primary and attributed observations preserve frequency, scope and source precision',()=>{
 const w=seed.series.filter(s=>s.basis==='reviewed-worldsteel');assert.equal(w.length,2);
 assert.deepEqual(w.find(s=>s.frequency==='month').observations.map(o=>[o.period,o.value,o.approximate]),[['2026-07',2700000,true],['2026-08',2700000,true],['2026-09',2600000,true]]);
 const nkg=seed.series.filter(s=>s.basis==='reviewed-cafef-nkg');assert.equal(nkg.length,2);assert.ok(nkg.every(s=>s.entity==='NKG'&&s.product==='steel_unspecified'&&s.observations[0].qualifier==='>'));
 for(const p of ['2016-06','2016-09']){const c=seed.sources.workbook_four.comparisons.find(c=>c.period===p&&c.product==='construction');assert.equal(c.review.cumulativeReference.value,c.file);assert.equal(c.review.causeResolved,false);}
 assert.equal(seed.series.flatMap(s=>s.observations).filter(o=>o.cumulativeDerived).length,0);
});

test('Worldsteel parses only Vietnam, closed periods, million-tonne units and verified releases',()=>{
 const url='https://worldsteel.org/media/press-releases/2026/september-2026-crude-steel-production/',checkedAt='2026-10-24T09:00:00Z';
 const html='<h1>September 2026 crude steel production</h1><p>23 October 2026 Brussels, Belgium</p><table><tr><th>Sep 2026 (Mt)</th><th>Jan-Sep 2026 (Mt)</th></tr><tr><td>China</td><td>73.6</td><td>0.1</td><td>724.8</td><td>-2.9</td></tr><tr><td>Viet Nam</td><td>2.6</td><td>29.1</td><td>23.2</td><td>29.1</td></tr></table>';
 const rows=parseWorldsteel(html,{url,checkedAt});assert.deepEqual(rows.map(s=>[s.frequency,s.observations[0].value]),[['month',2600000],['ytd',23200000]]);assert.ok(rows.every(s=>s.observations[0].approximate&&s.observations[0].hash.length===64));
 for(const altered of [html.replaceAll('(Mt)','(kt)'),html.replace('<td>Viet Nam</td>','<td>Thailand</td>'),html.replace('<td>2.6</td>','<td>n/a</td>'),html.replace('23 October','25 October'),html.replace('<h1>September','<h1>August')])assert.throws(()=>parseWorldsteel(altered,{url,checkedAt}));
 assert.throws(()=>parseWorldsteel(html,{url,checkedAt:'2026-09-30T00:00:00Z'}));
 const aug=url.replaceAll('september','august');assert.deepEqual(worldsteelLinks(`<a href="${aug}">Aug</a><a href="${url}">Sep</a><a href="${url}">dup</a><a href="${url.replace('worldsteel.org','example.com')}">bad</a>`,url,checkedAt),[url,aug]);
 assert.deepEqual(worldsteelLinks(`<a\nhref=${url} class=stretched-link>Read more</a>`,url,checkedAt),[url]);
});

test('October research preserves observed prices, company scope and cumulative history',()=>{
 const point=(id,period)=>seed.series.find(s=>s.id===id).observations.find(o=>o.period===period);
 assert.equal(point('hrc.price.reviewed-2mm-cfr-vietnam.month','2026-09').value,542.5);
 assert.equal(point('coking_coal.price.reviewed-plv-hcc-fob-australia.month','2026-08').value,224.8);
 assert.equal(point('iron.price.reviewed-62fe-cfr-north-china.month','2026-09').value,98.6);
 assert.equal(point('construction.production.reviewed-vsa.ytd','2018-04').value,3195340);
 const company=seed.series.find(s=>s.basis==='reviewed-vnsteel-company');assert.equal(company.entity,'TVN');assert.equal(company.frequency,'ytd');assert.equal(company.observations[0].value,3460000);assert.equal(company.observations[0].approximate,true);
 assert.equal(seed.completionAudit.oct24Research.newStoredPoints,103);
});

test('latest source additions keep PSI cumulative labels separate and preserve July prices',()=>{
 const july=seed.series.find(s=>s.id==='hrc.price.reviewed-2mm-cfr-vietnam.month').observations.find(o=>o.period==='2026-07');
 assert.equal(july.value,531.2);assert.match(july.scope,/2 mm CFR/);assert.equal(july.kind,'reported-average');
 const psi=seed.series.filter(s=>s.basis==='reviewed-psi-vsa');assert.equal(psi.flatMap(s=>s.observations).length,28);assert.ok(psi.every(s=>['ytd','quarter'].includes(s.frequency)));
 assert.ok(psi.flatMap(s=>s.observations).every(o=>o.approximate&&o.raw.page&&o.url.includes('#page=')));
 assert.equal(psi.find(s=>s.product==='hrc'&&s.metric==='production').observations.find(o=>o.period==='2026-07').value,6400000);
 assert.equal(seed.completionAudit.oct25Research.newStoredPoints,57);
 assert.ok(!seed.series.filter(s=>s.product==='all_steel'&&s.frequency==='ytd').flatMap(s=>s.observations).some(o=>o.period==='2018-05'&&[6698893,1568826].includes(o.value)));
});

test('old snapshot restoration cannot reintroduce the unresolved July 2018 total scope',()=>{
 const old={id:'all_steel.sales.vsa',product:'all_steel',metric:'sales',basis:'vsa',unit:'tấn',observations:[{period:'2018-07',value:1521096,source:'vsa',url:'https://vsa.com.vn/tinh-hinh-thi-truong-thep-viet-nam-thang-7-2018-va-7-thang-nam-2018/'}]};
 const data=mergeSteel(emptySteel(),[old]);assert.equal(data.series.find(s=>s.id===old.id).observations.length,0);
 const moved=data.series.find(s=>s.product==='steel_unspecified');assert.equal(moved.observations[0].value,1521096);assert.equal(moved.observations[0].scopeUnverified,true);
 const again=mergeSteel(data,[old]);assert.equal(again.series.flatMap(s=>s.observations).length,1);assert.equal(again.series.find(s=>s.id===old.id).observations.length,0);
});

test('document review status counts attributed active source points, not Excel or estimates',()=>{
 const url='https://example.org/report.pdf',series=[{id:'p',frequency:'ytd',observations:[{period:'2026-07',value:1,url:url+'#page=3',evidenceUrl:url,source:'vsa'},{period:'2026-08',value:2,url,source:'vietledger-model',modelEstimated:true},{period:'2026-09',value:3,url,source:'workbook-four'}]}];
 const docs=steelDocumentIndex({documents:[{url,title:'Reviewed'},{url:'https://example.org/new',extractedPoints:99}],series});
 assert.equal(docs[0].extractedPoints,1);assert.equal(docs[0].reviewStatus,'has-data');assert.equal(docs[0].firstPeriod,'2026-07');assert.deepEqual(docs[0].frequencies,['ytd']);assert.equal(docs[1].reviewStatus,'pending');assert.equal(docs[1].extractedPoints,0);
 const mixed=steelDocumentIndex({documents:[{url}],series:[...series,{id:'q',frequency:'quarter',observations:[{period:'2026-Q2',value:1,url,source:'vsa'}]}]})[0];assert.equal(mixed.firstPeriod,'2026-Q2');assert.equal(mixed.lastPeriod,'2026-07');
});

test('VNSTEEL discovery keeps only observed monthly reports on the official host',()=>{
 const path='/tin-thi-truong-thep/tieu-thu-thep-7662.html',title='Tiêu thụ thép thành phẩm 9 tháng 2026 của VNSTEEL';
 const html=`<a href="${path}">${title}</a><a href="${path}">${title}</a><a href="https://evil.test${path}">${title}</a><a href="${path}?redirect=other">${title}</a><a href="/tin-thi-truong-thep/gia-123.html">Giá HRC tháng 9</a>`;
 assert.deepEqual(vnsteelReportLinks(html),[{url:'https://www.vnsteel.vn'+path,title,source:'vnsteel'}]);
});
