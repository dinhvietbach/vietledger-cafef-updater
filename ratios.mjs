// Calculate from exact source VND with rational BigInt arithmetic.
// No rounding of monetary inputs or intermediate ratios.
const q=(n,d=1n)=>{const parts=String(n).split('.');return {n:BigInt(parts.join('')),d:BigInt(d)*10n**BigInt(parts[1]?.length||0)};};
const add=(a,b)=>q(a.n*b.d+b.n*a.d,a.d*b.d);
const sub=(a,b)=>q(a.n*b.d-b.n*a.d,a.d*b.d);
const mul=(a,b)=>q(a.n*b.n,a.d*b.d);
const div=(a,b)=>{if(b.n<=0n)throw Error('Mẫu số không dương; không tính chỉ số.');return q(a.n*b.d,a.d*b.n);};
const avg=(a,b)=>div(add(a,b),q(2));
const pct=(a,b)=>mul(div(a,b),q(100));
export function decimal(a,digits=2){const sign=a.n<0n?-1n:1n;const scale=10n**BigInt(digits);const n=a.n*sign*scale;const rounded=(n+a.d/2n)/a.d;const s=rounded.toString().padStart(digits+1,'0');return `${rounded&&sign<0n?'-':''}${digits===0?s:s.slice(0,-digits)+'.'+s.slice(-digits)}`;}
export function previousPeriod(period){const m=period.match(/^(\d{4})-Q([1-4])$/);if(!m)return String(+period-1);return +m[2]===1?`${+m[1]-1}-Q4`:`${m[1]}-Q${+m[2]-1}`;}
const previousYear=p=>`${+p.slice(0,4)-1}${p.slice(4)}`;
export function daysInPeriod(period){const y=+period.slice(0,4),quarter=period.includes('-Q')?+period.at(-1):null;const m=quarter?(quarter-1)*3:0;return Math.round((Date.UTC(y,quarter?m+3:12,1)-Date.UTC(y,m,1))/86400000);}
const names={BSheet:'Cân đối kế toán',IncSta:'Kết quả kinh doanh',CashFlow:'Lưu chuyển tiền tệ'};
const definitions=[];
function define(code,group,label,unit,formula,calc,{main=false,note=''}={}){definitions.push({code,group,label,unit,formula,calc,main,note});}
define('gross_margin','Sinh lời','Biên lợi nhuận gộp','%','Lợi nhuận gộp / Doanh thu thuần × 100',c=>pct(c.income('20'),c.income('10')),{main:true});
define('operating_margin','Sinh lời','Biên lợi nhuận thuần HĐKD','%','Lợi nhuận thuần HĐKD / Doanh thu thuần × 100',c=>pct(c.income('30'),c.income('10')),{note:'Lợi nhuận thuần HĐKD theo mã 30 của báo cáo Việt Nam, bao gồm hoạt động tài chính; không đồng nhất với EBIT.'});
define('pretax_margin','Sinh lời','Biên lợi nhuận trước thuế','%','Lợi nhuận trước thuế / Doanh thu thuần × 100',c=>pct(c.income('50'),c.income('10')));
define('net_margin','Sinh lời','Biên lợi nhuận ròng (ROS)','%','Lợi nhuận sau thuế toàn doanh nghiệp / Doanh thu thuần × 100',c=>pct(c.income('60'),c.income('10')),{main:true});
define('ebit_margin','Sinh lời','Biên EBIT','%','(Lợi nhuận trước thuế + Chi phí lãi vay) / Doanh thu thuần × 100',c=>pct(add(c.income('50'),c.income('23')),c.income('10')));
define('roa','Sinh lời','ROA · lợi nhuận trên tài sản','%','Lợi nhuận sau thuế / Tài sản bình quân đầu–cuối kỳ × 100',c=>pct(c.income('60'),c.average('270')),{main:true,note:'Quý dùng lợi nhuận riêng quý, không nhân 4. Năm dùng lợi nhuận cả năm. Không phải ROA 12 tháng gần nhất.'});
define('roe','Sinh lời','ROE · lợi nhuận trên vốn chủ sở hữu','%','Lợi nhuận sau thuế toàn doanh nghiệp / Vốn chủ sở hữu bình quân đầu–cuối kỳ × 100',c=>pct(c.income('60'),c.average('400')),{main:true,note:'LNST và vốn chủ sở hữu cùng phạm vi toàn doanh nghiệp, bao gồm lợi ích không kiểm soát nếu có. Quý không nhân 4; không phải ROE của riêng cổ đông công ty mẹ.'});
define('revenue_growth','Tăng trưởng','Tăng trưởng doanh thu cùng kỳ','%','(Doanh thu kỳ này / Doanh thu cùng kỳ năm trước − 1) × 100',c=>c.growth('IncSta','10'),{main:true});
define('profit_growth','Tăng trưởng','Tăng trưởng LNST cùng kỳ','%','(LNST kỳ này / LNST cùng kỳ năm trước − 1) × 100',c=>c.growth('IncSta','60'),{main:true,note:'Không tính tỷ lệ khi LNST kỳ gốc bằng 0 hoặc âm; giữ trạng thái không tính để tránh gây hiểu nhầm khi chuyển lỗ/lãi.'});
define('asset_growth','Tăng trưởng','Tăng trưởng tổng tài sản cùng kỳ','%','(Tài sản cuối kỳ này / Tài sản cùng kỳ năm trước − 1) × 100',c=>c.growth('BSheet','270'));
define('equity_growth','Tăng trưởng','Tăng trưởng vốn chủ sở hữu cùng kỳ','%','(VCSH cuối kỳ này / VCSH cùng kỳ năm trước − 1) × 100',c=>c.growth('BSheet','400'));
define('current_ratio','Thanh khoản','Hệ số thanh toán hiện hành','lần','Tài sản ngắn hạn / Nợ ngắn hạn',c=>div(c.balance('100'),c.balance('310')),{main:true});
define('quick_ratio','Thanh khoản','Thanh toán nhanh · giản lược','lần','(Tài sản ngắn hạn − Hàng tồn kho) / Nợ ngắn hạn',c=>div(sub(c.balance('100'),c.balance('140')),c.balance('310')),{note:'Biến thể giản lược: chưa loại riêng trả trước và các tài sản ngắn hạn kém thanh khoản khác; có thể khác hệ số nhanh do nhà cung cấp công bố.'});
define('cash_ratio','Thanh khoản','Thanh toán tức thời bằng tiền','lần','Tiền và tương đương tiền / Nợ ngắn hạn',c=>div(c.balance('110'),c.balance('310')),{note:'Không cộng đầu tư tài chính ngắn hạn vào tiền; công thức được cố định để nhất quán qua các kỳ.'});
define('working_capital','Thanh khoản','Vốn lưu động ròng','tỷ đồng','(Tài sản ngắn hạn − Nợ ngắn hạn) / 1.000.000.000',c=>div(sub(c.balance('100'),c.balance('310')),q(1000000000)));
define('liabilities_assets','Đòn bẩy','Nợ phải trả / Tổng tài sản','%','Tổng nợ phải trả / Tổng tài sản × 100',c=>pct(c.balance('300'),c.balance('270')),{main:true,note:'Nợ phải trả bao gồm cả nợ vay và các khoản phải trả khác.'});
define('liabilities_equity','Đòn bẩy','Nợ phải trả / Vốn chủ sở hữu','lần','Tổng nợ phải trả / Vốn chủ sở hữu',c=>div(c.balance('300'),c.balance('400')));
define('equity_assets','Đòn bẩy','Vốn chủ sở hữu / Tổng tài sản','%','Vốn chủ sở hữu / Tổng tài sản × 100',c=>pct(c.balance('400'),c.balance('270')));
define('debt_equity','Đòn bẩy','Nợ vay / Vốn chủ sở hữu','lần','(Vay và thuê tài chính ngắn hạn + dài hạn) / Vốn chủ sở hữu',c=>div(c.debt(),c.balance('400')),{main:true,note:'Dùng mã 320 và 338. Đây là nợ vay, khác tổng nợ phải trả. Ô trống không tự được coi là không có nợ.'});
define('net_debt_equity','Đòn bẩy','Nợ vay ròng / Vốn chủ sở hữu','lần','(Nợ vay ngắn hạn + dài hạn − Tiền và tương đương tiền) / Vốn chủ sở hữu',c=>div(sub(c.debt(),c.balance('110')),c.balance('400')));
define('interest_coverage','Đòn bẩy','Khả năng thanh toán lãi vay','lần','(Lợi nhuận trước thuế + Chi phí lãi vay) / Chi phí lãi vay',c=>div(add(c.income('50'),c.income('23')),c.income('23')),{note:'EBIT tính bằng lợi nhuận trước thuế cộng chi phí lãi vay. Không trả về vô cực khi lãi vay bằng 0.'});
define('asset_turnover','Hiệu quả hoạt động','Vòng quay tổng tài sản','lần','Doanh thu thuần / Tổng tài sản bình quân đầu–cuối kỳ',c=>div(c.income('10'),c.average('270')),{main:true,note:'Theo đúng kỳ báo cáo. Vòng quay theo quý không nhân 4.'});
define('inventory_turnover','Hiệu quả hoạt động','Vòng quay hàng tồn kho','lần','Giá vốn hàng bán / Hàng tồn kho bình quân đầu–cuối kỳ',c=>div(c.income('11'),c.average('140')));
define('receivables_turnover','Hiệu quả hoạt động','Vòng quay phải thu khách hàng','lần','Doanh thu thuần / Phải thu ngắn hạn khách hàng bình quân',c=>div(c.income('10'),c.average('131')),{note:'Dùng doanh thu thuần thay doanh thu bán chịu do BCTC không tách riêng; dùng phải thu khách hàng mã 131, không dùng toàn bộ phải thu ngắn hạn.'});
define('dso','Hiệu quả hoạt động','Số ngày thu tiền (DSO) · ước tính','ngày','Phải thu khách hàng bình quân / Doanh thu thuần × Số ngày thực tế trong kỳ',c=>c.dso());
define('dio','Hiệu quả hoạt động','Số ngày tồn kho (DIO)','ngày','Hàng tồn kho bình quân / Giá vốn hàng bán × Số ngày thực tế trong kỳ',c=>c.dio());
define('dpo','Hiệu quả hoạt động','Số ngày phải trả (DPO) · ước tính','ngày','Phải trả người bán ngắn hạn bình quân / Giá vốn hàng bán × Số ngày thực tế trong kỳ',c=>c.dpo(),{note:'Giá vốn được dùng thay giá trị mua hàng; đây là ước tính, không phải DPO tính từ mua hàng thực tế.'});
define('cash_cycle','Hiệu quả hoạt động','Chu kỳ chuyển đổi tiền · ước tính','ngày','DSO + DIO − DPO (DPO dùng giá vốn thay giá trị mua hàng)',c=>sub(add(c.dso(),c.dio()),c.dpo()),{main:true});
define('cash_profit','Dòng tiền','Dòng tiền kinh doanh / LNST','lần','Lưu chuyển tiền thuần HĐKD riêng kỳ / Lợi nhuận sau thuế riêng kỳ',c=>div(c.cash('20'),c.income('60')),{main:true,note:'Quý 2–4: lấy lũy kế đến cuối quý trừ lũy kế cuối quý trước; không lấy số lũy kế chia cho lợi nhuận riêng quý.'});
define('cash_margin','Dòng tiền','Dòng tiền kinh doanh / Doanh thu','%','Lưu chuyển tiền thuần HĐKD riêng kỳ / Doanh thu thuần riêng kỳ × 100',c=>pct(c.cash('20'),c.income('10')));
define('free_cash_flow','Dòng tiền','Dòng tiền tự do · giản lược','tỷ đồng','(Dòng tiền HĐKD + Tiền chi mua sắm, xây dựng TSCĐ và tài sản dài hạn khác) / 1 tỷ',c=>{const capex=c.cash('21');if(capex.n>0n)throw Error('Dòng chi đầu tư có dấu dương; cần kiểm tra quy ước dấu của nguồn.');return div(add(c.cash('20'),capex),q(1000000000));},{note:'Khoản chi mã 21 có dấu âm. Đây là CFO trừ chi đầu tư giản lược, không đồng nhất với FCFF/FCFE đã điều chỉnh.'});
define('eps','Trên cổ phiếu','EPS cơ bản · CafeF','đồng/CP','Lấy EPS cơ bản mã 70 từ CafeF; không suy ra EPS quý từ EPS năm',c=>c.income('70'),{note:'EPS từ nguồn, không tự tính bằng vốn điều lệ. Không có giá lịch sử và số cổ phiếu đồng bộ nên chưa tính P/E, P/B.'});

function context(index,period,frequency){
 const inputs=[],warnings=[];
 function report(kind,p){const r=index.get(kind+'|'+p);if(!r||r.missing)throw Error(`Thiếu ${names[kind]} kỳ ${p}.`);return r;}
 function read(kind,code,p=period){
  const r=report(kind,p);if(r.source!=='CafeF')throw Error('Chỉ sử dụng nguồn CafeF trong giai đoạn này.');
  if(r.sector&&r.sector!=='enterprise')throw Error('Mẫu ngành tài chính chưa áp dụng công thức doanh nghiệp thông thường. Xem bảng chỉ số CafeF công bố.');
  const provisional=r.provisional&&['2026-Q1','2026-Q2'].includes(r.period);
  if(!r.mappingVerified&&!provisional&&(r.mappingBlocked||(r.issues||[]).some(x=>/mã và nhãn|mã 270|nhãn\/mã/i.test(x))))throw Error(`${names[kind]} ${p}: ${r.issues.join(' ')}`);
  for(const issue of r.issues||[]){const warning=`${names[kind]} ${p}: ${issue} Chỉ số vẫn tính trực tiếp từ số CafeF.`;if(!warnings.includes(warning))warnings.push(warning);}
  // Standard enterprise mappings must not be applied to bank/insurance templates.
  const marker=kind==='BSheet'?r.rows.find(x=>x.code==='270'):kind==='IncSta'?r.rows.find(x=>x.code==='10'):r.rows.find(x=>x.code==='20');
  const pattern=kind==='BSheet'?/tổng.*tài sản/i:kind==='IncSta'?/doanh thu thuần/i:/lưu chuyển tiền thuần.*kinh doanh/i;
  if(!pattern.test(marker?.label||''))throw Error(`Mẫu ${names[kind]} chưa hỗ trợ công thức doanh nghiệp thông thường.`);
  const row=r.rows.find(x=>x.code===code);if(row?.value==null)throw Error(`Thiếu ${row?.label||'mã '+code} (${names[kind]}, ${p}); không thay bằng 0.`);
  if(code==='70'&&kind==='IncSta'&&row.unit!=='VND/share')throw Error('Đơn vị EPS của nguồn chưa xác định.');
  if(code==='70'&&kind==='IncSta'&&r.adapter==='cafef-api-2026'&&row.sourceZero)throw Error('CafeF hiển thị dấu gạch cho EPS kỳ này.');
  if(!inputs.some(x=>x.kind===kind&&x.period===p&&x.code===code))inputs.push({kind,period:p,code,label:row.label,value:row.value,unit:row.unit,url:r.url,updated:r.updated,hash:r.hash,basis:r.basis});
  return q(row.value);
 }
 const c={inputs,warnings,balance:code=>read('BSheet',code),income:code=>{const r=report('IncSta',period);if(r.basis!==(frequency==='quarter'?'quarter':'annual'))throw Error('Chưa xác định được lợi nhuận/doanh thu riêng kỳ.');return read('IncSta',code);},
  average:code=>{let prev=previousPeriod(period);if(frequency==='quarter'&&period.endsWith('Q1')){const prior=index.get('BSheet|'+prev);if(!prior||prior.missing||prior.issues?.length)prev=String(+period.slice(0,4)-1);}const end=read('BSheet',code);const start=read('BSheet',code,prev);const a=report('BSheet',period),b=report('BSheet',prev);if(a.scope!==b.scope)throw Error('Phạm vi báo cáo đầu và cuối kỳ khác nhau.');return avg(start,end);},
  debt:()=>add(read('BSheet','320'),read('BSheet','338')),
  growth:(kind,code)=>{const p=previousYear(period),current=report(kind,period),old=report(kind,p);if(current.scope!==old.scope||current.basis!==old.basis)throw Error('Hai kỳ so sánh khác phạm vi hoặc cơ sở kỳ báo cáo.');return mul(sub(div(read(kind,code),read(kind,code,p)),q(1)),q(100));},
  cash:code=>{const current=report('CashFlow',period);if(frequency==='year'){if(current.basis!=='annual')throw Error('Dòng tiền không phải báo cáo cả năm.');return read('CashFlow',code);}if(current.basis==='quarter')return read('CashFlow',code);if(current.basis!=='ytd')throw Error('Chưa xác định được dòng tiền lũy kế.');const value=read('CashFlow',code);if(period.endsWith('Q1'))return value;const p=previousPeriod(period),prev=report('CashFlow',p);if(prev.basis!=='ytd'||current.scope!==prev.scope||current.source!==prev.source)throw Error('Hai kỳ dòng tiền không cùng phạm vi/nguồn/lũy kế; chưa lấy chênh lệch.');return sub(value,read('CashFlow',code,p));}
 };
 c.dso=()=>mul(div(c.average('131'),c.income('10')),q(daysInPeriod(period)));
 c.dio=()=>mul(div(c.average('140'),c.income('11')),q(daysInPeriod(period)));
 c.dpo=()=>mul(div(c.average('311'),c.income('11')),q(daysInPeriod(period)));
 return c;
}

export function calculateRatios(sourceReports,frequency){
 const index=new Map(sourceReports.map(r=>[r.kind+'|'+r.period,r]));
 const periods=[...new Set(sourceReports.filter(r=>frequency==='quarter'?r.period.includes('Q'):!r.period.includes('Q')).map(r=>r.period))].sort().reverse();
 return periods.map(period=>({period,kind:'Ratios',source:'Tính từ CafeF',issues:[],missing:false,rows:definitions.map(d=>{
  const c=context(index,period,frequency);let display=null,reason=null;try{const answer=d.calc(c);const scopes=new Set(c.inputs.map(x=>index.get(x.kind+'|'+x.period)?.scope));if(scopes.size>1)throw Error('Các báo cáo đầu vào khác phạm vi; không ghép số liệu.');display=decimal(answer,['tỷ đồng','đồng/CP'].includes(d.unit)?0:2);}catch(e){reason=e.message;}
  const {calc,...definition}=d;return {...definition,level:d.main?0:1,heading:false,value:display,display,reason,status:display===null?'unavailable':c.warnings.length?'calculated-warning':'calculated',warnings:c.warnings,checks:[],inputs:c.inputs,days:daysInPeriod(period),frequency};
 })}));
}
