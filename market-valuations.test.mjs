import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {sourceNumber,parseValuation,initValuations,saveValuation,readValuations,refreshValuation} from './market-valuations.mjs';
const indicators={Success:true,Data:[{Code:'P/E',Text:'P/E',Value:'7.54'},{Code:'Beta',Text:'P/B',Value:'1.24'},{Code:'GiaTriSoSach',Text:'Giá trị sổ sách/ cp <span>(nghìn đồng)</span>',Value:'16.46'},{Code:'EPScoBan',Text:'EPS cơ bản * <span>(nghìn đồng)</span>',Value:'2.71'},{Code:'ThoiGian',Value:'Số liệu EPS tính tới Quý II năm 2026'}]};
const at='2026-10-13T17:01:00.000Z',price={Success:true,Data:{Gia:20.45,ThoiGian:'/Date(1791877500005)/'}};
test('CafeF overview preserves reported P/E and P/B, units, time and Vietnamese observation date',()=>{
 const r=parseValuation('HPG',indicators,price,at);
 assert.deepEqual(r.values,{pe:'7.54',pb:'1.24',eps:'2.71',bv:'16.46'});assert.equal(r.date,'2026-10-14');assert.equal(r.price,'20.45');assert.equal(r.priceUnit,'nghìn đồng/CP');assert.match(r.basisNote,/Quý II/);assert.ok(r.priceAt);assert.equal(r.raw[1].code,'Beta');
});
test('Do not mistake Beta for P/B after a source schema change or turn gaps into zeros',()=>{
 const data=structuredClone(indicators);data.Data[1].Text='Beta';data.Data[0].Value='--';
 assert.deepEqual(parseValuation('HPG',data,{},at).values,{pe:null,pb:null,eps:'2.71',bv:'16.46'});
 for(const v of ['',null,'0','0.00','N/A','1,23','1.2<script>'])assert.equal(sourceNumber(v),null);
 assert.equal(sourceNumber('174,814.77'),'174814.77');assert.equal(sourceNumber('-2.71'),'-2.71');
 assert.throws(()=>parseValuation('HPG',{Success:false},price,at));
});
test('Daily replacement preserves prior days and rejects older retries',()=>{
 const db=new DatabaseSync(':memory:');initValuations(db);
 const first=parseValuation('HPG',indicators,price,'2026-10-13T01:00:00.000Z');saveValuation(db,first);
 const latest={...first,checkedAt:'2026-10-13T10:00:00.000Z',values:{...first.values,pb:'1.25'}};saveValuation(db,latest);saveValuation(db,first);saveValuation(db,parseValuation('HPG',indicators,price,at));
 const rows=readValuations(db,'HPG');assert.equal(rows.length,2);assert.equal(rows[0].values.pb,'1.25');assert.equal(readValuations(db,'VCB').length,0);db.close();
});
test('A failed update retains the previous observation; missing price does not invent a timestamp',async()=>{
 const db=new DatabaseSync(':memory:');initValuations(db);const first=parseValuation('HPG',indicators,price,at);saveValuation(db,first);
 await assert.rejects(refreshValuation(db,'HPG',async()=>{throw Error('Network');}));assert.deepEqual(readValuations(db,'HPG'),[first]);
 const p=parseValuation('HPG',indicators,{},at);assert.equal(p.priceAt,null);assert.equal(p.price,null);db.close();
});
