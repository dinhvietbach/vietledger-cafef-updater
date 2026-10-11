import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {ROOT,db,getReport} from './core.mjs';
import {earningsPeriods,summarizeEarnings} from './earnings.mjs';
import {readIndustries,withIndustries,industryMetadata} from './cafef-industries.mjs';

const generatedAt=new Date().toISOString();
const release=path.join(ROOT,'release');
const out=path.resolve(process.argv[2]||path.join(release,'public-'+generatedAt.replace(/[:.]/g,'-')));
if(!out.startsWith(release+path.sep)||fs.existsSync(out))throw Error('Thư mục xuất phải mới và nằm trong release/.');
fs.mkdirSync(path.join(out,'data'),{recursive:true});
const write=(name,body)=>fs.writeFileSync(path.join(out,name),body);
const digest=body=>createHash('sha256').update(body).digest('hex');
let bytes=0,maxAsset=0,sourceReports=0,sourceCells=0;
const assets=[];
const earnings=Object.fromEntries(earningsPeriods(generatedAt).map(period=>[period,{period,generatedAt,companies:[]}])) , earningsAssets=[];
db.exec('BEGIN'); // A coherent read snapshot while the local updater continues in WAL mode.
try{
  const industryCatalog=readIndustries(db);
  const companies=withIndustries(db.prepare(`SELECT c.*,
    (SELECT count(*) FROM reports r WHERE r.symbol=c.symbol) reports,
    (SELECT status FROM runs WHERE symbol=c.symbol AND finished IS NOT NULL ORDER BY id DESC LIMIT 1) status,
    (SELECT finished FROM runs WHERE symbol=c.symbol AND finished IS NOT NULL ORDER BY id DESC LIMIT 1) updated,
    (SELECT max(period) FROM reports WHERE symbol=c.symbol AND kind!='CafeFRatios') latest,
    (SELECT count(*) FROM series_status s WHERE s.symbol=c.symbol AND status='success') series,
    (SELECT count(*) FROM series_status s WHERE s.symbol=c.symbol AND status='empty') emptySeries
    FROM companies c ORDER BY c.symbol`).all(),industryCatalog);
  if(!companies.length)throw Error('Chưa có danh mục để xuất.');
  const cover=db.prepare('SELECT * FROM series_status WHERE symbol=? ORDER BY kind,frequency');
  for(let i=0;i<companies.length;i+=4){
    const group=companies.slice(i,i+4),bundle={};
    for(const c of group){
      const reports={};
      for(const kind of ['IncSta','BSheet','CashFlow','CafeFRatios']){
        reports[kind]={};
        for(const frequency of kind==='CafeFRatios'?['year']:['year','quarter']){
          const data=getReport(c.symbol,kind,frequency);
          reports[kind][frequency]=data;
          for(const r of data)if(!r.missing){sourceReports++;sourceCells+=r.rows.length;}
        }
      }
      bundle[c.symbol]={reports,coverage:cover.all(c.symbol)};
      for(const [period,season] of Object.entries(earnings))season.companies.push(summarizeEarnings(c,reports.IncSta.quarter,period));
    }
    // Explicit gzip decoding in the browser avoids reliance on hosting compression.
    const body=gzipSync(JSON.stringify(bundle),{level:6});
    if(body.length>25*1024*1024)throw Error('Nhóm dữ liệu vượt giới hạn 25 MiB của Pages.');
    const name='data/'+digest(body)+'.bin';write(name,body);
    assets.push({path:name,bytes:body.length,sha256:digest(body)});
    for(const c of group)c.asset='/'+name;
    bytes+=body.length;maxAsset=Math.max(maxAsset,body.length);
    if(i%100===0)console.log(`Đã xuất ${Math.min(i+4,companies.length)}/${companies.length} doanh nghiệp`);
  }
  const earningsIndex={};
  for(const [period,season] of Object.entries(earnings)){
    const body=gzipSync(JSON.stringify(season),{level:6}),name='data/'+digest(body)+'.bin';
    if(body.length>25*1024*1024)throw Error('Bảng KQKD vượt giới hạn kích thước.');
    write(name,body);earningsIndex[period]='/'+name;
    earningsAssets.push({path:name,period,bytes:body.length,sha256:digest(body)});
    bytes+=body.length;maxAsset=Math.max(maxAsset,body.length);
  }
  const version=digest(JSON.stringify({companies,earningsIndex}));
  const cloudSchedule=process.env.PUBLIC_CLOUD_SCHEDULE==='true';
  const status={public:true,generatedAt,lastFinished:version,catalog:companies.length,loaded:companies.filter(c=>c.reports>0).length,
    reports:db.prepare('SELECT count(*) n FROM reports').get().n,jobs:{running:false,active:[]},batch:null,runs:[],
    scheduler:{enabled:cloudSchedule,timeZone:'Asia/Ho_Chi_Minh',times:['00:00','09:00','12:00','15:00','18:00','21:00'],
      note:cloudSchedule?'Lịch kiểm tra CafeF: 00:00 · 09:00 · 12:00 · 15:00 · 18:00 · 21:00 giờ Việt Nam. Giờ bắt đầu có thể trễ; dữ liệu mới xuất bản sau khi lượt quét hoàn tất.':'Bản dữ liệu công khai. Lịch tự cập nhật trực tuyến chưa được kích hoạt.'}};
  if(status.reports!==sourceReports)throw Error(`Xuất thiếu bảng: ${sourceReports}/${status.reports}.`);
  write('manifest.json',JSON.stringify({schema:1,version,generatedAt,companies,status,earnings:earningsIndex,industries:industryMetadata(industryCatalog)}));
  let html=fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');
  html=html.replace('<script src="/app.js"','<script src="/public-data.js" defer></script><script src="/app.js"');
  html=html.replace('● Máy chủ cá nhân','● Truy cập công khai');
  html=html.replace('<button id="refresh"','<button hidden id="refresh"');
  html=html.replace(/(href|src)="\//g,'$1="./');
  const start=html.indexOf('<h3>Cập nhật tự động</h3>'),end=html.indexOf('<h3>Giới hạn cần hoàn thiện</h3>');
  if(start<0||end<start)throw Error('Không tìm thấy phần mô tả cập nhật.');
  html=html.slice(0,start)+'<h3>Cập nhật dữ liệu</h3><p>Trang công khai cho phép mọi người tra cứu báo cáo và chỉ số mà không cần tài khoản. Thời điểm xuất bản dữ liệu được ghi trên trang; thời điểm kiểm tra nguồn của từng doanh nghiệp có ở mục Độ phủ dữ liệu. Lịch dự kiến gồm 00:00, 09:00, 12:00, 15:00, 18:00 và 21:00 theo giờ Việt Nam. Việc cập nhật trực tuyến chỉ hoạt động sau khi được cấu hình và kiểm tra thành công. Khi chưa có bản cập nhật mới, trang tiếp tục hiển thị dữ liệu đã công bố.</p>'+html.slice(end);
  write('index.html',html);
  for(const file of ['app.js','style.css','ratios-ui.js','ratios.css','public-data.js','earnings-ui.js','earnings.css'])fs.copyFileSync(path.join(ROOT,'public',file),path.join(out,file));
  for(const file of ['ratios.mjs','public-data.mjs','earnings.mjs'])fs.copyFileSync(path.join(ROOT,file),path.join(out,file));
  write('404.html','<!doctype html><html lang="vi"><meta charset="utf-8"><title>Không tìm thấy</title><p>Không tìm thấy trang. <a href="/">Về VietLedger</a></p></html>');
  write('_headers',`/*\n  Cache-Control: no-cache\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n  Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'\n/data/*\n  Content-Type: application/octet-stream\n  Cache-Control: public, max-age=31536000, immutable\n`);
  write('robots.txt','User-agent: *\nAllow: /\n');
  write('.nojekyll','');
  const files=assets.length+earningsAssets.length+16;
  if(files>1000)throw Error('Gói vượt 1.000 tệp cho phương thức tải lên bằng trình duyệt.');
  const report={out,generatedAt,companies:companies.length,reports:sourceReports,cells:sourceCells,compressedDataBytes:bytes,maxAssetBytes:maxAsset,files,assets,earningsAssets};
  fs.writeFileSync(out+'.audit.json',JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(release,'latest-public-build.json'),JSON.stringify({out,audit:out+'.audit.json'},null,2));
  console.log(JSON.stringify({...report,assets:undefined},null,2));
}finally{db.exec('ROLLBACK');db.close();}
