import {decimal,previousPeriod} from './ratios.mjs';

export const EARNINGS_METRICS=[
  {key:'revenue',label:'Doanh thu / thu nhập chính'},
  {key:'pretax',label:'Lợi nhuận trước thuế'},
  {key:'profit',label:'Lợi nhuận sau thuế'},
  {key:'parent',label:'LNST thuộc cổ đông công ty mẹ'}
];
export function latestEarningsPeriod(now=new Date()){
  const vn=new Date(new Date(now).getTime()+7*3600000);
  const year=vn.getUTCFullYear(),quarter=Math.floor(vn.getUTCMonth()/3);
  return quarter?`${year}-Q${quarter}`:`${year-1}-Q4`;
}
export function earningsPeriods(now=new Date(),count=8){
  const periods=[];let p=latestEarningsPeriod(now);
  while(periods.length<count&&+p.slice(0,4)>=2016){periods.push(p);p=previousPeriod(p);}
  return periods;
}
const numeric=v=>typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v);
const q=v=>{const [a,b='']=v.replace(/^-/,'').split('.');return {n:BigInt(a+b)*(v.startsWith('-')?-1n:1n),d:10n**BigInt(b.length)};};
const sum=vs=>vs.map(q).reduce((a,b)=>({n:a.n*b.d+b.n*a.d,d:a.d*b.d}),{n:0n,d:1n});
const exactSum=vs=>decimal(sum(vs),Math.max(0,...vs.map(v=>(v.split('.')[1]||'').length)));
const empty=reason=>({value:null,display:null,reason});
const amount=(value,unit='VND')=>{const x=q(value);return {value,display:decimal({n:x.n,d:x.d*(unit==='VND'?1000000000n:1n)},2),reason:null};};
const valid=r=>r&&!r.missing&&r.kind==='IncSta'&&r.basis==='quarter'&&!r.mappingBlocked;
const normalized=s=>s.normalize('NFKC').toLocaleLowerCase('vi').replace(/^\s*(?:[ivxlcdm]+\.|\d+(?:\.\d+)*[.\s]|-)\s*/i,'').replace(/\([^)]*\)/g,'').replace(/[^\p{L}\p{N}]/gu,'');
export function metricRow(report,key){
  if(!report)return;
  const sector=report.sector||'enterprise';
  const pattern=key==='revenue'?(sector==='bank'?/thu nhập lãi thuần/i:sector==='security'?/(?:cộng|tổng) doanh thu hoạt động\s*$/i:sector==='insurance'?/doanh thu thuần.*(?:BH|bảo hiểm)/i:/doanh thu thuần/i)
    :key==='pretax'?/(?:tổng )?lợi nhuận (?:kế toán )?trước thuế/i
    :key==='parent'?/lợi nhuận sau thuế.*(?:mẹ|phân bổ cho chủ sở hữu)/i
    :/(?:lợi nhuận sau thuế|lợi nhuận kế toán sau thuế)(?!.*(?:mẹ|kiểm soát|cổ đông|phân bổ|trích))/i;
  const matches=report.rows.filter(r=>!r.heading&&pattern.test(r.label));
  return matches.length===1?matches[0]:undefined;
}
function compatible(a,b){
  if(!valid(a)||!valid(b))return 'Thiếu báo cáo riêng quý hoặc ánh xạ chỉ tiêu chưa xác nhận.';
  if((a.sector||'enterprise')!==(b.sector||'enterprise'))return 'Khác mẫu báo cáo ngành.';
  if(!['consolidated','separate'].includes(a.scope)||!['consolidated','separate'].includes(b.scope))return 'Chưa xác nhận phạm vi hợp nhất / riêng lẻ.';
  if(a.scope!==b.scope)return 'Khác phạm vi hợp nhất / riêng lẻ.';
  return null;
}
function read(r,getter){
  if(!valid(r))return empty(r?.mappingBlocked?'Chưa xác nhận ánh xạ chỉ tiêu.':'Chưa có số liệu riêng quý từ CafeF.');
  const row=getter(r);
  if(!row||!numeric(row.value))return empty('CafeF chưa có số cho chỉ tiêu này.');
  if(!['VND','VND/share'].includes(row.unit))return empty('Chưa hỗ trợ đơn vị của nguồn.');
  return amount(row.value,row.unit);
}
export function growth(current,base,reason=null){
  if(reason)return {value:null,reason};
  if(!numeric(current)||!numeric(base))return {value:null,reason:'Thiếu số liệu so sánh.'};
  const a=q(current),b=q(base);
  if(b.n<=0n)return {value:null,reason:b.n===0n?'Nền bằng 0':'Nền âm'};
  return {value:decimal({n:(a.n*b.d-b.n*a.d)*100n,d:a.d*b.n},2),reason:null};
}
function cumulative(map,period,getter){
  const year=+period.slice(0,4),quarter=+period.at(-1),anchor=map.get(period);
  if(!valid(anchor))return empty('Chưa có báo cáo quý đích; chưa tính lũy kế.');
  if(getter(anchor)?.unit==='VND/share')return empty('Không cộng EPS từng quý thành EPS lũy kế.');
  const values=[];
  for(let i=1;i<=quarter;i++){
    const p=`${year}-Q${i}`,r=map.get(p),reason=compatible(anchor,r),v=read(r,getter);
    if(reason||v.value===null)return empty(`${p}: ${reason||v.reason}`);
    if(getter(r)?.unit!=='VND')return empty('Các quý không cùng đơn vị tiền tệ.');
    values.push(v.value);
  }
  return amount(exactSum(values));
}
export function compareIncome(reports,period,getter){
  if(!/^\d{4}-Q[1-4]$/.test(period))throw Error('Kỳ KQKD không hợp lệ.');
  const map=new Map(reports.filter(r=>!r.missing).map(r=>[r.period,r]));
  const prev=previousPeriod(period),prior=`${+period.slice(0,4)-1}-Q${period.at(-1)}`;
  const r=map.get(period),a=map.get(prior),b=map.get(prev);
  const current=read(r,getter),yearAgo=read(a,getter),previous=read(b,getter);
  const ytd=cumulative(map,period,getter),priorYtd=cumulative(map,prior,getter);
  const unitReason=other=>getter(r)?.unit!==getter(other)?.unit?'Khác đơn vị chỉ tiêu.':null;
  return {current,yearAgo,previous,ytd,priorYtd,
    yoy:growth(current.value,yearAgo.value,compatible(r,a)||unitReason(a)),
    qoq:growth(current.value,previous.value,compatible(r,b)||unitReason(b)),
    ytdGrowth:growth(ytd.value,priorYtd.value,compatible(r,a)||ytd.reason||priorYtd.reason)};
}
export function summarizeEarnings(company,reports,period){
  const report=reports.find(r=>r.period===period&&!r.missing);
  return {symbol:company.symbol,available:!!report,sector:report?.sector||null,scope:report?.scope||null,
    updated:report?.updated||null,issues:report?.issues||[],
    metrics:Object.fromEntries(EARNINGS_METRICS.map(m=>[m.key,{label:metricRow(report,m.key)?.label||m.label,...compareIncome(reports,period,r=>metricRow(r,m.key))}]))};
}
export function incomeDetail(reports,period){
  const current=reports.find(r=>r.period===period&&!r.missing);
  if(!current)return [];
  return current.rows.filter(row=>!row.heading||numeric(row.value)&&q(row.value).n!==0n).map(row=>{
    const get=r=>{
      const rows=r.rows.filter(x=>x.unit===row.unit&&normalized(x.label)===normalized(row.label));
      return rows.find(x=>x.code===row.code)||(rows.length===1?rows[0]:undefined);
    };
    return {code:row.code,label:row.label,unit:row.unit,level:row.level,...compareIncome(reports,period,get)};
  });
}
