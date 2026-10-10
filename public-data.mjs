// Pure data transformations shared by the server and the public static site.
import {calculateRatios} from './ratios.mjs';

export function publishedRatios(reports) {
  const units={'thousand-VND/share':'nghìn đồng/CP',times:'lần',percent:'%','source-unit':'Theo CafeF'};
  return reports.map(r=>({...r,rows:r.rows.map(x=>({...x,unit:units[x.unit]||x.unit,group:'CafeF công bố',main:true,formula:'Giá trị do CafeF công bố',note:'',warnings:[],inputs:[],reason:x.display===null?'CafeF hiển thị dấu gạch cho chỉ tiêu này.':null}))}));
}

export function companyResponse(company, endpoint, frequency='year', kind='IncSta') {
  if(endpoint==='/api/coverage')return company.coverage;
  if(!['year','quarter'].includes(frequency))throw Error('Kỳ báo cáo không hợp lệ.');
  if(endpoint==='/api/reports'){
    if(!['IncSta','BSheet','CashFlow'].includes(kind))throw Error('Loại báo cáo không hợp lệ.');
    return company.reports[kind][frequency];
  }
  if(endpoint==='/api/published-ratios')return frequency==='year'?publishedRatios(company.reports.CafeFRatios.year):[];
  if(endpoint==='/api/ratios')return calculateRatios(['BSheet','IncSta','CashFlow'].flatMap(k=>['year','quarter'].flatMap(f=>company.reports[k][f])),frequency);
  throw Error('Không có dữ liệu cho yêu cầu này.');
}
