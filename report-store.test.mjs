import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {storeSeries} from './report-store.mjs';

function setup(){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE reports(symbol TEXT,kind TEXT,period TEXT,source TEXT,payload TEXT,updated TEXT,PRIMARY KEY(symbol,kind,period,source))');
 const save=(reports,checkedAt='2026-10-10T02:00:00Z',frequency='quarter')=>storeSeries(db,{symbol:'HPG',kind:'IncSta',frequency,reports,checkedAt});
 const report=(period,value)=>({symbol:'HPG',kind:'IncSta',source:'CafeF',period,scope:'consolidated',hash:'original',supplement:{hash:'original-extra',url:'source'},rows:[{code:'60',value}]});
 return {db,save,report,rows:()=>db.prepare('SELECT * FROM reports ORDER BY period').all()};
}
test('No changes: retain values, source evidence and updated timestamp',()=>{
 const s=setup(),r=s.report('2026-Q2','9007199254740993123');s.save([r]);const before=s.rows();r.hash='different-page';r.supplement.hash='different-extra-page';
 assert.deepEqual(s.save([r],'2026-10-10T05:00:00Z'),{added:0,revised:0,removed:0,unchanged:1});assert.deepEqual(s.rows(),before);s.db.close();
});
test('New periods and historical restatements update only affected reports, precisely',()=>{
 const s=setup();s.save([s.report('2016-Q1','0'),s.report('2026-Q2','10')]);
 const change=s.save([s.report('2016-Q1','9007199254740993124'),s.report('2026-Q2','10'),s.report('2026-Q3','20')],'2026-10-10T05:00:00Z');
 assert.deepEqual(change,{added:1,revised:1,removed:0,unchanged:1});assert.equal(JSON.parse(s.rows()[0].payload).rows[0].value,'9007199254740993124');assert.equal(s.rows()[1].updated,'2026-10-10T02:00:00Z');s.db.close();
});
test('Missing vs zero and scope changes are meaningful source changes',()=>{
 const s=setup();s.save([s.report('2026-Q2',null)]);assert.equal(s.save([s.report('2026-Q2','0')]).revised,1);
 const r=s.report('2026-Q2','0');r.scope='separate';assert.equal(s.save([r]).revised,1);s.db.close();
});
test('Empty or duplicate input preserves stored data; valid removals stay within series',()=>{
 const s=setup();s.save([s.report('2025','5')],undefined,'year');s.save([s.report('2026-Q1','1'),s.report('2026-Q2','2')]);const before=s.rows();s.save([]);assert.deepEqual(s.rows(),before);
 assert.throws(()=>s.save([s.report('2026-Q2','3'),s.report('2026-Q2','4')]));assert.deepEqual(s.rows(),before);
 assert.equal(s.save([s.report('2026-Q2','2')]).removed,1);assert.deepEqual(s.rows().map(r=>r.period),['2025','2026-Q2']);s.db.close();
});
