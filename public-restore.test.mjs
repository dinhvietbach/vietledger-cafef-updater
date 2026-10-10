import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {restorePublic,sourceReport} from './public-restore.mjs';
import {storeSeries} from './report-store.mjs';

function fixture(){
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE companies(symbol TEXT PRIMARY KEY,name TEXT,exchange TEXT,url TEXT);
  CREATE TABLE reports(symbol TEXT,kind TEXT,period TEXT,source TEXT,payload TEXT,updated TEXT,PRIMARY KEY(symbol,kind,period,source));
  CREATE TABLE runs(id INTEGER PRIMARY KEY,started TEXT,finished TEXT,symbol TEXT,status TEXT,message TEXT);
  CREATE TABLE checks(symbol TEXT,kind TEXT,period TEXT,code TEXT,source TEXT,value TEXT,url TEXT,page INTEGER,note TEXT,PRIMARY KEY(symbol,kind,period,code,source));
  CREATE TABLE series_status(symbol TEXT,kind TEXT,frequency TEXT,status TEXT,reports INTEGER,first TEXT,last TEXT,updated TEXT,message TEXT,PRIMARY KEY(symbol,kind,frequency));`);
  const raw={symbol:'HPG',kind:'IncSta',period:'2026-Q2',source:'CafeF',hash:'original',rows:[{code:'60',value:'9007199254740993123'},{code:'61',value:'0'},{code:'62',value:null}]};
  const displayed={...raw,updated:'2026-10-09T00:00:00Z',issues:[],mappingBlocked:false,provisional:false,rows:raw.rows.map((row,i)=>({...row,display:i?'—':'9007199254.74',status:'single',checks:i?[]:[{source:'Official',value:row.value,url:'https://www.hoaphat.com.vn/',page:1,note:'Original'}]}))};
  const bytes=gzipSync(JSON.stringify({HPG:{reports:{IncSta:{quarter:[displayed,{...displayed,period:'2016-Q1',missing:true}]}},coverage:[]}}));
  const asset='/data/'+createHash('sha256').update(bytes).digest('hex')+'.bin';
  const manifest={schema:1,generatedAt:'2026-10-09T00:00:00Z',status:{reports:1},companies:[{symbol:'HPG',name:'Hòa Phát',exchange:'HOSE',url:'https://cafef.vn/',reports:1,updated:'2026-10-09T00:00:00Z',status:'success',asset}]};
  return {db,raw,displayed,bytes,manifest};
}
test('restore preserves exact values, provenance, missing versus zero and official checks',async()=>{
  const s=fixture();assert.deepEqual(sourceReport(s.displayed),s.raw);
  assert.deepEqual(await restorePublic(s.db,s.manifest,async()=>s.bytes),{companies:1,reports:1,cells:3});
  assert.deepEqual(JSON.parse(s.db.prepare('SELECT payload FROM reports').get().payload),s.raw);
  assert.equal(s.db.prepare('SELECT count(*) n FROM checks').get().n,1);
  assert.equal(storeSeries(s.db,{symbol:'HPG',kind:'IncSta',frequency:'quarter',reports:[s.raw]}).unchanged,1);
  await assert.rejects(restorePublic(s.db,s.manifest,async()=>s.bytes),/trống/);s.db.close();
});
test('corruption or incomplete restore rolls back the entire snapshot',async()=>{
  const s=fixture();await assert.rejects(restorePublic(s.db,s.manifest,async()=>Buffer.from('bad')),/SHA-256/);
  s.manifest.status.reports=2;
  await assert.rejects(restorePublic(s.db,s.manifest,async()=>s.bytes),/Tổng số bảng/);
  for(const table of ['companies','reports','runs','checks'])assert.equal(s.db.prepare(`SELECT count(*) n FROM ${table}`).get().n,0);
  s.db.close();
});
