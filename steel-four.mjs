// Explicit, read-only workbook mappings. Cached values are evidence, never executable code.
import {PRODUCT_BY_ID,periodMonth} from './steel-data.mjs';
export const FOUR_CSV='https://vietledger.pages.dev/steel-four-workbooks.csv';
export const NKG_VDSC='https://cafefnew.mediacdn.vn/Images/Uploaded/DuLieuDownload/PhanTichBaoCao/NKG_20261005112631_24d205dba6a64da3bbb12e12.pdf';
export const NKG_2021='https://i.ex-cdn.com/imoney.vn/files/attach/2021/12/15/nkg_resultupdate_dec2021_vie-2209.pdf';
const cn=n=>{let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;};
const num=v=>typeof v==='number'&&Number.isFinite(v),mon=v=>typeof v==='string'&&/^20\d\d-\d\d-\d\dT/.test(v)?v.slice(0,7):null;
const qtr=v=>typeof v==='string'&&/^Q[1-4]\/20\d\d$/.test(v)?v.slice(3)+'-'+v.slice(0,2):null;
const metricNames={production:'Sản xuất',sales:'Tiêu thụ',sales_domestic:'Tiêu thụ nội địa',exports:'Xuất khẩu',vsa_exports:'Xuất khẩu',imports:'Nhập khẩu',price:'Giá tham khảo',import_value:'Kim ngạch nhập khẩu',asp_domestic:'Giá bán bình quân nội địa',asp_export:'Giá bán bình quân xuất khẩu',revenue_domestic:'Doanh thu nội địa',revenue_export:'Doanh thu xuất khẩu'};
export function importFourWorkbooks(books,{now=new Date().toISOString(),existing=[]}={}){
 const series=new Map(),findings=[],files=Object.entries(books).map(([key,b])=>({key,file:b.file,sha256:b.sha256,sheets:b.sheets.length,cells:b.sheets.reduce((n,s)=>n+Object.keys(s.cells).length,0),formulaErrors:b.sheets.reduce((n,s)=>n+Object.values(s.cells).filter(x=>x.error).length,0)}));
 const sheet=(key,name)=>books[key].sheets.find(s=>s.name===name),cell=(key,name,a)=>sheet(key,name)?.cells[a],val=(key,name,a)=>cell(key,name,a)?.value;
 const lastMonth=now.slice(0,7),stats={duplicates:0,matching:0,conflicts:0},comparisons=[];
 const issue=(file,sheet,cells,reason,url)=>findings.push({file:books[file].file,sheet,cells,reason,url});
 function add(key,sn,address,period,spec={},extra={}){
  const raw=cell(key,sn,address),value=extra.value??raw?.value;if(!num(value)||value<0||!period||period<'2015'||periodMonth(period)>lastMonth)return;
  if(spec.metric?.includes('price')&&value===0)return;
  const product=spec.product,metric=spec.metric,entity=spec.entity||'industry',frequency=spec.frequency||'month',segment=spec.segment||'total',region=spec.region||'Việt Nam',variant=spec.variant||'',id=['four',product,metric,entity,frequency,region,variant].join('.');
  if(!series.has(id))series.set(id,{id,product,metric,entity,frequency,segment,region,basis:'workbook',sourceLabel:'Excel đã rà soát · '+(key==='industry'?'Steel Industry':key==='nkg'?'NKG': 'HPG / DATA UPDATE'),unit:spec.unit||'tấn',label:[PRODUCT_BY_ID[product].name,metricNames[metric]||metric,entity==='industry'?region:entity,variant].filter(Boolean).join(' · '),scope:spec.scope||'Theo phạm vi ghi trong file; chưa xác minh độc lập với nguồn công bố đầu tiên.',method:spec.method||'Giữ giá trị đã lưu trong Excel; ô thiếu và lỗi công thức không thay bằng 0. Mở từng điểm để xem vị trí ô gốc.',observations:[]});
  const points=series.get(id).observations,prior=points.find(o=>o.period===period),ref={file:books[key].file,sheet:sn,cell:address,sha256:books[key].sha256};
  if(prior){if(prior.value===value){prior.raw.corroboratingFiles??=[];prior.raw.corroboratingFiles.push(ref);stats.duplicates++;return;}throw Error('Mâu thuẫn chưa ánh xạ: '+id+' '+period);}
  const point={period,value,source:'workbook-four',url:FOUR_CSV,checkedAt:now,kind:'reviewed-user-workbook',note:extra.note||'Số trong file người dùng; không coi việc nhiều file cùng chứa số này là xác minh độc lập.',raw:{...ref,originalValue:raw?.value,formula:raw?.formula},...extra};
  points.push(point);
  if(entity==='industry'&&frequency==='month'&&['production','sales','vsa_exports'].includes(metric)){
   const peers=existing.filter(s=>s.product===product&&s.metric===metric&&(s.entity||'industry')===entity&&(s.frequency||'month')===frequency&&['vsa','reviewed-vsa'].includes(s.basis)).flatMap(s=>s.observations.filter(o=>o.period===period&&!o.approximate).map(o=>({...o,sourceLabel:s.sourceLabel})));
   if(peers.length){const same=peers.some(o=>Math.abs(o.value-value)<0.01);stats[same?'matching':'conflicts']++;if(!same)comparisons.push({product,metric,period,file:value,other:peers[0].value,url:peers[0].url});point.alternatives=peers.map(o=>({value:o.value,url:o.url,source:o.source,sourceLabel:o.sourceLabel}));point.conflict=peers.some(o=>Math.abs(o.value-value)>=0.01);}
  }
 }
 // Monthly domestic source table: the raw export cells, not formula zero placeholders.
 const raw='Raw Data ',groups=[['all_steel','AF','AG','AI'],['construction','AO','AP','AQ'],['pipe','AU','AV','AW'],['coated','BA','BB','BC'],['flat_steel','BG','BH','BI'],['hrc','BM','BN','BO']];
 for(let r=3;r<=119;r++){const period=mon(val('industry',raw,'AD'+r));if(!period)continue;for(const [product,...cols]of groups)for(let i=0;i<cols.length;i++){const a=cols[i]+r,x=cell('industry',raw,a);if(!x||x.formula&&x.value===0)continue;
   // HRC exports have a long zero placeholder run before separately reported exports.
   if(product==='hrc'&&i===2&&x.value===0)continue;
   add('industry',raw,a,period,{product,metric:['production','sales','vsa_exports'][i],variant:'Bảng tháng ngành',scope:'Thống kê thép Việt Nam trong Raw Data; nguồn ghi FiinPro/VSA, chưa có bản công bố gốc theo từng ô.'},{...(period.endsWith('-01')||period.endsWith('-02')?{note:'Một số cặp tháng 1–2 trong file có cùng giá trị. Giữ ở nguồn Excel riêng, chưa xác nhận là quan sát độc lập từng tháng.'}: {})});
 }}
 // Regional prices: preserve each geographical quotation and currency.
 for(const [col,dateCol,product,region,unit]of [['D','B','hrc','Việt Nam','USD/tấn'],['E','B','hrc','Trung Quốc','USD/tấn'],['F','B','hrc','Bắc Âu','USD/tấn'],['G','B','hrc','Mỹ','USD/tấn'],['M','K','construction','Việt Nam','VND/kg'],['AA','Y','iron','Chưa ghi thị trường','USD/tấn'],['AB','Y','coke','Chưa ghi thị trường','USD/tấn'],['AC','Y','scrap','Chưa ghi thị trường','USD/tấn']])for(let r=4;r<=75;r++)add('industry','Giá thép & NVL',col+r,mon(val('industry','Giá thép & NVL',dateCol+r)),{product,metric:'price',region,unit,variant:product==='iron'?'Quặng 62% · Steel Industry':'Steel Industry',scope:val('industry','Giá thép & NVL',col+'3')+'; chưa có quy cách giao nhận, thuế hoặc phương pháp lấy giá. Không ghép với giá nhà máy/đại lý khác.'});
 issue('industry','Giá thép & NVL','N4:N75','Giá thép thanh Trung Quốc có biến động và quy cách chưa rõ; chưa nhập để tránh so sánh sai đơn vị hoặc sản phẩm.');
 // Customs partner flows: an origin/destination filter, never a company ticker.
 for(let r=3;r<=194;r++){const category=String(val('industry','XNK','X'+r)||''),period=mon(val('industry','XNK','A'+r));if(!period)continue;
  const product=category.includes('phế')?'scrap':category.includes('1000 USD')?'steel_articles':'customs_steel',metric=category.startsWith('XK')?'exports':category.includes('1000 USD')?'import_value':'imports';
  for(let c=2;c<=23;c++){const col=cn(c),partner=val('industry','XNK',col+'2');add('industry','XNK',col+r,period,{product,metric,region:(metric==='exports'?'Việt Nam → ':'Việt Nam ← ')+partner,unit:metric==='import_value'?'USD':'tấn',variant:category.includes('1000 USD')?'Sản phẩm từ sắt thép':'Hải quan theo đối tác',scope:category+'. File ghi TCHQ. Các quốc gia liệt kê không đủ để cộng thành tổng toàn quốc; sắt thép các loại không đồng nhất với thép thành phẩm VSA.'},metric==='import_value'?{value:num(val('industry','XNK',col+r))?val('industry','XNK',col+r)*1000:null,note:'Đơn vị trong file là nghìn USD; nhân 1.000 để hiển thị USD. Giá trị gốc giữ trong raw.originalValue.'}:{});}
 }
 issue('industry','XNK toàn ngành','J38:J39','Hai dòng cùng ghi 03/2024; công thức lùi tháng bị trùng. Không tự đổi một dòng thành tháng 4 và không nhập các tổng năm 2024 chỉ có 5 tháng.');
 issue('industry','China Market','F:H; DC','Tiêu thụ/xuất khẩu toàn Trung Quốc lặp dưới nhiều loại thép; tồn kho chưa đủ mô tả đơn vị. Chưa nhập như sản lượng từng sản phẩm.');
 // HPG monthly operating sales, clearly mapped source cells, no allocated billet run.
 for(let r=5;r<=69;r++)for(const [col,product,metric]of [['I','construction','sales'],['J','construction','exports'],['M','pipe','sales'],['N','pipe','exports'],['O','coated','sales'],['P','coated','exports'],['Q','hrc','sales'],['R','hrc','exports']])add('industry','SL HPG',col+r,mon(val('industry','SL HPG','A'+r)),{product,metric,entity:'HPG',variant:'Bảng tháng HPG'},{note:'Bảng SL HPG trong Steel Industry; chưa thay thế số công bố chính thức nếu có chênh lệch.'});
 // The two updated models share these historical tables exactly. Keep a single source series.
 for(const key of ['update4','hpgmodel']){
  for(let c=41;c<=44;c++){const col=cn(c),period=qtr(val(key,'Update KQKD',col+'76'));if(!period||period<'2025-Q4'||period>'2026-Q2')continue;
   for(const [row,product]of [[77,'construction'],[78,'hrc'],[79,'pipe'],[80,'coated'],[81,'billet']])add(key,'Update KQKD',col+row,period,{product,metric:'sales',entity:'HPG',frequency:'quarter',variant:'Vận hành HPG'});
   for(const [row,product]of [[71,'construction'],[72,'hrc'],[73,'pipe'],[74,'coated']])add(key,'Update KQKD',col+row,period,{product,metric:'production',entity:'HPG',frequency:'quarter',variant:'Vận hành HPG'});
   // Q4/2025 construction/HRC export values are extrapolated from rounded growth: not actuals.
   if(period>='2026-Q1')for(const [row,product]of [[83,'construction'],[84,'hrc']]){
    add(key,'Update KQKD',col+row,period,{product,metric:'sales_domestic',entity:'HPG',frequency:'quarter',variant:'Vận hành HPG'},{approximate:true,note:'Nội địa ghi làm tròn trong mô hình; không phải số chính xác đến tấn.'});
    add(key,'Update KQKD',col+(row+8),period,{product,metric:'exports',entity:'HPG',frequency:'quarter',variant:'Vận hành HPG'},{approximate:true,note:'Xuất khẩu = tổng trừ số nội địa làm tròn; chỉ là xấp xỉ theo mô hình.'});
   }
  }
 }
 for(let c=46;c<=51;c++)for(const [r,product]of [[77,'construction'],[78,'hrc'],[79,'pipe'],[80,'coated']]){const col=cn(c),x=cell('hpgmodel','Update KQKD',col+r),period=mon(val('hpgmodel','Update KQKD',col+'76'));if(x?.formula)continue;add('hpgmodel','Update KQKD',col+r,period,{product,metric:'sales',entity:'HPG',variant:'Vận hành HPG'});}
 // Monthly raw materials: only explicit historical rows, no blank-reference zeros,
 // and keep the documented change to HPG HRC pricing in a different series.
 for(const key of ['update4','hpgmodel']){const start=key==='update4'?4:5;for(let r=start;r<=130;r++){
  const period=mon(val(key,'giá NVL','B'+r));if(!period||period>=lastMonth)continue;
  for(const [col,product,region]of [['D','iron','Chưa ghi thị trường'],['E','coking_coal','Úc'],['F','scrap','Đông Á'],['G','hrc','Việt Nam'],['I','coke','Chưa ghi thị trường']]){
   const x=cell(key,'giá NVL',col+r);if(!num(x?.value)||x.value<=0)continue;
   if(col==='E'&&/^=I\d+$/.test(x.formula||''))continue;
   if(col==='G'&&period>='2025-08')continue;
   const id=['four',product,'price','industry','month',region,'Giá NVL'].join('.'),prior=series.get(id)?.observations.find(o=>o.period===period);
   if(prior&&prior.value!==x.value){comparisons.push({product,metric:'price',period,file:x.value,other:prior.value,reason:'Hai file giá NVL khác nhau; giữ bản DATA UPDATE, chưa thay thế bằng mô hình.'});continue;}
   add(key,'giá NVL',col+r,period,{product,metric:'price',region,unit:'USD/tấn',variant:'Giá NVL',scope:val(key,'giá NVL',col+(start-1))+'; chưa xác định chuẩn giá/bình quân hay ngày chốt. Không ghép với World Bank/SGX.'},{...(x.formula?{approximate:true,note:'Giá được tính bằng công thức trong mô hình, chưa đối soát nguồn công bố; không coi là báo giá trực tiếp.'}: {})});
  }
 }}
 for(let r=95;r<=115;r++){const year=r<107?2025:2026,month=r<107?r-94:r-106;add('hpgmodel','giá NVL','S'+r,`${year}-${String(month).padStart(2,'0')}`,{product:'hrc',metric:'price',entity:'HPG',unit:'USD/tấn',variant:'Giá HRC HPG theo file',scope:'Bảng riêng “giá HRC của HPG”; chưa xác minh thời điểm giao hàng/thuế. Không đồng nhất ASP thực hiện.'},{...(cell('hpgmodel','giá NVL','S'+r)?.formula?{approximate:true,note:'Giá suy từ mức tăng/giảm trong file; cần bản thông báo giá HPG để xác nhận.'}: {})});}
 issue('hpgmodel','giá NVL','E108:E112','Than mỡ luyện cốc đang tham chiếu sang cột than cốc I. Hai mặt hàng khác nhau; không dùng các ô này để nối chuỗi than mỡ Úc.');
 issue('hpgmodel','giá NVL','G108:G122','HRC đổi tham chiếu sang bảng giá HPG; tách thành chuỗi HPG riêng. Loại tháng đang diễn ra và giá 0 do tham chiếu ô trống.');
 issue('hpgmodel','Update KQKD','C74:AL74; AP91:AP92','Dòng sản xuất tôn mạ 2016–2024 trùng HSG; xuất khẩu quý IV/2025 suy từ tỷ lệ tăng/giảm làm tròn. Không nhập thành số thực hiện chính xác của HPG.');
 issue('update4','Data Tôn mạ M','CV:DL','Nhiều số sản xuất HSG lặp nguyên qua các tháng 2024–2025; các bảng chung giữa hai model và bản đã nhập không được nhân đôi hoặc coi là xác minh độc lập.');
 // NKG: VDSC explicitly covers coated products; older mixed-scope compilation stays separate.
 for(let r=5;r<=30;r++){
  const period=qtr(val('nkg','Du lieu theo quy','A'+r));if(r===12)continue;
  const reviewed=[26,29,30].includes(r),product=reviewed?'coated':'steel_unspecified',variant=reviewed?'Rồng Việt · tôn mạ':'Bảng tổng hợp · cần xác minh phạm vi',sourceUrl=val('nkg','Du lieu theo quy','P'+r);
  const note=[val('nkg','Du lieu theo quy','N'+r),val('nkg','Du lieu theo quy','O'+r),reviewed?'Đã đọc Bảng 1, trang 2–3 báo cáo Rồng Việt tháng 10/2026. Sản lượng chỉ là tôn mạ; xuất khẩu Q1/2026 đã đổi từ VSA sang hải quan.':'Phạm vi tổng hợp theo các báo cáo có thể gồm ống thép; không ghép với chuỗi tôn mạ thuần.'].filter(Boolean).join(' ');
  for(const [col,metric,unit]of [['B','sales_domestic','tấn'],['C','exports','tấn'],['D','sales','tấn'],['E','asp_domestic','VND/kg'],['F','asp_export','VND/kg'],['G','asp_domestic','USD/tấn'],['H','asp_export','USD/tấn'],['I','revenue_domestic','tỷ đồng'],['J','revenue_export','tỷ đồng']]){
   if(r===5&&['E','F'].includes(col))continue;
   const x=cell('nkg','Du lieu theo quy',col+r),isPrice=metric.startsWith('asp_');
   add('nkg','Du lieu theo quy',col+r,period,{product,metric,entity:'NKG',frequency:'quarter',unit,variant:variant+(unit==='USD/tấn'?' · USD':''),scope:reviewed?'Tôn mạ NKG; bảng Rồng Việt tổng hợp NKG/VSA/hải quan. ASP là ước tính của CTCK.':'NKG, tổng hợp nội địa và xuất khẩu theo Excel; các báo cáo khác phạm vi cần đối chiếu trước khi so sánh.'},{note,scopeUnverified:!reviewed,...(reviewed?{evidenceUrl:NKG_VDSC,evidence:'Bảng 1, trang 2–3; khớp ô trong workbook.',kind:'workbook-matched-original-report'}:sourceUrl?{evidenceUrl:sourceUrl}:{}),...(isPrice?{estimated:true}:{}),...(!reviewed&&([5,6,7,9,10,11,13,14,15,16,17,18,19,28].includes(r)||x?.formula)?{approximate:true}: {})});
  }
 }
 issue('nkg','Du lieu theo quy','B12:D12','Q4/2021 ghi 286.000 tấn nhưng nguồn VDSC tháng 12/2021 chỉ có thực tế đến tháng 10 và dự phóng Q4. Tạm loại toàn dòng; chưa có căn cứ xác nhận cả quý.',NKG_2021);
 issue('nkg','Du lieu theo quy','E5:F5','Ghi chú yêu cầu không tính ASP từ sản lượng làm tròn nhưng hai ô lại tính theo cách này. Tạm loại hai giá ASP quý I/2020.');
 issue('nkg','Du lieu theo quy','B26:F26; B29:F30','Đã đối soát PDF Rồng Việt: đây là tôn mạ, ASP là ước tính; Q1/2026 xuất khẩu theo hải quan. Giữ riêng với bảng lịch sử có cả ống thép.',NKG_VDSC);
 issue('nkg','Doi chieu theo nam','B10:D10','Dòng 2026 chỉ cộng Q1–Q2, không phải năm đầy đủ. Tổng 2024 lệch 10.000 tấn và 2025 lệch 847 tấn so với chuỗi BCTN đã đối soát; không ghi đè số BCTN.');
 issue('hpgmodel','REV / Assumptions / DCF','Các cột F và kịch bản','Dự phóng, kịch bản giá, định giá và BCTC trong mô hình không được nhập thành số ngành thực tế hoặc thay BCTC CafeF.');
 const result=[...series.values()].filter(s=>s.observations.length);for(const s of result)s.observations.sort((a,b)=>a.period.localeCompare(b.period));
 return {series:result,source:{name:'Bốn workbook thép · đã rà soát',file:'4 file Excel bổ sung ngày 21/10/2026',url:FOUR_CSV,importedAt:now,files,observations:result.reduce((n,s)=>n+s.observations.length,0),series:result.length,stats,comparisons,findings,mode:'Dữ liệu nhập từ bốn workbook; nguồn trực tuyến vẫn chạy theo lịch. Thay đổi trên file máy tính cần nhập lại.',note:'Giữ riêng phạm vi, giá ước tính và nguồn chưa được xác minh; không nội suy tháng thiếu.'}};
}
