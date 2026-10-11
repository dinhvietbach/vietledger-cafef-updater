import test from 'node:test';
import assert from 'node:assert/strict';
import {latestEarningsPeriod,earningsPeriods,compareIncome,growth,metricRow,incomeDetail} from './earnings.mjs';
const report=(period,value,extra={})=>({kind:'IncSta',period,basis:'quarter',sector:'enterprise',scope:'consolidated',rows:[{code:'10',label:'3. Doanh thu thuần',value,unit:'VND',level:0}],...extra});
const getter=r=>r.rows[0];
test('latest completed quarter uses Vietnam midnight and rolls over the year',()=>{
  assert.equal(latestEarningsPeriod('2026-09-30T16:59:59Z'),'2026-Q2');
  assert.equal(latestEarningsPeriod('2026-09-30T17:00:00Z'),'2026-Q3');
  assert.equal(latestEarningsPeriod('2027-01-01T00:00:00Z'),'2026-Q4');
  assert.deepEqual(earningsPeriods('2026-10-11',3),['2026-Q3','2026-Q2','2026-Q1']);
});
test('compares quarter, same quarter, previous quarter and complete YTD from unrounded decimals',()=>{
  const rs=[report('2026-Q1','1000000000.10'),report('2026-Q2','2000000000.20'),report('2026-Q3','3000000000.30'),report('2025-Q1','1000000000.10'),report('2025-Q2','1000000000.10'),report('2025-Q3','2000000000.20')];
  const c=compareIncome(rs,'2026-Q3',getter);
  assert.equal(c.yoy.value,'50.00');assert.equal(c.qoq.value,'50.00');assert.equal(c.ytdGrowth.value,'50.00');
  assert.equal(c.ytd.value,'6000000000.60');assert.equal(c.ytd.display,'6.00');
});
test('missing quarters are never substituted with zero or with a prior quarter',()=>{
  const c=compareIncome([report('2026-Q1','0'),report('2026-Q3','5')],'2026-Q3',getter);
  assert.equal(c.ytd.value,null);assert.match(c.ytd.reason,/2026-Q2/);
  assert.equal(c.previous.value,null);
  const pending=compareIncome([report('2026-Q2','5')],'2026-Q3',getter);
  assert.equal(pending.current.value,null);assert.equal(pending.ytd.value,null);
  assert.equal(compareIncome([report('2026-Q1','0')],'2026-Q1',getter).ytd.value,'0');
});
test('negative and zero bases use a clear explanation instead of misleading growth',()=>{
  assert.equal(growth('100','0').reason,'Nền bằng 0');
  assert.equal(growth('100','-50').reason,'Từ lỗ sang lãi');
  assert.equal(growth('-10','-50').reason,'Nền âm');
  assert.equal(growth('-10','50').value,'-120.00');
});
test('scope changes and cumulative-basis reports cannot create comparable totals',()=>{
  const rs=[report('2026-Q1','1',{scope:'separate'}),report('2026-Q2','2')];
  const c=compareIncome(rs,'2026-Q2',getter);assert.equal(c.ytd.value,null);assert.equal(c.qoq.value,null);assert.equal(c.previous.value,'1');
  assert.equal(compareIncome([report('2026-Q1','1',{basis:'ytd'})],'2026-Q1',getter).current.value,null);
});
test('Q1 previous quarter is prior Q4 while YTD contains only Q1; EPS is not summed',()=>{
  const c=compareIncome([report('2025-Q4','2'),report('2026-Q1','3')],'2026-Q1',getter);
  assert.equal(c.previous.value,'2');assert.equal(c.ytd.value,'3');
  const r=report('2026-Q1','3');r.rows[0].unit='VND/share';assert.equal(compareIncome([r],'2026-Q1',getter).ytd.value,null);
});
test('sector-specific income labels and total vs parent profit remain distinct',()=>{
  for(const [sector,label] of [['enterprise','3. Doanh thu thuần về bán hàng'],['bank','I. Thu nhập lãi thuần'],['security','Cộng doanh thu hoạt động'],['insurance','5. Doanh thu thuần từ HĐKD BH']]){
    const r={sector,rows:[{label,value:'1'}]};assert.equal(metricRow(r,'revenue').value,'1');
  }
  const r={rows:[{label:'18. Lợi nhuận sau thuế thu nhập doanh nghiệp',value:'10'},{label:'Lợi nhuận sau thuế của cổ đông Công ty mẹ',value:'9'}]};
  assert.equal(metricRow(r,'profit').value,'10');assert.equal(metricRow(r,'parent').value,'9');
});
test('detail does not silently match the same code when its meaning changed',()=>{
  const old=report('2025-Q3','5');old.rows[0].label='Thu nhập khác';
  const rows=incomeDetail([report('2026-Q3','8'),old],'2026-Q3');assert.equal(rows[0].yearAgo.value,null);
});
