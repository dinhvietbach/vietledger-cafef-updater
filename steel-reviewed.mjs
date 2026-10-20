import {seriesDefinition,PRODUCT_BY_ID,cleanText,vnNumber} from './steel-data.mjs';

export function reviewedSeries(review){
 return review.tables.flatMap(t=>{
  const d=review.docs[t.document];
  if(!d?.hash||!Number.isInteger(t.page)||t.values.length!==t.products.length)throw Error('Thiếu chứng cứ bảng đã rà soát');
  return t.values.map((value,i)=>{
   const product=t.products[i],basis=t.basis?'reviewed-'+t.basis:'reviewed-vsa',frequency=t.frequency||'month';
   const s=seriesDefinition(product,t.metric,basis);
   s.id+='.'+frequency+(t.entity?'.'+t.entity:'');s.frequency=frequency;s.unit=t.unit;s.scope=t.scope;s.entity=t.entity||'industry';s.sourceLabel={'vcbs-vsa':'VCBS trích VSA','vietnambiz-vsa':'VietnamBiz trích VSA','fpts-wsa':'FPTS trích WSA','hpg-official':'Hòa Phát · công bố doanh nghiệp'}[d.source]||d.source;
   if(t.metric==='market_share')s.label=PRODUCT_BY_ID[product].name+' · Thị phần '+t.entity;
   if(t.metric==='capacity')s.label=PRODUCT_BY_ID[product].name+' · Công suất '+t.entity;
   if(d.source==='nkg-official')s.sourceLabel='Nam Kim · công bố doanh nghiệp';
   s.method='Số công bố tại bảng/nhãn/đoạn đã đọc trực tiếp; giữ độ làm tròn của nguồn. Các báo cáo trích cùng nguồn gốc không phải đối soát độc lập.';
   s.observations=[{period:t.period,value,url:d.url+'#page='+t.page,source:d.source,publishedAt:d.publishedAt,checkedAt:d.reviewedAt,hash:d.hash,kind:t.kind||'reported-table',upstream:d.upstream,raw:{document:t.document,page:t.page,row:i+1,reportedValue:value,sumDifference:t.sumDifference??null},evidence:`Trang ${t.page}; ${t.frequency==='ytd'?'lũy kế từ tháng 1 đến ':''}${t.period}; đơn vị ${t.unit}.`,note:(t.note||'')+(t.sumDifference?` Tổng nhóm chênh ${t.sumDifference} tấn với tổng nguồn; giữ nguyên số gốc.`:'')}];
   return s;
  });
 });
}
export function isVsaIndustryPost(p){
 return /thi-truong-thep|tinh-hinh.*thep|nganh-thep/.test(p.slug||'')&&!/toan-cau|the-gioi|trung-quoc/.test(p.slug||'');
}
// A bounded paragraph parser supplements the older price parser. Reporting
// periods must be explicit; forecasts and rounded qualifiers are never hidden.
export function parseVsaExpanded(post,checkedAt=new Date().toISOString()){
 const title=cleanText(post.title?.rendered||''),text=cleanText(post.content?.rendered||'').replace(/(\d),\s+(?=\d)/g,'$1,'),url=post.link?.replace(/^http:/,'https:');
 if(!/^https:\/\/vsa\.com\.vn\//.test(url||'')||!isVsaIndustryPost(post))return[];
 const out=[],emit=(product,metric,period,frequency,m)=>{
  const s=seriesDefinition(product,metric,'vsa');s.frequency=frequency;if(frequency!=='month')s.id+='.'+frequency;
  s.observations=[{period,value:vnNumber(m[2])*(m[3]==='triệu'?1e6:m[3]?1e3:1),url,source:'vsa',checkedAt,publishedAt:post.date,evidence:m[0],kind:'reported-text',note:'Số công bố trong đoạn nguồn. '+(m[1]?'Nguồn dùng “'+m[1]+'”; đây là mức xấp xỉ/ngưỡng, không phải con số chính xác. ':'')+(m[3]?'Giữ mức làm tròn theo '+m[3]+' tấn.':''),approximate:Boolean(m[1]||m[3])}];out.push(s);
 };
 const patterns=[
  ['crude_steel','production',/S\s*ản xuất thép thô(?: của Việt Nam)?\s+đạt\s+(hơn|khoảng|gần)?\s*([\d.,]+)\s*(triệu|ngàn|nghìn)?\s*tấn/i],
  ['all_steel','production',/(?:Sản xuất|sản lượng) (?:sản phẩm )?thép thành phẩm(?: các loại)?\s+đạt\s+(hơn|khoảng|gần)?\s*([\d.,]+)\s*(triệu|ngàn|nghìn)?\s*tấn/i],
  ['all_steel','sales',/Bán hàng (?:thép thành phẩm(?: các loại)?|các sản phẩm thép)\s+đạt\s+(hơn|khoảng|gần)?\s*([\d.,]+)\s*(triệu|ngàn|nghìn)?\s*tấn/i]
 ];
 const ytd=title.match(/(\d{1,2}) tháng đầu năm (20\d{2})/i),monthly=title.match(/tháng (\d{1,2})\/(20\d{2})/i),annual=text.match(/Tính chung cả năm (20\d{2})\s*:/i);
 if(ytd){const block=text.split(/Riêng (?:trong )?tháng|Triển vọng|Dự báo/i)[0];for(const [p,m,re] of patterns){const found=block.match(re);if(found)emit(p,m,`${ytd[2]}-${ytd[1].padStart(2,'0')}`,'ytd',found);}}
 if(monthly){const block=text.split(/Tính chung|Tính lũy kế|Cả năm|Dự báo/i)[0];for(const [p,m,re] of patterns){const found=block.match(re);if(found)emit(p,m,`${monthly[2]}-${monthly[1].padStart(2,'0')}`,'month',found);}}
 if(annual){const block=text.slice(annual.index+annual[0].length).split(/Tháng \d+\/|Dự báo/i)[0];for(const [p,m,re] of patterns){const found=block.match(re);if(found)emit(p,m,annual[1],'year',found);}}
 for(const match of text.matchAll(/Riêng (?:trong )?tháng (\d{1,2})\/(20\d{2}),([^.\n]*(?:\.[^ \n][^.\n]*)*)/gi)){
  const block=text.slice(match.index,match.index+450).split(/Đáng chú ý|Trong \d+ tháng|Dự báo/i)[0],period=match[2]+'-'+match[1].padStart(2,'0');
  for(const [p,m,re] of patterns){const found=block.match(re);if(found)emit(p,m,period,'month',found);}
  const sales=block.match(/Bán hàng đạt\s+(hơn|khoảng|gần)?\s*([\d.,]+)\s*(triệu|ngàn|nghìn)?\s*tấn/i);if(sales)emit('all_steel','sales',period,'month',sales);
 }
 return out.filter(s=>s.observations[0].period>='2015'&&s.observations[0].period<=checkedAt.slice(0,7));
}
