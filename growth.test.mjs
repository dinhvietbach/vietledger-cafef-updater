import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {qualifiesGrowth,recentPublication,analyzeGrowth,researchFingerprint,safeSourceUrl} from './growth.mjs';
import {summarizeEarnings} from './earnings.mjs';
import {matchDisclosure,matchExplanation,pdfAttachments,disclosureDate,refreshCompanyResearch,readResearch,restoreResearch} from './growth-research.mjs';
const report=(period,revenue,profit,scope='consolidated')=>({period,kind:'IncSta',basis:'quarter',sector:'enterprise',scope,rows:[{code:'10',label:'Doanh thu thuần',unit:'VND',value:revenue},{code:'60',label:'Lợi nhuận sau thuế',unit:'VND',value:profit}]});
const summary=(a='110.004',b='120',old='100',scope='consolidated')=>summarizeEarnings({symbol:'AAA'},[report('2026-Q3',a,b,scope),report('2025-Q3',old,old)],'2026-Q3');
test('growth screen requires BOTH metrics strictly above the raw threshold, before rounding',()=>{
 assert.equal(summary().metrics.revenue.yoy.value,'10.00');assert.ok(qualifiesGrowth(summary()));
 assert.equal(qualifiesGrowth(summary('110')),false);assert.equal(qualifiesGrowth(summary('111','109')),false);
 assert.equal(qualifiesGrowth(summary('150','150'),50),false);
 for(const base of ['0','-100'])assert.equal(qualifiesGrowth(summary('120','120',base)),false);
 for(const scope of ['separate','source-unspecified'])assert.equal(qualifiesGrowth(summary('120','120','100',scope)),false);
});
test('recent publication never treats import time, unknown dates, or future dates as a new filing',()=>{
 const now='2026-10-11T12:00:00Z';
 assert.equal(recentPublication({checkedAt:now},30,now),false);
 assert.equal(recentPublication({publishedAt:'2026-04-24'},30,now),false);
 assert.equal(recentPublication({publishedAt:'2026-10-30'},30,now),false);
 assert.equal(recentPublication({publishedAt:'2026-10-10'},30,now),true);
});
test('a changed financial basis suppresses the earlier business explanation',()=>{
 const reports=[report('2026-Q3','120','120'),report('2025-Q3','100','100')],s=summarizeEarnings({symbol:'AAA'},reports,'2026-Q3');
 const record={businessNote:'Verified explanation',fingerprint:researchFingerprint(s),businessSources:[]};
 assert.equal(analyzeGrowth(s,reports,'2026-Q3',record).businessNote,'Verified explanation');
 const revised=summary('121','120');const a=analyzeGrowth(revised,reports,'2026-Q3',record);
 assert.equal(a.businessNote,null);assert.equal(a.researchStatus,'stale');
});
test('disclosure discovery rejects wrong company, period, scope and prospective announcements',()=>{
 const match=title=>matchDisclosure({Title:title},'AAA','2026-Q3','consolidated');
 assert.ok(match('AAA: Báo cáo tài chính hợp nhất quý III năm 2026'));
 assert.ok(match('AAA: BCTC hợp nhất quý 3/2026 kèm giải trình'));
 for(const t of ['AAA: BCTC riêng lẻ quý 3/2026','BBB: BCTC hợp nhất quý 3/2026','AAA: BCTC hợp nhất quý 2/2026','AAA: BCTC hợp nhất quý 3/2025','AAA: Dự kiến công bố BCTC hợp nhất quý 3/2026','AAA: Giải trình LNST quý 3/2026'])assert.equal(match(t),false,t);
});
test('document links allow verified HTTPS attachment hosts and escape unsafe URL schemes',()=>{
 assert.ok(matchExplanation({Title:'FIR: Giải trình chênh lệch LNST quý 3/2026 so với cùng kỳ năm trước'},'FIR','2026-Q3'));
 assert.equal(matchExplanation({Title:'FIR: Giải trình chênh lệch LNST quý 3/2025'},'FIR','2026-Q3'),false);
 const links=pdfAttachments('<a href="https://cafef1.mediacdn.vn/a.pdf">BCTC</a><a href="https://evil.example/a.pdf">No</a><a href="javascript:alert(1)">No</a>','https://cafef.vn/a.chn');
 assert.equal(links.length,1);assert.equal(links[0].title,'BCTC');
 assert.equal(safeSourceUrl('javascript:alert(1)'),null);assert.equal(safeSourceUrl('https://x:y@example.com'),null);
 assert.equal(disclosureDate('/Date(1791540000000)/'),new Date(1791540000000).toISOString());assert.equal(disclosureDate('today'),null);
});
test('research persists through public restore, caches unchanged reports and preserves links when source fails',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT)');
 const rs=[report('2026-Q3','120','120'),report('2025-Q3','100','100')];let calls=0;
 const download=async url=>{calls++;return {text:url.includes('News.ashx')?JSON.stringify({Data:[{Title:'AAA: BCTC hợp nhất quý 3/2026',LinkDetail:'/du-lieu/AAA-1/report.chn',DeployDate:'/Date(1791540000000)/'}]}):'<a href="https://cafef1.mediacdn.vn/a.pdf">BCTC hợp nhất</a>'};};
 await refreshCompanyResearch(db,'AAA',rs,download,{now:new Date('2026-10-11')});assert.equal(calls,2);
 await refreshCompanyResearch(db,'AAA',rs,download,{now:new Date('2026-10-11T01:00Z')});assert.equal(calls,2);
 const stored=readResearch(db);restoreResearch(db,{research:stored});
 await refreshCompanyResearch(db,'AAA',rs,async()=>{throw Error('down');},{now:new Date('2026-10-12')});
 const r=readResearch(db)['AAA:2026-Q3'];assert.equal(r.articleUrl,stored['AAA:2026-Q3'].articleUrl);assert.ok(r.error);assert.ok(r.publishedAt);db.close();
});
