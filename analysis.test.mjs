import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {normalizeAnalysis,filterAnalysis,analysisUrl} from './analysis-data.mjs';
import {fetchAnalysisArchive,refreshAnalysis,readAnalysis,restoreAnalysis,validateAnalysisArchive} from './cafef-analysis.mjs';
const now=new Date('2026-10-15T01:00:00Z');
const raw=(id,extra={})=>({id:String(id),title:'HPG: Triển vọng tăng trưởng',symbol:'HPG',dateDeploy:'2026-10-14T04:29:11.266Z',resourceCode:'VNDS',resourceName:'Chứng khoán VNDirect',reportType:'Cập nhật doanh nghiệp – Khuyến nghị',linkDetail:`/report/bao-cao-${id}.chn`,fileName:`HPG_${id}.pdf`,config:'https://cafefnew.mediacdn.vn/Images/Uploaded/DuLieuDownload/PhanTichBaoCao/',...extra});
const source=rows=>async url=>{const u=new URL(url),page=Number(u.searchParams.get('pageIndex')),size=Number(u.searchParams.get('pageSize'));return {isSuccess:true,value:{items:rows.slice((page-1)*size,page*size),totalCount:rows.length,pageIndex:page,pageSize:size}};};
function database(t){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT)');t.after(()=>db.close());return db;}
test('CafeF metadata retains date and direct PDF, separates category labels from tickers',()=>{
  const r=normalizeAnalysis(raw(1));assert.equal(r.date,'2026-10-14');assert.equal(r.url,'https://cafef.vn/du-lieu/report/bao-cao-1.chn');assert.match(r.pdfUrl,/HPG_1\.pdf$/);assert.deepEqual(r.symbols,['HPG']);
  assert.deepEqual(normalizeAnalysis(raw(2,{symbol:'Báo cáo ngành'})).symbols,[]);
  assert.deepEqual(normalizeAnalysis(raw(3,{symbol:'HPG, HSG; NKG'})).symbols,['HPG','HSG','NKG']);
  assert.equal(normalizeAnalysis(raw(4,{title:null,fileName:null})).title,'CafeF chưa cung cấp tiêu đề');
  assert.equal(normalizeAnalysis(raw(4,{fileName:null})).pdfUrl,null);
  const image=normalizeAnalysis(raw(6,{fileName:'report.png'}));assert.equal(image.pdfUrl,null);assert.match(image.documentUrl,/report\.png$/);
  assert.throws(()=>normalizeAnalysis(raw(5,{dateDeploy:'2026-02-30'})),/ngày hợp lệ/);
});
test('Untrusted PDF and page locations never become active links',()=>{
  for(const url of ['javascript:alert(1)','https://attacker.test/a.pdf','https://cafefnew.mediacdn.vn@attacker.test/a.pdf'])assert.equal(analysisUrl(url,'pdf'),null);
  assert.throws(()=>normalizeAnalysis(raw(1,{linkDetail:'https://attacker.test/report/x'})),/không hợp lệ/);
  assert.equal(normalizeAnalysis(raw(1,{config:'https://attacker.test/'})).pdfUrl,null);
});
test('Full archive follows every page, including equal-date records and a partial last page',async()=>{
  const rows=Array.from({length:5},(_,i)=>raw(i)),calls=[];
  const result=await fetchAnalysisArchive(async url=>{calls.push(url);return source(rows)(url);},{now,size:2});
  assert.equal(result.totalAtSource,5);assert.equal(result.items.length,5);assert.equal(calls.length,4);assert.equal(result.checkedAt,now.toISOString());assert.ok(result.complete);validateAnalysisArchive(result);
});
test('Missing, repeated and shifting pagination fail instead of publishing incomplete history',async()=>{
  const rows=Array.from({length:5},(_,i)=>raw(i));
  for(const mode of ['empty','duplicate','count','short','reorder']){
    let calls=0;
    await assert.rejects(fetchAnalysisArchive(async url=>{const j=await source(rows)(url);calls++;if(calls===2){if(mode==='empty')j.value.items=[];if(mode==='duplicate')j.value.items=[rows[0],rows[1]];if(mode==='count')j.value.totalCount++;if(mode==='short')j.value.items.pop();}if(mode==='reorder'&&calls===4)j.value.items.reverse();return j;},{size:2}),/rỗng|trùng|thay đổi|thiếu/);
  }
});
test('A failed refresh keeps previous complete history and its successful timestamp',async t=>{
  const db=database(t);await refreshAnalysis(db,source([raw(1),raw(2)]),{now,size:2,force:true});
  await assert.rejects(refreshAnalysis(db,async()=>{throw Error('HTTP 503');},{force:true}));
  const saved=readAnalysis(db);assert.equal(saved.items.length,2);assert.equal(saved.checkedAt,now.toISOString());assert.equal(saved.error,'HTTP 503');
});
test('Corrections replace metadata; older reports disappearing at source remain explicitly archived',async t=>{
  const db=database(t);await refreshAnalysis(db,source([raw(1),raw(2)]),{now,size:2,force:true});
  await refreshAnalysis(db,source([raw(1,{title:'Đã điều chỉnh'}),raw(3)]),{now,size:2,force:true});
  const s=validateAnalysisArchive(readAnalysis(db));assert.equal(s.items.length,3);assert.equal(s.totalAtSource,2);assert.equal(s.retained,1);assert.equal(s.items.find(r=>r.id==='1').title,'Đã điều chỉnh');assert.equal(s.items.find(r=>r.id==='2').archived,true);
});
test('Published archive restores across CI runs, validates digest and refuses malformed links',async t=>{
  const db=database(t),snapshot=await fetchAnalysisArchive(source([raw(1)]),{now});
  const body=gzipSync(JSON.stringify(snapshot)),asset='/data/'+createHash('sha256').update(body).digest('hex')+'.bin';
  await restoreAnalysis(db,{analysis:{asset}},async()=>body);assert.equal(readAnalysis(db).items.length,1);
  await assert.rejects(restoreAnalysis(db,{analysis:{asset}},async()=>Buffer.from('broken')),/vân tay/);
  const invalid=structuredClone(snapshot);invalid.items[0].pdfUrl='https://attacker.test/a.pdf';assert.throws(()=>validateAnalysisArchive(invalid),/liên kết/);
});
test('Search combines accent-free terms, exact ticker, publisher, category and inclusive date filters',()=>{
  const rows=[normalizeAnalysis(raw(1)),normalizeAnalysis(raw(2,{symbol:'HSG',resourceCode:'BSC',dateDeploy:'2025-01-01',title:'Ngành thép'})),normalizeAnalysis(raw(3,{symbol:'',title:'Vĩ mô Việt Nam'}))];
  assert.equal(filterAnalysis(rows,{query:'trien vong',symbol:'hpg',source:'VNDS',from:'2026-10-14',to:'2026-10-14'}).length,1);
  assert.equal(filterAnalysis(rows,{symbol:'HP'}).length,0);assert.equal(filterAnalysis(rows,{query:'vi mo'}).length,1);
  assert.equal(filterAnalysis(rows,{order:'oldest'})[0].id,'2');assert.equal(rows[0].id,'1');
});
