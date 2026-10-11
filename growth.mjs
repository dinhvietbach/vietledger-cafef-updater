import {compareIncome} from './earnings.mjs';

const decimal=v=>{if(typeof v!=='string'||!/^\d+(?:\.\d+)?$/.test(v))return null;const [a,b='']=v.split('.');return {n:BigInt(a+b),d:10n**BigInt(b.length)};};
export function exceedsGrowth(metric,threshold=10){
  if(metric?.yoy?.value==null)return false;
  const a=decimal(metric.current.value),b=decimal(metric.yearAgo.value),t=decimal(String(threshold));
  return !!(a&&b&&t&&b.n>0n&&(a.n*b.d-b.n*a.d)*100n*t.d>t.n*a.d*b.n);
}
export const qualifiesGrowth=(company,threshold=10)=>company.available&&exceedsGrowth(company.metrics?.revenue,threshold)&&exceedsGrowth(company.metrics?.profit,threshold);
export function safeSourceUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export const recentPublication=(record,days,now=new Date())=>{const time=Date.parse(record?.publishedAt);return Number.isFinite(time)&&time<=+new Date(now)&&+new Date(now)-time<=days*86400000;};
export function researchFingerprint(summary){return JSON.stringify([summary.scope,summary.sector,...['revenue','profit'].flatMap(k=>[summary.metrics[k].current.value,summary.metrics[k].yearAgo.value])]);}
const fmt=n=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(n);
const numeric=v=>typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v);
const findRow=(r,pattern)=>{const matches=r.rows.filter(x=>!x.heading&&x.unit==='VND'&&pattern.test(x.label));return matches.length===1?matches[0]:undefined;};
export function analyzeGrowth(summary,reports,period,research={}){
  const current=reports.find(r=>r.period===period&&!r.missing);
  const evidence=[],cautions=[];
  if(!current)return null;
  const revenue=summary.metrics.revenue,profit=summary.metrics.profit;
  const compare=pattern=>compareIncome(reports,period,r=>findRow(r,pattern));
  if(summary.sector==='enterprise'){
    const gross=compare(/lợi nhuận gộp/i);
    if(gross.yoy.value!=null&&revenue.yoy.value!=null&&Number(revenue.current.value)>0){
      const now=100*Number(gross.current.value)/Number(revenue.current.value),before=100*Number(gross.yearAgo.value)/Number(revenue.yearAgo.value);
      evidence.push(`Lợi nhuận gộp ${fmt(Number(gross.current.display))} tỷ (${Number(gross.yoy.value)>0?'+':''}${fmt(Number(gross.yoy.value))}%); biên gộp ${fmt(now)}% so với ${fmt(before)}% cùng kỳ.`);
      if(now<before)cautions.push('Biên lợi nhuận gộp giảm so với cùng kỳ.');
    }
    const items=[[/doanh thu hoạt động tài chính/i,'Doanh thu tài chính',1],[/chi phí tài chính\s*$/i,'Chi phí tài chính',-1],[/chi phí bán hàng/i,'Chi phí bán hàng',-1],[/chi phí quản lý doanh nghiệp/i,'Chi phí quản lý',-1],[/lợi nhuận khác/i,'Lợi nhuận khác',1]];
    const changes=items.map(([pattern,label,sign])=>{const m=compare(pattern);return m.yoy.reason&& !['Nền âm','Nền bằng 0'].includes(m.yoy.reason)||!numeric(m.current.value)||!numeric(m.yearAgo.value)?null:{label,delta:(Number(m.current.value)-Number(m.yearAgo.value))/1e9,sign};}).filter(Boolean).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
    for(const x of changes.slice(0,2))if(Math.abs(x.delta)>=0.01)evidence.push(`${x.label} ${x.delta>=0?'tăng':'giảm'} ${fmt(Math.abs(x.delta))} tỷ, ${x.delta*x.sign>=0?'hỗ trợ':'làm giảm'} lợi nhuận trước thuế so với cùng kỳ.`);
    const other=compare(/lợi nhuận khác/i),pretax=summary.metrics.pretax;
    if(Number(pretax.current.value)>0&&Number(other.current.value)/Number(pretax.current.value)>0.2)cautions.push('Lợi nhuận khác chiếm trên 20% LNTT; cần kiểm tra tính lặp lại.');
  }
  if(!evidence.length&&profit.yoy.value!=null&&revenue.yoy.value!=null)evidence.push(`LNST tăng ${fmt(Number(profit.yoy.value))}% trên mức tăng ${fmt(Number(revenue.yoy.value))}% của ${revenue.label.toLocaleLowerCase('vi')}. Cần đọc thuyết minh để xác định động lực kinh doanh.`);
  if(profit.qoq.value!=null&&Number(profit.qoq.value)<0)cautions.push(`LNST giảm ${fmt(-Number(profit.qoq.value))}% so với quý trước.`);
  if(!research.publishedAt)cautions.push('Chưa xác nhận ngày công bố; thời điểm thu thập không phải ngày công bố.');
  if(research.fiscalPeriod)cautions.push(`Niên độ riêng: ${research.fiscalPeriod}.`);
  if(summary.issues?.length)cautions.push('Báo cáo còn cảnh báo nguồn; đọc chi tiết trước khi sử dụng.');
  const stale=!!research.fingerprint&&research.fingerprint!==researchFingerprint(summary);
  if(stale)cautions.push('Số nguồn đã đổi sau lần nghiên cứu; phần giải thích doanh nghiệp cần được rà soát lại.');
  const verified=!!research.businessNote&&!stale;
  return {evidence,cautions,businessNote:verified?research.businessNote:null,businessSources:verified?(research.businessSources||[]):[],researchStatus:verified?'verified':stale?'stale':'quantitative',reviewedAt:research.reviewedAt||null};
}
