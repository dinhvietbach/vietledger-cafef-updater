// CafeF's company-directory classification; report templates are not industries.
export const INDUSTRY_SOURCE='https://cafef.vn/du-lieu/du-lieu-doanh-nghiep.chn';
export const INDUSTRY_NAMES=Object.freeze({338:'Nông nghiệp',339:'Hàng tiêu dùng',340:'Năng lượng',341:'Tài chính',342:'Y tế',343:'Công nghiệp',344:'Nguyên vật liệu',345:'Bất động sản và Xây dựng',346:'Dịch vụ',347:'Công nghệ',348:'Viễn thông'});
const key='cafefIndustryCatalog';
export function industryPageUrl(skip=0,take=100){return `https://cafef.vn/du-lieu/ajax/pagenew/databusiness/congtyniemyet.ashx?centerid=0&skip=${skip}&take=${take}&major=0`;}
export async function fetchIndustryCatalog(read,now=new Date()){
  const rows=[],seen=new Set();let total=null;
  for(let skip=0;total===null||skip<total;){
    const page=await read(industryPageUrl(skip));
    if(!Array.isArray(page?.Data)||!page.Data.length)throw Error('Danh mục ngành CafeF trả trang rỗng hoặc sai cấu trúc.');
    const count=Number(page.Data[0].TotalCompany);
    if(!Number.isInteger(count)||count<1||count>10000||(total!==null&&count!==total))throw Error('Danh mục ngành CafeF thay đổi giữa các trang; giữ bản trước.');
    total=count;
    for(const row of page.Data){
      const symbol=String(row.Symbol||'').trim().toUpperCase(),market=Number(row.TradeCenterId),identity=`${symbol}:${market}`;
      if(!/^[A-Z0-9]{2,15}$/.test(symbol)||!Number.isInteger(market)||seen.has(identity))throw Error('Danh mục ngành CafeF chứa mã không hợp lệ hoặc trùng trang.');
      seen.add(identity);rows.push({...row,Symbol:symbol,TradeCenterId:market});
    }
    skip+=page.Data.length;
    if(skip>total)throw Error('Danh mục ngành CafeF vượt số doanh nghiệp công bố.');
  }
  const entries={};
  for(const row of rows){
    const id=Number(row.CategoryId),name=String(row.CategoryName||'').trim();
    if(![1,2,9].includes(row.TradeCenterId)||!INDUSTRY_NAMES[id]||!name)continue;
    if(name!==INDUSTRY_NAMES[id])throw Error('Tên ngành CafeF đã thay đổi; cần kiểm tra danh mục.');
    const previous=entries[row.Symbol];
    if(previous&&previous.id!==id)throw Error('CafeF trả hai ngành khác nhau cho cùng mã.');
    entries[row.Symbol]={id,name};
  }
  if(!Object.keys(entries).length)throw Error('CafeF chưa trả phân ngành; giữ bản trước.');
  return {source:INDUSTRY_SOURCE,checkedAt:new Date(now).toISOString(),totalCompanies:total,entries};
}
export function readIndustries(db){const value=db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value;return value?JSON.parse(value):null;}
export async function refreshIndustries(db,read){
  // Commit only a complete response; a failed page cannot erase the last good map.
  const snapshot=await fetchIndustryCatalog(read);
  db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(key,JSON.stringify(snapshot));
  return snapshot;
}
export function restoreIndustries(db,manifest){
  if(!manifest.industries?.checkedAt)return;
  const entries={};
  for(const c of manifest.companies||[])if(INDUSTRY_NAMES[c.industryId]&&INDUSTRY_NAMES[c.industryId]===c.industryName)entries[c.symbol]={id:c.industryId,name:c.industryName};
  if(Object.keys(entries).length)db.prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)').run(key,JSON.stringify({...manifest.industries,source:INDUSTRY_SOURCE,entries}));
}
export function withIndustries(companies,snapshot){return companies.map(c=>{const entry=snapshot?.entries?.[c.symbol];return {...c,industryId:entry?.id??null,industryName:entry?.name??null};});}
export function industryMetadata(snapshot){if(!snapshot)return null;const {entries,...metadata}=snapshot;return metadata;}
