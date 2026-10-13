// Values published on CafeF's company overview. Never infer P/B from the annual
// API's zero placeholders. Its overview uses the historical code "Beta" for P/B,
// so the visible label, not that code alone, must also match.
export const valuationUrls=symbol=>({indicators:`https://cafef.vn/du-lieu/Ajax/PageNew/ChiSoTaiChinh.ashx?Symbol=${encodeURIComponent(symbol)}`,price:`https://cafef.vn/du-lieu/Ajax/PageNew/PriceRealTimeHeader.ashx?Symbol=${encodeURIComponent(symbol)}`});
const clean=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
export function sourceNumber(value){
 const s=String(value??'').trim();
 if(!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(s))return null;
 const n=s.replace(/,/g,'');return Number.isFinite(Number(n))&&Number(n)!==0?n:null;
}
export function parseValuation(symbol,indicators,price,checkedAt=new Date().toISOString()){
 if(!/^[A-Z0-9]{3,10}$/.test(symbol)||!Number.isFinite(Date.parse(checkedAt)))throw Error('Nhận diện bản định giá không hợp lệ.');
 if(indicators.Success!==true||!Array.isArray(indicators.Data))throw Error('CafeF chưa trả bảng chỉ số định giá hợp lệ.');
 const urls=valuationUrls(symbol),rows=indicators.Data;
 const find=(code,label)=>rows.find(r=>r.Code===code&&label.test(clean(r.Text)));
 const pe=find('P/E',/^P\/E$/i),pb=find('Beta',/^P\/B$/i)||find('P/B',/^P\/B$/i),bv=find('GiaTriSoSach',/^Giá trị sổ sách\/\s*cp.*nghìn đồng/i),eps=find('EPScoBan',/^EPS cơ bản.*nghìn đồng/i);
 if(!pe&&!pb)throw Error('CafeF đổi cấu trúc tên chỉ số P/E, P/B.');
 const date=new Date(Date.parse(checkedAt)+7*3600000).toISOString().slice(0,10);
 const priceMs=String(price?.Data?.ThoiGian||'').match(/^\/Date\((\d+)\)\/$/)?.[1];
 const priceAt=price?.Success===true&&priceMs&&Number(priceMs)<=Date.parse(checkedAt)+60000?new Date(Number(priceMs)).toISOString():null;
 return {symbol,date,checkedAt,source:'CafeF',url:urls.indicators,priceUrl:urls.price,priceAt,price:priceAt?sourceNumber(price.Data.Gia):null,priceUnit:'nghìn đồng/CP',basisNote:clean(rows.find(r=>r.Code==='ThoiGian')?.Value),values:{pe:sourceNumber(pe?.Value),pb:sourceNumber(pb?.Value),eps:sourceNumber(eps?.Value),bv:sourceNumber(bv?.Value)},raw:rows.map(r=>({code:r.Code,label:clean(r.Text),value:r.Value}))};
}
export function initValuations(db){db.exec('CREATE TABLE IF NOT EXISTS market_valuations(symbol TEXT,date TEXT,payload TEXT,PRIMARY KEY(symbol,date));');}
export function saveValuation(db,snapshot){
 if(!/^[A-Z0-9]{3,10}$/.test(snapshot.symbol)||!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date)||!snapshot.checkedAt||snapshot.source!=='CafeF'||snapshot.url!==valuationUrls(snapshot.symbol).indicators)throw Error('Bản định giá không hợp lệ.');
 for(const value of Object.values(snapshot.values||{}))if(value!==null&&(typeof value!=='string'||!/^[-]?\d+(?:\.\d+)?$/.test(value)))throw Error('Giá trị định giá không hợp lệ.');
 db.prepare('INSERT INTO market_valuations VALUES(?,?,?) ON CONFLICT(symbol,date) DO UPDATE SET payload=excluded.payload WHERE json_extract(excluded.payload,\'$.checkedAt\')>=json_extract(market_valuations.payload,\'$.checkedAt\')').run(snapshot.symbol,snapshot.date,JSON.stringify(snapshot));
}
export function readValuations(db,symbol){return db.prepare('SELECT payload FROM market_valuations WHERE symbol=? ORDER BY date').all(symbol).map(r=>JSON.parse(r.payload));}
export async function refreshValuation(db,symbol,download){
 const urls=valuationUrls(symbol),indicators=await download(urls.indicators,true);
 // A failed price request must not discard valid published ratios. Price and its
 // timestamp are supplementary; the ratio observation always has checkedAt.
 let price={};try{price=JSON.parse((await download(urls.price,true)).text);}catch{}
 const snapshot=parseValuation(symbol,JSON.parse(indicators.text),price);
 saveValuation(db,snapshot);return snapshot;
}
