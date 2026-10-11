import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {fetchIndustryCatalog,refreshIndustries,readIndustries,restoreIndustries,withIndustries,industryMetadata} from './cafef-industries.mjs';
const row=(Symbol,CategoryId,CategoryName,TradeCenterId=1,TotalCompany=5)=>({Symbol,CategoryId,CategoryName,TradeCenterId,TotalCompany});
const rows=[row('HPG',344,'Nguyên vật liệu'),row('VCB',341,'Tài chính'),row('ABC',348,'Viễn thông',9),row('OTC',347,'Công nghệ',8),row('XYZ',350,'Doanh nghiệp Upcom',9)];
const reader=async url=>{const skip=+new URL(url).searchParams.get('skip');return {Data:rows.slice(skip,skip+2)};};
test('joins complete CafeF directory across pages, excludes OTC and non-industry categories',async()=>{
  const snapshot=await fetchIndustryCatalog(reader,'2026-10-11T05:00:00Z');
  assert.equal(snapshot.totalCompanies,5);assert.deepEqual(Object.keys(snapshot.entries),['HPG','VCB','ABC']);
  const companies=withIndustries([{symbol:'HPG',reports:77},{symbol:'XYZ'},{symbol:'MISSING'}],snapshot);
  assert.equal(companies[0].industryName,'Nguyên vật liệu');assert.equal(companies[0].reports,77);
  assert.equal(companies[1].industryName,null);assert.equal(companies[2].industryId,null);
});
test('rejects repeated pages, truncated lists, changing totals and unexpected industry labels',async()=>{
  await assert.rejects(()=>fetchIndustryCatalog(async()=>({Data:rows.slice(0,2)})),/trùng/);
  await assert.rejects(()=>fetchIndustryCatalog(async url=>({Data:new URL(url).searchParams.get('skip')==='0'?rows.slice(0,2):[]})),/rỗng/);
  await assert.rejects(()=>fetchIndustryCatalog(async url=>({Data:new URL(url).searchParams.get('skip')==='0'?rows.slice(0,2):[row('NEW',347,'Công nghệ',1,6)]})),/thay đổi/);
  await assert.rejects(()=>fetchIndustryCatalog(async()=>({Data:[row('HPG',344,'Khác',1,1)]})),/Tên ngành/);
});
test('failed refresh retains last good classification and restores it through public manifests',async()=>{
  const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT)');
  try{
    const original=await refreshIndustries(db,reader);
    await assert.rejects(()=>refreshIndustries(db,async()=>{throw Error('network');}),/network/);
    assert.deepEqual(readIndustries(db),original);
    const manifest={industries:industryMetadata(original),companies:withIndustries([{symbol:'HPG'},{symbol:'XYZ'}],original)};
    db.exec('DELETE FROM meta');restoreIndustries(db,manifest);
    assert.equal(readIndustries(db).entries.HPG.name,'Nguyên vật liệu');assert.equal(readIndustries(db).checkedAt,original.checkedAt);
    assert.equal(readIndustries(db).entries.XYZ,undefined);
  }finally{db.close();}
});
