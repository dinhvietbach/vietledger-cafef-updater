// Run by CI only. Previous public data remains available if this job fails.
import path from 'node:path';
import {restorePublic} from './public-restore.mjs';
import {restoreIndustries,refreshIndustries,readIndustries} from './cafef-industries.mjs';

if(process.env.CI!=='true'||!process.env.DATA_DIR)throw Error('Chỉ chạy trong CI với DATA_DIR riêng.');
const target=path.resolve(process.env.DATA_DIR);
if(!target.includes('vietledger-cloud-data'))throw Error('DATA_DIR phải là thư mục tạm vietledger-cloud-data.');
const base=new URL(process.env.PUBLIC_SITE_URL||'https://vietledger.pages.dev/');
if(base.protocol!=='https:'||base.hostname!=='vietledger.pages.dev'||base.pathname!=='/')throw Error('Địa chỉ bản công khai chưa được xác nhận.');
async function downloadPublic(asset){
  const url=new URL(asset.replace(/^\//,''),base);
  for(let attempt=0;attempt<3;attempt++){
    try{const r=await fetch(url,{signal:AbortSignal.timeout(60000),redirect:'error',cache:'no-store'});if(!r.ok)throw Error(`Tải bản công khai: HTTP ${r.status}`);return Buffer.from(await r.arrayBuffer());}
    catch(error){if(attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,2000*(attempt+1)));}
  }
}
const {db,catalog,syncCompany,download}=await import('./core.mjs');
try{
  const manifest=JSON.parse(await downloadPublic('manifest.json'));
  console.log('Khôi phục dữ liệu trước lượt cập nhật:',await restorePublic(db,manifest,downloadPublic));
  restoreIndustries(db,manifest);
  if(process.env.REBUILD_ONLY==='true'){
    console.log('Xuất bản lại dữ liệu đã công bố; giữ nguyên thời điểm kiểm tra nguồn.');
    try{await refreshIndustries(db,async url=>JSON.parse((await download(url,true)).text));}
    catch(error){if(!readIndustries(db))throw error;console.warn('Giữ phân ngành đã lưu:',error.message);}
  }else{
  await catalog();
  const companies=db.prepare('SELECT symbol FROM companies ORDER BY symbol').all();
  const previousRun=db.prepare('SELECT coalesce(max(id),0) n FROM runs').get().n;
  let index=0,done=0;
  async function worker(){
    while(index<companies.length){
      const {symbol}=companies[index++];
      try{await syncCompany(symbol);}catch(error){console.error(symbol,error.message);}
      done++;if(done%50===0||done===companies.length)console.log(`Đã kiểm tra ${done}/${companies.length} doanh nghiệp`);
    }
  }
  await Promise.all(Array.from({length:4},worker));
  const counts=Object.fromEntries(db.prepare('SELECT status,count(*) n FROM runs WHERE id>? GROUP BY status').all(previousRun).map(r=>[r.status,r.n]));
  if(Object.values(counts).reduce((a,b)=>a+b,0)!==companies.length||counts.running)throw Error('Lượt cập nhật chưa xử lý đủ danh mục.');
  if(((counts.error||0)+(counts.partial||0))/companies.length>0.1||(counts.empty||0)/companies.length>0.25)throw Error('Nguồn lỗi hoặc rỗng trên diện rộng; giữ nguyên website đã xuất bản.');
  console.log('Hoàn tất lượt cập nhật:',JSON.stringify(counts));
  }
}finally{db.close();}
