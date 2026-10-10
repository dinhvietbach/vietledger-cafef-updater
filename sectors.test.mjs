import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {parseApi,moneyDisplay,shareDisplay} from './cafef-api.mjs';
import {insuranceCode,enrich} from './cafef-sectors.mjs';
import {excludedInstrument,catalogMarket} from './core.mjs';
const raw=name=>fs.readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url),'utf8');
test('Ngân hàng: giữ nguyên mã và số chi phí lãi, không ẩn như dòng tiêu đề của doanh nghiệp thường',()=>{
 const r=parseApi(raw('VCB-CashFlow'),{symbol:'VCB',kind:'CashFlow',frequency:'quarter',url:'fixture'}).reports[0];
 assert.equal(r.sector,'bank');const row=r.rows.find(x=>x.code==='HDKD_3');assert.equal(row.heading,false);assert.equal(row.value,'-27385968000000');assert.equal(moneyDisplay(row.value,'CashFlow'),'-27385.97');
 const inc=parseApi(raw('VCB-IncSta'),{symbol:'VCB',kind:'IncSta',frequency:'quarter',url:'fixture'}).reports[0];assert.equal(inc.rows.find(x=>x.code==='3').value,'19141761000000');assert.equal(inc.rows.find(x=>x.code==='3').level,0);
});
test('Chứng khoán: giá trị chi tiết thay các số 0 trong API theo đúng thứ tự CafeF dùng',()=>{
 const r=parseApi(raw('SSI-CashFlow'),{symbol:'SSI',kind:'CashFlow',frequency:'quarter',url:'fixture',supplement:{text:raw('SSI-extra'),type:'security',hash:'fixture',url:'extra'}}).reports[0];
 assert.equal(r.period,'2026-Q2');assert.equal(r.sector,'security');assert.equal(r.rows[0].value,'3122397955634');assert.equal(r.rows[1].value,'-1901335096420');assert.equal(r.rows[1].heading,false);assert.equal(r.rows[1].supplementIndex,1);
});
test('Bảo hiểm: dùng cờ LCTT và ánh xạ một mã duy nhất, không dùng giá trị khác khi số nguồn bằng 0',()=>{
 assert.equal(insuranceCode({hasLctt:false,data:[]},'1'),null);assert.equal(insuranceCode({hasLctt:false,data:[]},'2'),'1');assert.equal(insuranceCode({hasLctt:true,data:[]},'2'),'2');
 const r=parseApi(raw('BVH-IncSta'),{symbol:'BVH',kind:'IncSta',frequency:'quarter',url:'fixture',supplement:{text:raw('BVH-extra'),type:'insurance',hash:'fixture',url:'extra'}}).reports[0];assert.equal(r.rows.find(x=>x.code==='1').value,'11532492761110');assert.equal(r.rows.find(x=>x.code==='10').value,'0');assert.equal(r.rows.find(x=>x.code==='60').value,'1047362722195');
});
test('Trang chi tiết ngành rỗng không xóa các kỳ API CafeF vẫn hiển thị',()=>{const value={data:[{code:'HDKD',data:[{year:2022}]}]};assert.deepEqual(enrich(structuredClone(value),{Success:true,Data:[]},'security'),value);});
test('Số VND thập phân và ngưỡng hiển thị đúng như CafeF',()=>{assert.equal(moneyDisplay('9999999.125','BSheet'),'0.01');assert.equal(moneyDisplay('-10005000.25','CashFlow'),'-0.01');assert.equal(moneyDisplay('0.0','BSheet'),null);assert.equal(moneyDisplay('49999','IncSta'),null);assert.equal(moneyDisplay('49999','CashFlow'),'0.00');assert.equal(moneyDisplay('50000','BSheet'),'0.0001');assert.equal(shareDisplay('123.456789','70'),'123.4568');assert.equal(shareDisplay('123.456789','501'),'123.46');});
test('Danh mục chỉ loại công cụ không phải doanh nghiệp; không loại mã công ty dài',()=>{assert.equal(excludedInstrument('CMSN2101',"''"),true);assert.equal(excludedInstrument('FUEVFVND','Quỹ ETF VFMVN DIAMOND'),true);assert.equal(excludedInstrument('ANC11601','Trái Phiếu Công ty ABC'),true);assert.equal(excludedInstrument('EVERSTONE','Công ty Cổ phần Trang trí Đá Vĩnh Cửu'),false);assert.equal(excludedInstrument('HPG','Tập đoàn Hòa Phát'),false);});
test('Danh mục CafeF: HNX dùng cả đường dẫn hastc và hnx; loại OTC và chỉ số',()=>{assert.equal(catalogMarket('/du-lieu/hastc/adc.chn'),'HNX');assert.equal(catalogMarket('/du-lieu/hnx/shs.chn'),'HNX');assert.equal(catalogMarket('/du-lieu/hose/hpg.chn'),'HOSE');assert.equal(catalogMarket('/du-lieu/upcom/qns.chn'),'UPCOM');assert.equal(catalogMarket('/du-lieu/otc/abc.chn'),undefined);assert.equal(catalogMarket('/du-lieu/lich-su-giao-dich-symbol-hnx-index/trang.chn'),undefined);});
