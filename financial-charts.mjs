import {metricRow,growth} from './earnings.mjs';
import {decimal,previousPeriod} from './ratios.mjs';

const numeric=v=>typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v);
const frac=v=>{const s=String(v),[a,b='']=s.replace(/^-/,'').split('.');return {n:BigInt(a+b)*(s.startsWith('-')?-1n:1n),d:10n**BigInt(b.length)};};
const missing=reason=>({value:null,raw:null,reason,sources:[],warnings:[]});
function valuationCharts(all,{from,to,limit}){
  const annual=(all.AnnualCafeFRatios||all.CafeFRatios||[]).filter(r=>!r.missing&&/^\d{4}$/.test(r.period)&&+r.period>=+from&&+r.period<=+to);
  const available=annual.map(r=>r.period).sort();let years=[];
  if(available.length)for(let y=+available[0];y<=+available.at(-1);y++)years.push(String(y));
  if(limit>0)years=years.slice(-limit);
  const annualPoint=(code,p)=>{
    const r=annual.find(r=>r.period===p),row=r?.rows.find(r=>r.code===code);
    if(!r||r.mappingBlocked||!row||!numeric(row.value)||row.display===null||row.sourceZero||Number(row.value)===0)return missing('CafeF chưa công bố chỉ số năm này hoặc đang hiển thị dấu gạch.');
    const share=['EPS','BV'].includes(code),units=share?['thousand-VND/share','nghìn đồng/CP']:['times','lần'];
    if(!units.includes(row.unit))return missing('Chưa xác nhận đơn vị của chỉ số CafeF.');
    const v=frac(row.value);return {value:decimal({n:v.n*(share?1000n:1n),d:v.d},2),raw:row.value,reason:null,formula:share?'Số CafeF công bố (nghìn đồng/CP) × 1.000 = đồng/CP.':'P/E theo năm do CafeF công bố; không suy ra giá lịch sử.',sources:[source(r,row)],warnings:r.issues||[]};
  };
  const annualSeries=(code,label,unit)=>({key:code,label,unit,type:'line',axis:'left',points:years.map(p=>({period:p,...annualPoint(code,p)}))});
  let snapshots=(all.Valuations||[]).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&+r.date.slice(0,4)>=+from&&+r.date.slice(0,4)<=+to).sort((a,b)=>a.date.localeCompare(b.date));
  if(limit>0)snapshots=snapshots.slice(-limit);
  const dailySeries=code=>({key:'market_'+code,label:code==='pe'?'P/E':'P/B',unit:'lần',type:'line',axis:'left',points:snapshots.map(s=>{
    const v=s.values[code],reason=!numeric(v)||Number(v)===0?'CafeF chưa công bố chỉ số tại lần kiểm tra này.':null;
    return {period:s.date,...(reason?missing(reason):{value:decimal(frac(v),2),raw:v,reason:null,formula:`Giữ nguyên ${code==='pe'?'P/E':'P/B'} CafeF công bố. ${s.basisNote||''} Kiểm tra: ${new Date(s.checkedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} (giờ Việt Nam).${s.priceAt?' Ngày giá tham chiếu của CafeF: '+new Date(s.priceAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})+'.':''}`,sources:[{period:s.date,kind:'MarketValuation',label:code==='pe'?'P/E':'P/B',raw:v,unit:'lần',url:s.url,scope:'source-unspecified',checkedAt:s.checkedAt}],warnings:[]})};
  })});
  return [
    {id:'market-valuation',title:'Định giá P/E và P/B',group:'Định giá',frequency:'day',periods:snapshots.map(s=>s.date),note:'Chỉ số CafeF tại từng ngày kiểm tra, giữ lần cập nhật cuối trong ngày. Lịch sử bắt đầu từ khi thu thập; không phải định giá cuối quý/năm. P/E, P/B có thể được nguồn cập nhật khác thời điểm với giá.',series:[dailySeries('pe'),dailySeries('pb')]},
    {id:'annual-pe',title:'P/E theo năm',group:'Định giá',frequency:'year',periods:years,note:'Chuỗi năm do CafeF công bố, tách riêng với định giá theo ngày. Không gán P/E năm cho từng quý.',series:[annualSeries('PE','P/E','lần')]},
    {id:'annual-per-share',title:'EPS và giá trị sổ sách trên cổ phiếu',group:'Định giá',frequency:'year',periods:years,note:'EPS và giá trị sổ sách/CP theo năm do CafeF công bố. Đã đổi từ nghìn đồng sang đồng/CP; không phải số riêng quý.',series:[annualSeries('EPS','EPS năm','đồng/CP'),annualSeries('BV','Giá trị sổ sách/CP','đồng/CP')]},
  ];
}
const normalized=s=>s.normalize('NFKC').replace(/^\s*(?:[A-ZIVX]+\.?|\d+(?:\.\d+)*\.?)\s+/i,'').replace(/\s+/g,' ').trim();
const patterns={
  assets:/^(?:tổng cộng tài sản|tổng tài sản)(?:\s*\([^)]*\))?$/i,
  shortAssets:/^tài sản ngắn hạn$/i,longAssets:/^tài sản dài hạn$/i,
  equity:/^vốn (?:chủ sở hữu|và các quỹ)(?:\s*\([^)]*\))?$/i,
  liabilities:/^(?:tổng )?nợ phải trả$/i,
  cash:/^tiền và (?:các khoản )?tương đương tiền$/i,
  inventory:/^hàng tồn kho(?:\s*\([^)]*\))?$/i,
  receivables:/^(?:các khoản )?phải thu ngắn hạn$/i,
  operating:/lợi nhuận thuần từ hoạt động kinh doanh(?!.*trước)/i,
  other:/lợi nhuận khác/i,
  cfo:/lưu chuy[ểề]n tiền (?:thuần|ròng).*(?:kinh doanh|HĐKD)(?![\s\S]*trước)/i,
  cfi:/lưu chuyển tiền (?:thuần|ròng).*(?:đầu tư|HĐĐT)/i,
  cff:/lưu chuyển tiền (?:thuần|ròng).*(?:tài chính|HĐTC)/i,
  eps:/(?:lãi|thu nhập) cơ bản trên (?:cổ phiếu|cổ phần)/i,
};
export function chartRow(report,key){
  if(['revenue','profit','pretax','parent'].includes(key))return metricRow(report,key);
  const rows=(report?.rows||[]).filter(r=>!r.heading&&patterns[key]?.test(normalized(r.label)));
  if(key==='equity'&&report?.sector!=='bank')return rows.find(r=>r.code==='400')||(rows.length===1?rows[0]:undefined);
  if(key==='inventory')return rows.find(r=>r.code==='140')||(rows.length===1?rows[0]:undefined);
  return rows.length===1?rows[0]:undefined;
}
function compatible(a,b){
  if(!a||!b||a.missing||b.missing)return 'Thiếu báo cáo để so sánh.';
  if(!['consolidated','separate'].includes(a.scope)||a.scope!==b.scope)return 'Chưa xác nhận cùng phạm vi hợp nhất/riêng lẻ.';
  if((a.sector||'enterprise')!==(b.sector||'enterprise'))return 'Khác mẫu báo cáo ngành.';
  return null;
}
function source(r,row){return {period:r.period,kind:r.kind,label:row.label,raw:row.value,unit:row.unit,scope:r.scope,basis:r.basis,url:row.fromSupplement&&r.supplement?.url?r.supplement.url:r.url};}
function read(r,key,frequency){
  if(!r||r.missing)return missing('Chưa có báo cáo kỳ này.');
  if(r.mappingBlocked)return missing('Chưa xác nhận ánh xạ chỉ tiêu của báo cáo.');
  if(r.kind==='IncSta'&&r.basis!==(frequency==='quarter'?'quarter':'annual'))return missing('Báo cáo không phải số riêng kỳ đã chọn.');
  const row=chartRow(r,key);
  if(!row||!numeric(row.value)||row.display===null)return missing('Chưa có số hoặc chưa xác nhận chỉ tiêu.');
  if(row.unit!==(key==='eps'?'VND/share':'VND'))return missing('Chưa xác nhận đơn vị số liệu.');
  if(key==='eps'&&(row.unit!=='VND/share'||row.sourceZero))return missing('Chưa có EPS được xác nhận từ nguồn.');
  const v=frac(row.value);
  const warnings=[...(r.issues||[])];
  if(key==='eps'&&(v.n>1000000n*v.d||v.n< -1000000n*v.d))warnings.push('EPS từ nguồn lớn bất thường; cần kiểm tra đơn vị trong báo cáo gốc. Biểu đồ giữ nguyên số CafeF.');
  return {value:decimal({n:v.n,d:v.d*(row.unit==='VND'?1000000000n:1n)},2),raw:row.value,reason:null,sources:[source(r,row)],warnings};
}
export function cashPoint(reports,period,key,frequency){
  const current=reports.find(r=>r.period===period),a=read(current,key,frequency);
  if(a.value===null)return a;
  if(frequency==='year')return current.basis==='annual'?a:missing('Dòng tiền không phải báo cáo cả năm.');
  if(current.basis==='quarter')return a;
  if(current.basis!=='ytd')return missing('Chưa xác nhận cơ sở kỳ của dòng tiền.');
  if(period.endsWith('Q1'))return a;
  const prior=reports.find(r=>r.period===previousPeriod(period)),b=read(prior,key,frequency),reason=compatible(current,prior);
  if(reason||prior?.basis!=='ytd'||a.value===null||b.value===null)return missing(reason||b.reason||'Thiếu dòng tiền lũy kế quý trước.');
  const x=frac(a.raw),y=frac(b.raw),diff={n:x.n*y.d-y.n*x.d,d:x.d*y.d};
  return {value:decimal({n:diff.n,d:diff.d*1000000000n},2),raw:decimal(diff,Math.max((a.raw.split('.')[1]||'').length,(b.raw.split('.')[1]||'').length)),reason:null,formula:'Dòng tiền riêng quý = lũy kế quý này − lũy kế quý trước.',sources:[...a.sources,...b.sources],warnings:[...new Set([...a.warnings,...b.warnings])]};
}
export function buildFinancialCharts(all,{frequency='quarter',from=2016,to=new Date().getFullYear(),limit=12}={}){
  const income=all.IncSta||[],balance=all.BSheet||[],cash=all.CashFlow||[],ratios=all.Ratios||[];
  const usable=[...income,...balance,...cash].filter(r=>!r.missing&&(frequency==='quarter'?/^\d{4}-Q[1-4]$/:/^\d{4}$/).test(r.period));
  const available=[...new Set(usable.map(r=>r.period))].sort();
  let periods=[];
  // A continuous axis preserves missing quarters rather than connecting across them.
  if(available.length&&Number(from)<=Number(to))for(let year=Math.max(Number(from),+available[0].slice(0,4));year<=Math.min(Number(to),+available.at(-1).slice(0,4));year++){
    for(const p of frequency==='quarter'?[1,2,3,4].map(q=>`${year}-Q${q}`):[String(year)])if(p>=available[0]&&p<=available.at(-1))periods.push(p);
  }
  const totalPeriods=periods.length;if(limit>0)periods=periods.slice(-limit);
  const find=(reports,p)=>reports.find(r=>r.period===p&&!r.missing);
  const raw=(reports,key,p)=>read(find(reports,p),key,frequency);
  const balances=[...balance,...(all.AnnualBSheet||[])];
  function generalRatio(code,p){
    const current=find(balance,p),isReturn=['roe','roa'].includes(code),key=code==='roe'?'equity':'assets';
    const previous=find(balances,previousPeriod(p))||(p.endsWith('Q1')?find(balances,String(+p.slice(0,4)-1)):undefined);
    const incomeReport=find(income,p),reports=isReturn?[current,previous,incomeReport]:[current];
    if(reports.some(r=>!r||!['consolidated','separate'].includes(r.scope))||new Set(reports.map(r=>r.scope)).size>1)return missing('Thiếu đầu vào cùng phạm vi hợp nhất/riêng lẻ.');
    if(isReturn&&compatible(current,previous))return missing('Khác mẫu báo cáo số dư đầu và cuối kỳ.');
    const a=isReturn?read(incomeReport,'profit',frequency):read(current,code==='liabilities_assets'?'liabilities':'equity',frequency),b=read(current,key,frequency),c=isReturn?read(previous,key,frequency):null;
    const points=[a,b,...(c?[c]:[])],invalid=points.find(x=>x.value==null);if(invalid)return missing(invalid.reason);
    const x=frac(a.raw),y=frac(b.raw),z=c?frac(c.raw):null,den=z?{n:y.n*z.d+z.n*y.d,d:2n*y.d*z.d}:y;
    if(den.n<=0n)return missing('Mẫu số không dương; không tính tỷ lệ.');
    return {value:decimal({n:x.n*den.d*100n,d:x.d*den.n},2),raw:null,reason:null,formula:isReturn?`LNST / ${key==='equity'?'Vốn chủ sở hữu':'Tổng tài sản'} bình quân đầu–cuối kỳ × 100%; quý không nhân 4.`:`${code==='liabilities_assets'?'Nợ phải trả':'Vốn chủ sở hữu'} / Tổng tài sản × 100%`,sources:points.flatMap(x=>x.sources),warnings:[...new Set(points.flatMap(x=>x.warnings))]};
  }
  const ratio=(code,p)=>{
    if(['roe','roa','liabilities_assets','equity_assets'].includes(code))return generalRatio(code,p);
    const row=find(ratios,p)?.rows.find(r=>r.code===code);
    if(!row||row.display==null)return missing(row?.reason||'Chỉ số chưa đủ dữ liệu hoặc chưa hỗ trợ mẫu ngành.');
    const reports=(row.inputs||[]).map(i=>find(i.kind==='BSheet'?balances:all[i.kind]||[],i.period));
    if(reports.some(r=>!r||!['consolidated','separate'].includes(r.scope))||new Set(reports.map(r=>r.scope)).size>1)return missing('Chưa xác nhận cùng phạm vi của các đầu vào.');
    return {value:row.display,raw:null,reason:null,formula:row.formula,sources:(row.inputs||[]).map((i,n)=>({...i,raw:i.value,scope:reports[n].scope})),warnings:row.warnings||[]};
  };
  const yoy=(key,p)=>{
    const previous=`${+p.slice(0,4)-1}${p.slice(4)}`,a=find(income,p),b=find(income,previous),x=raw(income,key,p),y=raw(income,key,previous);
    const value=growth(x.raw,y.raw,compatible(a,b)||x.reason||y.reason);
    return {...value,raw:null,sources:[...x.sources,...y.sources],warnings:[...new Set([...x.warnings,...y.warnings])],formula:'(Kỳ này / cùng kỳ năm trước − 1) × 100%; chỉ tính khi nền dương.'};
  };
  const latest=[...income].filter(r=>!r.missing).sort((a,b)=>b.period.localeCompare(a.period))[0];
  const sector=latest?.sector||'enterprise',revenueLabel={bank:'Thu nhập lãi thuần',security:'Doanh thu hoạt động',insurance:'Doanh thu thuần bảo hiểm',enterprise:'Doanh thu thuần'}[sector]||'Doanh thu chính';
  const series=(key,label,unit,reader,type='line',axis='left')=>({key,label,unit,type,axis,points:periods.map(p=>({period:p,...reader(p)}))});
  const money=(key,label,reports=income,type='line')=>series(key,label,key==='eps'?'đồng/CP':'tỷ đồng',p=>raw(reports,key,p),type);
  const rate=(code,label,unit='%')=>series(code,label,unit,p=>ratio(code,p));
  const flow=(key,label,type='bar')=>series(key,label,'tỷ đồng',p=>cashPoint(cash,p,key,frequency),type);
  const chart=(id,title,group,note,series)=>({id,title,group,note,series});
  return {periods,totalPeriods,sector,revenueLabel,charts:[
    chart('revenue','Doanh thu và tăng trưởng','Kết quả kinh doanh','Cột: quy mô kỳ; đường: tăng trưởng cùng kỳ (%), trục bên phải.',[money('revenue',revenueLabel,income,'bar'),series('revenue_yoy','Tăng trưởng cùng kỳ','%',p=>yoy('revenue',p),'line','right')]),
    chart('profit','Lợi nhuận và tăng trưởng','Kết quả kinh doanh','LNST toàn doanh nghiệp; không tính tăng trưởng khi nền âm hoặc bằng 0.',[money('profit','LNST',income,'bar'),series('profit_yoy','Tăng trưởng cùng kỳ','%',p=>yoy('profit',p),'line','right')]),
    chart('margins','Biên lợi nhuận','Kết quả kinh doanh','Các tỷ suất trên doanh thu thuần. Mẫu ngân hàng, chứng khoán, bảo hiểm có thể chưa áp dụng.',[rate('gross_margin','Biên gộp'),rate('operating_margin','Biên thuần HĐKD'),rate('net_margin','Biên ròng')]),
    chart('income','Các lớp lợi nhuận','Kết quả kinh doanh','Các chỉ tiêu riêng biệt, không cộng chồng. LNST công ty mẹ được tách khỏi LNST toàn doanh nghiệp.',[money('pretax','LNTT'),money('profit','LNST'),money('parent','LNST công ty mẹ')]),
    chart('cashflow','Dòng tiền theo hoạt động','Dòng tiền','Quý 2–4: lũy kế quý này trừ lũy kế quý trước khi cùng phạm vi; không lấy số lũy kế làm số riêng quý.',[flow('cfo','Kinh doanh'),flow('cfi','Đầu tư'),flow('cff','Tài chính')]),
    chart('quality','Lợi nhuận và tiền từ kinh doanh','Dòng tiền','So sánh số riêng kỳ. Đọc thuyết minh để hiểu chênh lệch lợi nhuận và dòng tiền.',[money('profit','LNST',income,'bar'),series('cfo_profit','Dòng tiền HĐKD','tỷ đồng',p=>{const a=find(income,p),b=find(cash,p);if(!a||!b||!['consolidated','separate'].includes(a.scope)||a.scope!==b.scope)return missing('Không cùng phạm vi báo cáo.');return cashPoint(cash,p,'cfo',frequency);})]),
    chart('assets','Quy mô tài sản','Tài sản & nguồn vốn','Số dư cuối kỳ. Ngân hàng không phân loại tài sản ngắn/dài hạn như doanh nghiệp thông thường.',[money('assets','Tổng tài sản',balance),money('shortAssets','Tài sản ngắn hạn',balance),money('longAssets','Tài sản dài hạn',balance)]),
    chart('funding','Nguồn vốn','Tài sản & nguồn vốn','Số dư cuối kỳ. Nợ phải trả bao gồm nợ vay và các khoản phải trả khác.',[money('liabilities','Nợ phải trả',balance,'bar'),money('equity','Vốn chủ sở hữu',balance,'bar')]),
    chart('working','Tiền, phải thu và tồn kho','Tài sản & nguồn vốn','Theo các dòng tổng hợp tương ứng trên báo cáo; không thay chỉ tiêu thiếu bằng 0.',[money('cash','Tiền và tương đương tiền',balance),money('receivables','Phải thu ngắn hạn',balance),money('inventory','Hàng tồn kho',balance)]),
    chart('returns','Hiệu quả sử dụng vốn','Chỉ số tài chính','ROE/ROA dùng LNST và số dư bình quân đầu–cuối kỳ. Quý không nhân 4; không phải chỉ số 12 tháng.',[rate('roe','ROE'),rate('roa','ROA')]),
    chart('leverage','Cơ cấu nợ và vốn','Chỉ số tài chính','Tỷ trọng trên tổng tài sản; chỉ dùng đầu vào đủ số và cùng phạm vi.',[rate('liabilities_assets','Nợ phải trả / Tài sản'),rate('equity_assets','Vốn chủ sở hữu / Tài sản')]),
    chart('liquidity','Khả năng thanh toán','Chỉ số tài chính','Hệ số nhanh giản lược = (tài sản ngắn hạn − tồn kho) / nợ ngắn hạn.',[rate('current_ratio','Hiện hành','lần'),rate('quick_ratio','Nhanh','lần'),rate('cash_ratio','Bằng tiền','lần')]),
    chart('eps','Thu nhập trên cổ phiếu','Chỉ số tài chính','EPS do CafeF công bố, đơn vị đồng/CP; không cộng EPS các quý và không thay dấu gạch bằng 0.',[money('eps','EPS cơ bản',income,'bar')]),
    ...valuationCharts(all,{from,to,limit}),
  ]};
}
