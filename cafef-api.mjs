// Public endpoints used by CafeF's current FinancialAjax tabs (October 2026).
// Keep source IDs apart from our stable formula IDs: the income form changed in 2026.
import {sectorOf,insuranceCode,enrich} from './cafef-sectors.mjs';
export const endpoints={BSheet:'v2/BCTC/GetReportCDKT',IncSta:'v1/BCTC/GetReportDetail',CashFlow:'v1/BCTC/GetReportLCTT',CafeFRatios:'v2/BCTC/FinancialIndicators'};
export function sourceUrl(symbol,kind,frequency,page=1,size=50){return `https://apiweb.cafef.vn/api/${endpoints[kind]}?symbol=${encodeURIComponent(symbol)}&pageIndex=${page}&pageSize=${size}${kind==='CafeFRatios'?'':`&reportType=${kind==='IncSta'?'KQKD':'ALL'}&TypeTime=${frequency==='quarter'?'QUY':'NAM'}`}`;}
export function expandNumber(value){
 const m=String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);if(!m)throw Error('Số nguồn không nhận diện: '+value);
 const digits=m[2]+(m[3]||''),point=m[2].length+Number(m[4]||0);if(Math.abs(point)>1000)throw Error('Số nguồn vượt giới hạn');
 let s=point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point);
 s=s.replace(/^0+(?=\d)/,'').replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');return (m[1]&&s!=='0'?'-':'')+s;
}
export function parseExact(text){return JSON.parse(text,(key,value,context)=>['value','Value'].includes(key)?typeof value==='number'?expandNumber(context.source):typeof value==='string'&&/^-?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(value)?expandNumber(value):value:value);}
const incomeMap={'1':'01','2':'02','21':'investment-property','22':'21','23':'22','24':'23','27':'24'};
const incomeOld={'22':'21','23':'22','24':'23','27':'24'};
export function publishedUnit(code){return ['EPS','BV'].includes(code)?'thousand-VND/share':['PE','PB','TSTTHH','KNTTLV','TSNVTVCSH'].includes(code)?'times':['GOS','ROS','ROE','ROA','DAR'].includes(code)?'percent':'source-unit';}
const cashMap={HDKD_2:'01',HDKD_3:'heading-adjustments',HDKD_4:'02',HDKD_5:'03',HDKD_6:'04',HDKD_7:'05',HDKD_8:'06',HDKD_9:'07',HDKD_10:'08',HDKD_11:'09',HDKD_12:'10',HDKD_13:'11',HDKD_14:'12',HDKD_15:'13',HDKD_16:'14',HDKD_17:'15',HDKD_18:'16',HDKD_19:'17',HDKD_20:'20',HDDT_22:'21',HDDT_23:'22',HDDT_24:'23',HDDT_25:'24',HDDT_26:'25',HDDT_27:'26',HDDT_28:'27',HDDT_29:'30',HDTC_31:'31',HDTC_32:'32',HDTC_33:'33',HDTC_34:'34',HDTC_35:'35',HDTC_36:'36',HDTC_37:'37',HDTC_38:'40',HDTC_39:'50',HDTC_40:'60',HDTC_41:'61',HDTC_42:'70'};
export function parseApi(text,{symbol,kind,frequency,url,supplement}){
 const json=parseExact(text);if(!json.isSuccess||!json.value||!Array.isArray(json.value.templace)||!Array.isArray(json.value.data))throw Error('CafeF API: cấu trúc hoặc trạng thái không hợp lệ');
 const v=json.value,flat=kind==='IncSta'||kind==='CafeFRatios',sector=sectorOf(v,kind);
 if(supplement)enrich(v,parseExact(supplement.text),supplement.type);
 const sections=flat?[{code:kind,name:kind,data:v.templace}]:v.templace;
 const dataSections=flat?[{code:kind,data:v.data}]:v.data;
 const regular=kind==='IncSta'?v.templace.some(x=>String(x.code)==='10'&&/doanh thu thuần/i.test(x.name)):true;
 const cashRows=kind==='CashFlow'?v.templace.flatMap(s=>s.data||[]):[];
 const regularCash=kind==='CashFlow'&&/lưu chuyển tiền thuần.*kinh doanh/i.test(cashRows.find(x=>x.code==='HDKD_20')?.name||'')&&/lưu chuyển tiền thuần.*đầu tư/i.test(cashRows.find(x=>x.code==='HDDT_29')?.name||'');
 const grouped=new Map();
 for(const section of sections){const block=dataSections.find(x=>x.code===section.code);if(!block?.data)continue;
  for(const p of block.data){const year=Number(p.year),quarter=Number(p.quater||p.quarter||0);if(!Number.isInteger(year)||year<2016)continue;if(frequency==='quarter'&&!(quarter>=1&&quarter<=4))continue;
   const period=frequency==='quarter'?`${year}-Q${quarter}`:String(year);
   let report=grouped.get(period);
   if(!report){report={symbol,kind,period,source:'CafeF',adapter:'cafef-api-2026',mappingVerified:true,url,scope:String(p.type||'').startsWith('H')?'consolidated':String(p.type||'').startsWith('R')?'separate':'source-unspecified',sourceScope:p.type,sourceCaption:p.content||'',sections:[],sourceAlternates:[],basis:frequency==='year'?'annual':kind==='CashFlow'?'ytd':'quarter',unitNote:'Số gốc từ API của trang tài chính CafeF. Ô giá trị 0 được CafeF hiển thị dấu gạch; giữ số 0 trong dữ liệu gốc. Nếu nguồn trả nhiều phiên bản cùng kỳ, ưu tiên phiên bản xuất hiện trước trong phản hồi CafeF, lưu toàn bộ phản hồi gốc.',rows:[]};grouped.set(period,report);}
   if(report.sections.includes(section.code)){report.sourceAlternates.push({section:section.code,type:p.type,content:p.content});continue;}
   if(report.sourceScope!==p.type)throw Error('CafeF trả phạm vi khác nhau giữa các phần của báo cáo '+period);
   report.sector=sector;if(supplement)report.supplement={hash:supplement.hash,url:supplement.url,type:supplement.type};
   report.sections.push(section.code);
   for(let idx=0;idx<section.data.length;idx++){
    const t=section.data[idx],templateCode=String(t.code??''),trimmed=templateCode.trim();let lookup=templateCode;
    // Reproduce CafeF's findKqkdItemValue, including its historical code remap.
    if(kind==='IncSta'&&regular&&year<=2025){if(trimmed==='21')lookup=null;else if(incomeOld[trimmed]&&p.data.some(x=>String(x.code)===incomeOld[trimmed]))lookup=incomeOld[trimmed];}
    if(kind==='IncSta'&&sector==='insurance')lookup=insuranceCode(p,templateCode);
    const datum=lookup===null?null:p.data.find(x=>String(x.code)===lookup);
    const value=datum?.value==null||datum.value===''?null:String(datum.value);
    if(value!==null&&!/^-?\d+(?:\.\d+)?$/.test(value))throw Error(`CafeF API: số không nhận diện ${symbol}/${period}/${templateCode}`);
    const code=!trimmed?`heading-${section.code}-${idx}`:kind==='IncSta'&&regular?(incomeMap[trimmed]||trimmed):regularCash?(cashMap[trimmed]||trimmed):trimmed;
    const unit=kind==='CafeFRatios'?publishedUnit(code):/cổ phiếu/i.test(t.name)&&kind==='IncSta'?'VND/share':'VND';
    const row={code,sourceCode:lookup,templateCode,section:section.code,label:String(t.name),level:kind==='IncSta'?(['10','20','30','50','60'].includes(code)?0:1):Math.max(0,Math.min(2,Number(t.lever||1)-1)),value,unit,heading:!trimmed||code.startsWith('heading-'),sourceZero:value!==null&&/^[-]?0(?:\.0+)?$/.test(value)};
    if(kind==='IncSta'&&!regular)row.level=Math.max(0,Math.min(2,Number(t.lever||1)-1));
    if(datum?.fromSupplement){row.fromSupplement=true;row.supplementIndex=datum.supplementIndex;}
    if(report.rows.some(x=>x.code===code))throw Error(`CafeF API: mã trùng ${symbol}/${kind}/${code}`);
    report.rows.push(row);
   }
  }
 }
 return {reports:[...grouped.values()].sort((a,b)=>b.period.localeCompare(a.period)),count:Number(v.count||0),hasOlder:dataSections.some(s=>s.data?.some(p=>Number(p.year)<2016))};
}
export function moneyDisplay(value,kind){
 if(value==null)return null;
 const parts=String(value).split('.'),den=10n**BigInt(parts[1]?.length||0),n=BigInt(parts.join(''));if(n===0n)return null;
 const abs=n<0n?-n:n,digits=kind==='CashFlow'||abs>=10000000n*den?2:4,scale=10n**BigInt(digits),divisor=1000000000n*den,rounded=(abs*scale+divisor/2n)/divisor;
 if(kind!=='CashFlow'&&abs<50000n*den)return null;
 const str=rounded.toString().padStart(digits+1,'0'),decimal=str.slice(-digits).replace(/0+$/,'').padEnd(2,'0');return `${n<0n&&rounded?'-':''}${str.slice(0,-digits)}.${decimal}`;
}
export function shareDisplay(value,code){
 if(value==null)return null;const parts=String(value).split('.'),den=10n**BigInt(parts[1]?.length||0),n=BigInt(parts.join(''));if(n===0n)return null;
 const isEps=['23','70','71'].includes(String(code)),digits=isEps?4:2,scale=10n**BigInt(digits),rounded=((n<0n?-n:n)*scale+den/2n)/den,str=rounded.toString().padStart(digits+1,'0'),decimal=isEps?str.slice(-digits).replace(/0+$/,''):str.slice(-digits);
 return `${n<0n&&rounded?'-':''}${str.slice(0,-digits)}${decimal?'.'+decimal:''}`;
}
