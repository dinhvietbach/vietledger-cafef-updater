import test from 'node:test';
import assert from 'node:assert/strict';
import {chartRow,cashPoint,buildFinancialCharts} from './financial-charts.mjs';
const row=(code,label,value,extra={})=>({code,label,value,unit:'VND',heading:false,...extra});
const report=(kind,period,rows,extra={})=>({kind,period,rows,scope:'consolidated',sector:'enterprise',basis:kind==='BSheet'?'point-in-time':period.includes('Q')?(kind==='CashFlow'?'ytd':'quarter'):'annual',url:'https://cafef.vn/report',issues:[],...extra});
const cash=(period,value,extra={})=>report('CashFlow',period,[row('20','Lưu chuyển tiền thuần từ hoạt động kinh doanh',value)],extra);
const income=(period,revenue,profit='1000000000',extra={})=>report('IncSta',period,[row('10','3. Doanh thu thuần',revenue),row('60','18. Lợi nhuận sau thuế thu nhập doanh nghiệp',profit)],extra);
const bs=(period,assets,equity,extra={})=>report('BSheet',period,[row('270','Tổng cộng tài sản',assets),row('400','Vốn chủ sở hữu',equity),row('300','Nợ phải trả','2000000000')],extra);
const model=(all,opts={})=>buildFinancialCharts(all,{from:2016,to:2027,limit:0,...opts});
const point=(d,chart,key,p)=>d.charts.find(c=>c.id===chart).series.find(s=>s.key===key).points.find(x=>x.period===p);

test('valuation years stay independent of quarterly statements and convert per-share thousands exactly',()=>{
  const annual=p=>report('CafeFRatios',p,[row('PE','P/E','13.2',{unit:'times'}),row('PB','P/B','0',{unit:'times',sourceZero:true,display:null}),row('EPS','EPS','1.975',{unit:'thousand-VND/share'}),row('BV','BV','15.3',{unit:'thousand-VND/share'})]);
  const all={IncSta:[income('2026-Q1','123')],AnnualCafeFRatios:[annual('2023'),annual('2025')]};
  const d=model(all);assert.equal(d.charts.length,16);assert.deepEqual(d.charts.find(c=>c.id==='annual-pe').periods,['2023','2024','2025']);
  assert.equal(point(d,'annual-pe','PE','2025').value,'13.20');assert.equal(point(d,'annual-pe','PE','2024').value,null);
  assert.equal(point(d,'annual-per-share','EPS','2025').value,'1975.00');assert.equal(point(d,'annual-per-share','BV','2025').value,'15300.00');
  assert.equal(point(d,'annual-pe','PE','2026-Q1'),undefined);
  assert.equal(model(all,{from:2026}).charts.find(c=>c.id==='annual-pe').periods.length,0);
});
test('daily P/B is taken directly from published observations, never inferred from P/E or price',()=>{
  const snapshot={date:'2026-10-13',checkedAt:'2026-10-13T12:00:00Z',priceAt:'2026-10-12T08:00:00Z',values:{pe:'7.54',pb:'1.24'},url:'https://cafef.vn/source',basisNote:'EPS tới Quý II năm 2026'};
  const d=model({Valuations:[snapshot]});const chart=d.charts.find(c=>c.id==='market-valuation');assert.equal(d.periods.length,0);assert.deepEqual(chart.periods,['2026-10-13']);assert.equal(chart.frequency,'day');assert.equal(point(d,chart.id,'market_pb',snapshot.date).value,'1.24');assert.match(point(d,chart.id,'market_pe',snapshot.date).formula,/Quý II/);
  snapshot.values.pb=null;assert.equal(point(model({Valuations:[snapshot]}),chart.id,'market_pb',snapshot.date).value,null);
  assert.equal(model({Valuations:[snapshot]},{to:2025}).charts.find(c=>c.id===chart.id).periods.length,0);
});

test('cash flow uses exact cumulative differences, including negative quarter and year boundary',()=>{
  const rs=[cash('2025-Q4','10000000000'),cash('2026-Q1','6816755450021.10'),cash('2026-Q2','12070435627786.31'),cash('2026-Q3','10000000000000.01')];
  assert.equal(cashPoint(rs,'2026-Q1','cfo','quarter').raw,'6816755450021.10');
  const q2=cashPoint(rs,'2026-Q2','cfo','quarter');assert.equal(q2.raw,'5253680177765.21');assert.equal(q2.value,'5253.68');assert.equal(q2.sources.length,2);
  assert.equal(cashPoint(rs,'2026-Q3','cfo','quarter').raw,'-2070435627786.30');
  assert.equal(cashPoint([cash('2026','2200000000')],'2026','cfo','year').value,'2.20');
  assert.equal(cashPoint([cash('2026-Q2','2200000000',{basis:'quarter'})],'2026-Q2','cfo','quarter').value,'2.20');
});
test('cash flow refuses missing prior, incompatible scope, sector and basis; source dash stays missing',()=>{
  const q2=cash('2026-Q2','3000000000');
  for(const prior of [undefined,cash('2026-Q1','1000000000',{scope:'separate'}),cash('2026-Q1','1000000000',{sector:'bank'}),cash('2026-Q1','1000000000',{basis:'quarter'}),cash('2026-Q1','1000000000',{scope:'unknown'})])assert.equal(cashPoint([q2,...(prior?[prior]:[])],'2026-Q2','cfo','quarter').value,null);
  const r=cash('2026-Q1','0');r.rows[0].display=null;r.rows[0].sourceZero=true;assert.equal(cashPoint([r],r.period,'cfo','quarter').value,null);
  assert.equal(cashPoint([cash('2026','2',{basis:'ytd'})],'2026','cfo','year').value,null);
});
test('bank CFO spelling is accepted but pre-working-capital subtotal is excluded',()=>{
  const r=report('CashFlow','2026-Q1',[row('HDKD_10','Lưu chuyển tiền thuần từ hoạt động kinh doanh trước những thay đổi về tài sản và vốn lưu động','2000000000'),row('HDKD_27','I. Lưu chuyền tiền thuần từ hoạt động kinh doanh','4000000000')],{sector:'bank'});
  assert.equal(cashPoint([r],r.period,'cfo','quarter').value,'4.00');
  const insurance=report('CashFlow','2026-Q1',[row('37','Lưu chuyển tiền thuần từ hoạt động tài chính','5000000000'),row('40','Lưu chuyển tiền thuần trong kỳ','12000000000')]);assert.equal(cashPoint([insurance],insurance.period,'cff','quarter').value,'5.00');
});
test('root inventory and equity do not accidentally select component rows; unknown units are withheld',()=>{
  const r=bs('2026-Q1','20000000000','10000000000');r.rows.push(row('410','I. Vốn chủ sở hữu','9000000000'),row('140','IV. Hàng tồn kho','8000000000'),row('141','1. Hàng tồn kho','8500000000'));
  assert.equal(chartRow(r,'equity').code,'400');assert.equal(chartRow(r,'inventory').code,'140');
  r.rows.find(r=>r.code==='270').unit='VND/share';assert.equal(point(model({BSheet:[r]}),'assets','assets','2026-Q1').value,null);
});
test('year-on-year growth uses exact original values and rejects nonpositive or mismatched bases',()=>{
  const rs=[income('2025-Q1','0'),income('2026-Q1','1'),income('2025-Q2','2000000000.2'),income('2026-Q2','3000000000.3'),income('2025-Q3','-1'),income('2026-Q3','1'),income('2025-Q4','1',{},{scope:'separate'}),income('2026-Q4','2')];
  const d=model({IncSta:rs});assert.equal(point(d,'revenue','revenue_yoy','2026-Q1').value,null);assert.equal(point(d,'revenue','revenue_yoy','2026-Q2').value,'50.00');assert.equal(point(d,'revenue','revenue_yoy','2026-Q3').value,null);assert.equal(point(d,'revenue','revenue_yoy','2026-Q4').value,null);
  assert.equal(point(model({IncSta:[income('2025','200'),income('2026','300')]},{frequency:'year'}),'revenue','revenue_yoy','2026').value,'50.00');
});
test('continuous quarter axis retains gaps, filters periods and keeps fiscal quarters',()=>{
  const all={IncSta:[income('2026-Q1','1'),income('2026-Q3','3'),income('2026-Q4','4')]};const d=model(all);
  assert.deepEqual(d.periods,['2026-Q1','2026-Q2','2026-Q3','2026-Q4']);assert.equal(point(d,'revenue','revenue','2026-Q2').value,null);
  assert.deepEqual(model(all,{limit:2}).periods,['2026-Q3','2026-Q4']);assert.equal(model(all,{from:2027}).periods.length,0);assert.equal(model({}).periods.length,0);
});
test('ROE/ROA use same-scope average balance with annual opening fallback and no annualization',()=>{
  const all={IncSta:[income('2026-Q1','20000000000','3000000000')],BSheet:[bs('2026-Q1','30000000000','20000000000')],AnnualBSheet:[bs('2025','10000000000','10000000000')]};
  let d=model(all);assert.equal(point(d,'returns','roe','2026-Q1').value,'20.00');assert.equal(point(d,'returns','roa','2026-Q1').value,'15.00');assert.equal(point(d,'returns','roe','2026-Q1').sources.length,3);
  all.AnnualBSheet[0].scope='separate';d=model(all);assert.equal(point(d,'returns','roe','2026-Q1').value,null);
});
test('bank labels produce comparable returns and capital ratios without enterprise code assumptions',()=>{
  const bankBalance=(period,total,equity)=>report('BSheet',period,[row('300','TỔNG TÀI SẢN',total),row('400','TỔNG NỢ PHẢI TRẢ','8000000000'),row('500','VIII. VỐN CHỦ SỞ HỮU',equity),row('800','TỔNG NỢ PHẢI TRẢ VÀ VỐN CHỦ SỞ HỮU',total)],{sector:'bank'});
  const all={IncSta:[report('IncSta','2026-Q2',[row('3','I. Thu nhập lãi thuần','4000000000'),row('21','Lợi nhuận sau thuế','1000000000')],{sector:'bank'})],BSheet:[bankBalance('2026-Q1','10000000000','2000000000'),bankBalance('2026-Q2','12000000000','4000000000')]};
  const d=model(all);assert.equal(d.revenueLabel,'Thu nhập lãi thuần');assert.equal(point(d,'returns','roe','2026-Q2').value,'33.33');assert.equal(point(d,'leverage','liabilities_assets','2026-Q2').value,'66.67');assert.equal(point(d,'margins','gross_margin','2026-Q2').value,null);
});
test('source warning, report scope and supplement link remain traceable; blocked mapping yields gaps',()=>{
  const r=income('2026-Q1','1234500000.55','1',{issues:['Cần đối chiếu nguồn'],supplement:{url:'https://cafef.vn/detail'}});r.rows[0].fromSupplement=true;
  const x=point(model({IncSta:[r]}),'revenue','revenue',r.period);assert.equal(x.raw,'1234500000.55');assert.equal(x.value,'1.23');assert.equal(x.sources[0].url,'https://cafef.vn/detail');assert.equal(x.sources[0].scope,'consolidated');assert.deepEqual(x.warnings,['Cần đối chiếu nguồn']);
  r.mappingBlocked=true;assert.equal(point(model({IncSta:[r]}),'revenue','revenue',r.period).value,null);
});
test('EPS remains VND per share, does not synthesize source-zero figures, flags abnormal scale',()=>{
  const r=income('2026-Q1','1');r.rows.push(row('70','Lãi cơ bản trên cổ phiếu','1740',{unit:'VND/share'}));
  assert.equal(point(model({IncSta:[r]}),'eps','eps',r.period).value,'1740.00');r.rows.at(-1).value='1033000000';assert.match(point(model({IncSta:[r]}),'eps','eps',r.period).warnings[0],/đơn vị/);
  r.rows.at(-1).sourceZero=true;assert.equal(point(model({IncSta:[r]}),'eps','eps',r.period).value,null);
});
