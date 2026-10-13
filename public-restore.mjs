import {initValuations,saveValuation} from './market-valuations.mjs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

export function sourceReport(report){
  if(report.missing)return null;
  const {updated,issues,provisional,mappingBlocked,missing,...source}=report;
  return {...source,rows:source.rows.map(({display,checks,status,...row})=>row)};
}

// Rebuild only an empty, disposable database. Never overwrite the local research database.
export async function restorePublic(db,manifest,loadAsset){
  if(manifest.schema!==1||!Array.isArray(manifest.companies)||!manifest.companies.length)throw Error('Bản dữ liệu công khai không hợp lệ.');
  for(const table of ['reports','companies','runs','checks','series_status'])if(db.prepare(`SELECT count(*) n FROM ${table}`).get().n)throw Error('Chỉ khôi phục vào cơ sở dữ liệu mới, trống.');
  initValuations(db);
  if(db.prepare('SELECT count(*) n FROM market_valuations').get().n)throw Error('Chỉ khôi phục định giá vào dữ liệu trống.');
  const companies=new Map(manifest.companies.map(c=>[c.symbol,c]));
  if(companies.size!==manifest.companies.length)throw Error('Danh mục có mã trùng.');
  const groups=new Map();
  for(const c of companies.values()){
    if(!/^[A-Z0-9]{3,10}$/.test(c.symbol)||!/^\/data\/[a-f0-9]{64}\.bin$/.test(c.asset))throw Error('Đường dẫn dữ liệu không hợp lệ.');
    if(!groups.has(c.asset))groups.set(c.asset,[]);
    groups.get(c.asset).push(c.symbol);
  }
  const company=db.prepare('INSERT INTO companies VALUES(?,?,?,?)');
  const report=db.prepare('INSERT INTO reports VALUES(?,?,?,?,?,?)');
  const check=db.prepare('INSERT OR REPLACE INTO checks VALUES(?,?,?,?,?,?,?,?,?)');
  const coverage=db.prepare('INSERT INTO series_status VALUES(?,?,?,?,?,?,?,?,?)');
  const run=db.prepare('INSERT INTO runs(started,finished,symbol,status,message) VALUES(?,?,?,?,?)');
  let reports=0,cells=0;
  db.exec('BEGIN');
  try{
    for(const [asset,symbols] of groups){
      const bytes=await loadAsset(asset);
      if(createHash('sha256').update(bytes).digest('hex')!==asset.slice(6,-4))throw Error('Dữ liệu tải về không khớp SHA-256.');
      const bundle=JSON.parse(gunzipSync(bytes,{maxOutputLength:80*1024*1024}));
      if(Object.keys(bundle).length!==symbols.length)throw Error('Nhóm doanh nghiệp không khớp danh mục.');
      for(const symbol of symbols){
        const c=companies.get(symbol),data=bundle[symbol];
        if(!data?.reports)throw Error('Thiếu doanh nghiệp trong gói.');
        company.run(symbol,c.name,c.exchange,c.url);
        for(const snapshot of data.valuationSnapshots||[]){if(snapshot.symbol!==symbol)throw Error('Mã định giá không khớp.');saveValuation(db,snapshot);}
        let companyReports=0;
        for(const [kind,frequencies] of Object.entries(data.reports)){
          if(!['BSheet','IncSta','CashFlow','CafeFRatios'].includes(kind))throw Error('Loại báo cáo chưa hỗ trợ.');
          for(const [frequency,periods] of Object.entries(frequencies))for(const r of periods){
            const raw=sourceReport(r);if(!raw)continue;
            if(raw.symbol!==symbol||raw.kind!==kind||raw.source!=='CafeF'||!/^20\d{2}(-Q[1-4])?$/.test(raw.period)||!['year','quarter'].includes(frequency)||(frequency==='quarter')!==raw.period.includes('-Q'))throw Error('Nhận diện kỳ hoặc doanh nghiệp không khớp.');
            for(const row of raw.rows)if(row.value!==null&&typeof row.value!=='string')throw Error('Số gốc không còn giữ độ chính xác.');
            report.run(symbol,kind,raw.period,raw.source,JSON.stringify(raw),r.updated||c.updated||manifest.generatedAt);
            for(const row of r.rows)for(const x of row.checks||[])check.run(symbol,kind,r.period,row.code,x.source,x.value,x.url,x.page??null,x.note??null);
            reports++;companyReports++;cells+=raw.rows.length;
          }
        }
        if(companyReports!==c.reports)throw Error('Số bảng của doanh nghiệp không khớp.');
        for(const s of data.coverage)coverage.run(symbol,s.kind,s.frequency,s.status,s.reports,s.first,s.last,s.updated,s.message);
        if(c.updated)run.run(c.updated,c.updated,symbol,c.status||'success','Khôi phục bản công khai đã xuất bản.');
      }
    }
    if(reports!==manifest.status.reports)throw Error('Tổng số bảng khôi phục không khớp.');
    db.exec('COMMIT');return {companies:companies.size,reports,cells};
  }catch(error){db.exec('ROLLBACK');throw error;}
}
