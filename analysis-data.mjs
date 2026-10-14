export const ANALYSIS_SOURCE='https://cafef.vn/du-lieu/phan-tich-bao-cao.chn';
const text=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export const searchText=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase();
export function analysisUrl(value,kind='page'){
  try{
    const u=new URL(value,'https://cafef.vn');
    const hosts=kind!=='page'?['cafefnew.mediacdn.vn','images1.cafef.vn','cafef1.mediacdn.vn']:['cafef.vn'];
    if(!hosts.includes(u.hostname)||u.username||u.password||!['http:','https:'].includes(u.protocol))return null;
    u.protocol='https:';
    if(kind==='pdf'&&!/\.pdf$/i.test(u.pathname))return null;
    if(kind==='document'&&!/\.(?:pdf|png|jpe?g|docx?|xlsx?)$/i.test(u.pathname))return null;
    if(kind==='page'&&!/^\/(?:du-lieu\/)?report\//.test(u.pathname))return null;
    if(kind==='page'&&u.pathname.startsWith('/report/'))u.pathname='/du-lieu'+u.pathname;
    u.search='';u.hash='';return u.href;
  }catch{return null;}
}
export function normalizeAnalysis(item){
  const id=String(item.id||item.objectId||'').trim(),title=text(item.title)||'CafeF chưa cung cấp tiêu đề',rawSymbol=text(item.symbol);
  const rawDate=String(item.dateDeploy||''),date=rawDate.slice(0,10);
  if(!/^[a-zA-Z0-9-]{1,128}$/.test(id)||!title||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Báo cáo CafeF thiếu mã, tiêu đề hoặc ngày hợp lệ.');
  const filename=String(item.fileName||'');
  const candidate=item.pdfUrl||(/^[^/\\]+\.(?:pdf|png|jpe?g|docx?|xlsx?)$/i.test(filename)&&item.config?item.config+encodeURIComponent(filename):null);
  const url=analysisUrl(item.linkDetail),documentUrl=candidate?analysisUrl(candidate,'document'):null,pdfUrl=candidate?analysisUrl(candidate,'pdf'):null;
  if(!url)throw Error('Liên kết trang báo cáo CafeF không hợp lệ.');
  const symbols=[...new Set(rawSymbol.toUpperCase().split(/[\s,;|/]+/).filter(s=>/^[A-Z][A-Z0-9]{2,9}$/.test(s)))];
  // Source labels such as “Báo cáo ngành” are not stock tickers.
  if(!/^[A-Z0-9\s,;|/]+$/i.test(rawSymbol))symbols.length=0;
  return {id,title,symbols,rawSymbol,date,sourceCode:text(item.resourceCode)||'Chưa rõ nguồn',sourceName:text(item.resourceName),category:text(item.reportType)||'Chưa phân loại',url,pdfUrl,documentUrl};
}
export function filterAnalysis(items,filters={}){
  const words=searchText(filters.query).split(' ').filter(Boolean),symbol=String(filters.symbol||'').trim().toUpperCase();
  const result=items.filter(r=>(!symbol||r.symbols.includes(symbol))&&(!filters.source||r.sourceCode===filters.source)&&(!filters.category||r.category===filters.category)&&(!filters.from||r.date>=filters.from)&&(!filters.to||r.date<=filters.to)&&(!words.length||words.every(w=>searchText([r.title,...r.symbols,r.sourceCode,r.sourceName,r.category].join(' ')).includes(w))));
  const sign=filters.order==='oldest'?1:-1;
  return result.sort((a,b)=>sign*a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'vi')||a.id.localeCompare(b.id));
}
