// Shared, dependency-free definitions and transformations for the steel workspace.
export const STEEL_PRODUCTS=[
 {id:'hrc',name:'HRC',codes:['7208'],scope:'HS 7208: thép cán nóng dẹt không hợp kim, rộng ≥600 mm; gồm cả cuộn và tấm, không chỉ riêng HRC dạng cuộn.'},
 {id:'construction',name:'Thép xây dựng',codes:['7213','7214'],scope:'HS 7213 + 7214: thép thanh/cuộn không hợp kim. Phạm vi rộng hơn thép xây dựng thông dụng, chưa gồm thép hợp kim.'},
 {id:'coated',name:'Tôn mạ',codes:['7210'],scope:'HS 7210: thép dẹt không hợp kim rộng ≥600 mm, mạ/phủ. Gồm mạ thiếc, kẽm, nhôm, sơn; chưa gồm băng hẹp và thép hợp kim.'},
 {id:'pipe',name:'Ống thép',codes:['7306'],scope:'HS 7306: ống và tiết diện rỗng hàn/ghép; không gồm ống đúc HS 7304 và ống lớn HS 7305.'},
 {id:'billet',name:'Phôi thép',codes:['7207'],scope:'HS 7207: bán thành phẩm sắt/thép không hợp kim, gồm billet, bloom và slab; không phải riêng phôi vuông.'},
 {id:'iron',name:'Quặng sắt',codes:[],scope:'World Bank: quặng sắt 62% Fe, CFR Trung Quốc, giá danh nghĩa bình quân tháng.'},
 {id:'coke',name:'Than cốc',codes:['270400'],scope:'HS 270400: coke và bán coke từ than/lignite/than bùn, gồm retort carbon. Phân biệt với than mỡ luyện cốc chưa qua luyện.'},
 {id:'coking_coal',name:'Than mỡ luyện cốc',codes:[],scope:'Giá VSA trích dẫn; tách FOB Úc với CFR Trung Quốc và giá bình quân với báo giá tại một ngày.'},
 {id:'scrap',name:'Thép phế liệu',codes:[],scope:'Phạm vi thị trường theo từng nguồn.'},
 {id:'crc',name:'Thép cán nguội (CRC)',codes:[],scope:'Thép cán nguội, tách riêng khỏi HRC.'},
 {id:'flat_steel',name:'Tổng cán nóng & cán nguội',codes:[],scope:'Tổng trong bảng Excel, bao gồm cả cán nóng và cán nguội; không đồng nhất với HRC.'},
 {id:'all_steel',name:'Tổng thép thành phẩm',codes:[],scope:'Tổng sản xuất/bán hàng của các đơn vị trong báo cáo VSA; không tương đương tiêu dùng cuối cùng toàn quốc.'}
];
export const PRODUCT_BY_ID=Object.fromEntries(STEEL_PRODUCTS.map(p=>[p.id,p]));
export const TRADE_CODES=[...new Set(STEEL_PRODUCTS.flatMap(p=>p.codes))];
export function monthRange(from='2015-01',to=new Date().toISOString().slice(0,7)){const out=[];if(!/^\d{4}-\d{2}$/.test(from)||!/^\d{4}-\d{2}$/.test(to)||from>to)return out;let [y,m]=from.split('-').map(Number);while(`${y}-${String(m).padStart(2,'0')}`<=to&&out.length<1200){out.push(`${y}-${String(m).padStart(2,'0')}`);if(++m>12){m=1;y++;}}return out;}
export function emptySteel(){return {schema:1,sector:'steel',requestedFrom:'2015-01',series:[],sources:{},documents:[],checks:{},updatedAt:null};}
export function periodMonth(period){if(/^\d{4}-Q[1-4]$/.test(period))return period.slice(0,4)+'-'+String(Number(period.at(-1))*3).padStart(2,'0');if(/^\d{4}$/.test(period))return period+'-12';return period;}
export function periodLabel(period){return !period?'—':/^\d{4}-Q[1-4]$/.test(period)?period.slice(5)+'/'+period.slice(0,4):/^\d{4}$/.test(period)?period:period.slice(5)+'/'+period.slice(0,4);}
export function periodRange(from,to,frequency='month'){const months=monthRange(from,to);return frequency==='quarter'?[...new Set(months.map(m=>m.slice(0,4)+'-Q'+Math.ceil(Number(m.slice(5))/3)))]:frequency==='year'?[...new Set(months.map(m=>m.slice(0,4)))]:months;}
export function selectSteelSeries(series,{product='all',frequency='month',entity='industry',segment='total',source='all',metric='all',tab='prices',basis='market'}={}){return series.filter(s=>(product==='all'||s.product===product)&&(s.frequency||'month')===frequency&&(entity==='all'||(s.entity||'industry')===entity)&&(segment==='all'||(s.segment||'total')===segment)&&(source==='all'||(source==='workbook'?s.basis==='workbook':s.basis!=='workbook'))&&(metric==='all'||s.metric===metric)&&(tab==='prices'?/price/.test(s.metric)&&(basis==='market'?s.metric==='price':s.metric===basis):tab==='volume'?['production','sales','sales_north','sales_central','sales_south','sales_domestic','vsa_exports','exports','inventory','inventory_sum','market_share'].includes(s.metric)&&!(s.basis==='trade'):tab==='trade'?['imports','exports'].includes(s.metric):true));}
export function seriesDefinition(product,metric,basis='trade'){
 const p=PRODUCT_BY_ID[product];if(!p)throw Error('Unknown steel product');
 const names={imports:'Nhập khẩu',exports:'Xuất khẩu',import_price:'Đơn giá nhập khẩu',export_price:'Đơn giá xuất khẩu',production:'Sản xuất',sales:'Bán hàng',vsa_exports:'Xuất khẩu thành viên VSA',price:'Giá thị trường'};
 const price=/price/.test(metric),id=`${product}.${metric}.${basis}`;
 return {id,product,metric,label:`${p.name} · ${names[metric]||metric}`,unit:price?'USD/tấn':'tấn',basis,scope:basis==='trade'?p.scope:basis==='wb'?p.scope:'Phạm vi doanh nghiệp và loại sản phẩm theo bản tin VSA.',method:basis==='trade'?(price?'Kim ngạch USD / khối lượng tịnh tấn. Đơn giá hải quan tổng hợp, không phải báo giá thị trường.':'Khối lượng tịnh theo UN Comtrade, kg ÷ 1.000. Không coi mã HS vắng mặt là 0.'):'Số công bố tại nguồn; không nội suy.',observations:[]};
}
export function parseTrade(payload,{period,url,checkedAt=new Date().toISOString(),hash}={}){
 if(!payload||!Array.isArray(payload.data)||payload.count!==payload.data.length||payload.data.length>=500||payload.error)throw Error('Phản hồi Comtrade thiếu hoặc bị giới hạn.');
 const seen=new Set();for(const r of payload.data){const key=[r.period,r.flowCode,r.cmdCode].join(':');if(seen.has(key))throw Error('Trùng kỳ/luồng/mã HS');seen.add(key);if(String(r.period)!==period.replace('-','')||r.reporterCode!==704||r.partnerCode!==0||r.partner2Code!==0||r.customsCode!=='C00'||r.motCode!==0||!['M','X'].includes(r.flowCode)||!TRADE_CODES.includes(r.cmdCode))throw Error('Phạm vi Comtrade không khớp');}
 const series=[];
 for(const p of STEEL_PRODUCTS.filter(p=>p.codes.length))for(const flow of ['M','X']){
  const rows=p.codes.map(c=>payload.data.find(r=>r.cmdCode===c&&r.flowCode===flow));
  // A positive trade value with zero reported mass is an unavailable weight,
  // not evidence of zero physical shipments (common in historical records).
  if(rows.some(r=>!r||r.netWgt===null||!Number.isFinite(r.netWgt)||r.netWgt<0||(r.netWgt===0&&r.primaryValue>0)))continue;
  const weight=rows.reduce((s,r)=>s+r.netWgt,0)/1000;
  const amount=rows.every(r=>Number.isFinite(r.primaryValue)&&r.primaryValue>=0)?rows.reduce((s,r)=>s+r.primaryValue,0):null;
  const base={period,url,source:'comtrade',checkedAt,hash,estimated:rows.some(r=>r.isNetWgtEstimated),raw:{netWgtKg:weight*1000,tradeValueUSD:amount,codes:p.codes,classifications:[...new Set(rows.map(r=>r.classificationCode))],flow},note:'Đối tác: thế giới; Việt Nam là nước báo cáo. '+(rows.some(r=>r.isNetWgtEstimated)?'UN Comtrade đánh dấu khối lượng là ước tính.':'')};
  for(const [metric,value] of [[flow==='M'?'imports':'exports',weight],[flow==='M'?'import_price':'export_price',weight>0&&amount!==null?amount/weight:null]]){if(value===null)continue;const s=seriesDefinition(p.id,metric);s.observations=[{...base,value}];series.push(s);}
 }
 return series;
}
export function mergeSteel(previous,incoming,{now=new Date().toISOString()}={}){
 const result=structuredClone(previous||emptySteel());if(result.schema!==1)throw Error('Sai phiên bản dữ liệu ngành');
 const map=new Map(result.series.map(s=>[s.id,s]));
 for(const next of incoming){const old=map.get(next.id)||{...next,observations:[]};const points=new Map(old.observations.map(o=>[o.period,o]));const pattern=next.frequency==='quarter'?/^\d{4}-Q[1-4]$/:next.frequency==='year'?/^\d{4}$/:/^\d{4}-(0[1-9]|1[0-2])$/;for(const o of next.observations){if(!pattern.test(o.period)||periodMonth(o.period)<'2015-01'||periodMonth(o.period)>now.slice(0,7)||!Number.isFinite(o.value)||o.value<0||!/^https:\/\//.test(o.url))throw Error('Điểm dữ liệu ngành không hợp lệ');const prior=points.get(o.period);const priority=p=>p.source==='workbook'?(p.checkedAt||''):(p.observedAt||'')+'|'+(p.publishedAt||'');if(prior&&priority(o)<priority(prior))continue;points.set(o.period,o);}map.set(next.id,{...old,...next,observations:[...points.values()].sort((a,b)=>a.period.localeCompare(b.period))});}
 result.series=[...map.values()];result.updatedAt=now;return result;
}
export function growthAt(observations,period,months){const now=observations.find(o=>o.period===period);const d=new Date(periodMonth(period)+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-months);const m=d.toISOString().slice(0,7),key=period.includes('Q')?m.slice(0,4)+'-Q'+Math.ceil(Number(m.slice(5))/3):period.length===4?m.slice(0,4):m;const prev=observations.find(o=>o.period===key);return now&&prev&&prev.value>0?(now.value/prev.value-1)*100:null;}
export function seriesCoverage(series,to=new Date().toISOString().slice(0,7)){const months=periodRange('2015-01',to,series.frequency);const points=series.observations.filter(o=>months.includes(o.period));return {count:points.length,total:months.length,first:points[0]?.period||null,last:points.at(-1)?.period||null,missing:months.filter(m=>!points.some(o=>o.period===m))};}
// Only the reviewed monthly coated-steel totals share a usable comparison mapping.
// Customs, prices, product subsegments and differing frequencies remain separate.
export function combineSteelSeries(series){
 const groups=new Map(),other=[];
 for(const s of series){const metric=s.metric==='exports'?'vsa_exports':s.metric;
  const matched=s.product==='coated'&&(s.frequency||'month')==='month'&&(s.entity||'industry')==='industry'&&(s.segment||'total')==='total'&&s.unit==='tấn'&&['production','sales','vsa_exports'].includes(metric)&&(s.basis==='vsa'||s.id===`coated.${s.metric}.workbook.month.industry.total`);
  if(!matched){other.push(s);continue;}if(!groups.has(metric))groups.set(metric,[]);groups.get(metric).push(s);
 }
 for(const [metric,parts] of groups){if(parts.length<2){other.push(...parts);continue;}const s=seriesDefinition('coated',metric,'combined');s.label+=' · tổng hợp nguồn';s.sourceLabel='VSA / KIS + Excel';s.scope='Tổng hợp tham khảo tôn mạ tháng: nguồn VSA/KIS và dòng tổng trong Excel. File không ghi liên kết nguồn gốc; từng điểm vẫn giữ nguồn riêng, không mặc định mọi khác biệt là lỗi.';s.method='Ưu tiên VSA trực tiếp, sau đó KIS trích VSA, rồi Excel khi kỳ đó chưa có số công bố. Chênh lệch được giữ để đối chiếu, không lấy trung bình. Không nội suy tháng thiếu.';s.frequency='month';const byPeriod=new Map();
  for(const part of parts)for(const o of part.observations){if(!byPeriod.has(o.period))byPeriod.set(o.period,[]);byPeriod.get(o.period).push({...o,sourceSeriesId:part.id,sourceLabel:part.sourceLabel||'VSA / KIS'});}
  const priority=o=>o.source==='vsa'?3:o.source==='kis-vsa'?2:1;
  s.observations=[...byPeriod.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([period,options])=>{options.sort((a,b)=>priority(b)-priority(a));return {...options[0],alternatives:options.slice(1),conflict:options.some(o=>o.value!==options[0].value)};});other.push(s);
 }return other;
}
export function coverageYears(series,to=new Date().toISOString().slice(0,7)){
 const range=periodRange('2015-01',to,series.frequency),present=new Set(series.observations.map(o=>o.period));
 return [...new Set(range.map(p=>p.slice(0,4)))].map(year=>{const periods=range.filter(p=>p.startsWith(year));return {year,count:periods.filter(p=>present.has(p)).length,total:periods.length,missing:periods.filter(p=>!present.has(p))};});
}
export function cleanText(html){return String(html).replace(/<\/(p|li|h[1-6])>|<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').normalize('NFC').replace(/[ \t\u00a0]+/g,' ');}
export function vnNumber(raw){let s=raw.trim();if(/^\d{1,3}(\.\d{3})+$/.test(s))return Number(s.replaceAll('.',''));if(s.includes(','))return Number(s.replaceAll('.','').replace(',','.'));return Number(s);}
export function parseVsa(post,checkedAt=new Date().toISOString()){
 const text=cleanText(post.content?.rendered||''),title=cleanText(post.title?.rendered||''),url=post.link?.replace(/^http:/,'https:');
 if(!url||!/vsa\.com\.vn\//.test(url))throw Error('Nguồn VSA không hợp lệ');
 const out=[];
 // Explicit dated quotes are separate from monthly means. Store the date, and
 // do not relabel a quote in the next month as the report's reference month.
 for(const [product,section] of [['hrc',text.match(/(?:Cuộn cán nóng HRC|Thép cuộn cán nóng \(HRC\))\s*:[\s\S]{0,1000}/i)?.[0]],['coking_coal',text.match(/Than mỡ luyện (?:cốc|coke)\s*:[\s\S]{0,1000}/i)?.[0]]]){
  if(!section)continue;const block=section.split(/Thép phế|Điện cực|Tình hình sản xuất/i)[0];
  const quote=block.match(/ngày\s+(\d{1,2})\/(\d{1,2})\/(20\d{2})[^\d]{0,110}?(\d+(?:[.,]\d+)?)\s*(?:[-–]\s*(\d+(?:[.,]\d+)?))?\s*USD\s*\//i);
  if(!quote)continue;const market=product==='hrc'?/CFR\s*(?:Việt Nam)/i.test(block)?'cfr-vietnam':/CFR\s*(?:cảng )?Đông Á/i.test(block)?'cfr-east-asia':null:/FOB|cảng Úc/i.test(block)?'fob-australia':/Jingtang|CFR/i.test(block)?'cfr-china':null;if(!market)continue;
  const low=vnNumber(quote[4]),high=quote[5]?vnNumber(quote[5]):low,observedAt=`${quote[3]}-${quote[2].padStart(2,'0')}-${quote[1].padStart(2,'0')}`;
  const s=seriesDefinition(product,'price','vsa-dated-'+market);s.label=`${PRODUCT_BY_ID[product].name} · báo giá có ngày (${market.toUpperCase()})`;s.scope=market.replaceAll('-',' ').toUpperCase()+'; một báo giá có ngày xác định trong tháng, không phải bình quân tháng.';
  s.observations=[{period:observedAt.slice(0,7),observedAt,value:(low+high)/2,low,high,url,source:'vsa',checkedAt,publishedAt:post.date,kind:'dated-quote',evidence:quote[0],note:low!==high?`Trung điểm khoảng báo giá ${low}–${high} USD/tấn tại ngày ${observedAt}; không phải giá bình quân tháng.`:`Báo giá tại ngày ${observedAt}; không phải bình quân tháng.`}];out.push(s);
 }
 // Only explicit monthly averages, never year-to-date averages or dates inferred from publication time.
 for(const m of text.matchAll(/(?:Giá\s+)?(quặng sắt|HRC|than mỡ[^.\n:]{0,35}|giao dịch)\s*(?:bình quân|trung bình)\s+tháng\s+(\d{1,2})\/(20\d{2})\s+(?:ở mức|là|đạt)\s*([\d.,]+)\s*USD\s*\/\s*tấn/gi)){
  const context=text.slice(Math.max(0,m.index-120),m.index+m[0].length+100);let product=/HRC/i.test(m[1])?'hrc':/quặng/i.test(m[1])?'iron':/than|luyện cốc/i.test(context)?'coking_coal':null;if(!product)continue;
  const basis=product==='coking_coal'?'vsa-monthly-fob-australia':product==='hrc'?'vsa-monthly-cfr-vietnam':'vsa-monthly-cfr-china';
  const s=seriesDefinition(product,'price',basis);s.scope=product==='hrc'?'HRC CFR Việt Nam theo VSA.':product==='iron'?'Quặng 62% Fe CFR Trung Quốc theo VSA.':'Than mỡ luyện cốc theo VSA; tham chiếu PVL/FOB Úc trong bản tin.';s.label=`${PRODUCT_BY_ID[product].name} · bình quân tháng VSA`;s.observations=[{period:`${m[3]}-${m[2].padStart(2,'0')}`,value:vnNumber(m[4]),url,source:'vsa',checkedAt,publishedAt:post.date,kind:'monthly-average',evidence:m[0],note:'Giá bình quân tháng được nêu trực tiếp trong bản tin.'}];out.push(s);
 }
 // Total finished-steel monthly data are separately identified, never distributed to individual products.
 const tm=title.match(/tháng\s+(\d{1,2})\/(20\d{2})/i);
 if(tm){const period=`${tm[2]}-${tm[1].padStart(2,'0')}`;const start=text.search(new RegExp(`Tháng\\s+${Number(tm[1])}\\/${tm[2]}\\s*:`,'i'));if(start>=0){const block=text.slice(start).split(/Tính chung|Tính lũy kế|Cả năm|Quý [IV]/i)[0];for(const [metric,re] of [['production',/Sản xuất (?:sản phẩm )?thép (?:thành phẩm(?: các loại)?|các loại)\s+đạt\s+([\d.,]+)\s*(triệu|ngàn|nghìn)?\s*tấn/i],['sales',/Bán hàng thép (?:thành phẩm(?: các loại)?|các loại)(?: trong nước)?\s+đạt\s+([\d.,]+)\s*(triệu|ngàn|nghìn)?\s*tấn/i]]){const m=block.match(re);if(m){const s=seriesDefinition('all_steel',metric,'vsa');s.observations=[{period,value:vnNumber(m[1])*(m[2]==='triệu'?1e6:m[2]?1e3:1),url,source:'vsa',checkedAt,publishedAt:post.date,evidence:m[0],note:m[2]?'Số làm tròn theo đơn vị trong bản tin VSA.':'Theo bản tin VSA.'}];out.push(s);}}}}
 return out.filter(s=>s.observations[0].period>='2015-01');
}
