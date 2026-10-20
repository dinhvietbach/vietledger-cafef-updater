import {seriesDefinition,PRODUCT_BY_ID,cleanText,vnNumber} from './steel-data.mjs';

export function reviewedSeries(review){
 return review.tables.flatMap(t=>{
  const d=review.docs[t.document];
  if(!d?.hash||(!Number.isInteger(t.page)&&!t.evidenceUrl)||t.values.length!==t.products.length)throw Error('Thiếu chứng cứ bảng đã rà soát');
  return t.values.map((value,i)=>{
   const product=t.products[i],basis=t.basis?'reviewed-'+t.basis:'reviewed-vsa',frequency=t.frequency||'month';
   const s=seriesDefinition(product,t.metric,basis);
   s.id+='.'+frequency+(t.entity?'.'+t.entity:'');s.frequency=frequency;s.unit=t.unit;s.scope=t.scope;s.entity=t.entity||'industry';s.sourceLabel={'vcbs-vsa':'VCBS trích VSA','vietnambiz-vsa':'VietnamBiz trích VSA','fpts-wsa':'FPTS trích WSA','hpg-official':'Hòa Phát · công bố doanh nghiệp'}[d.source]||d.source;
   if(t.metric==='market_share')s.label=PRODUCT_BY_ID[product].name+' · Thị phần '+t.entity;
   if(t.metric==='capacity')s.label=PRODUCT_BY_ID[product].name+' · Công suất '+t.entity;
   if(d.source==='nkg-official')s.sourceLabel='Nam Kim · công bố doanh nghiệp';
   s.method='Số công bố tại bảng/nhãn/đoạn đã đọc trực tiếp; giữ độ làm tròn của nguồn. Các báo cáo trích cùng nguồn gốc không phải đối soát độc lập.';
   s.observations=[{period:t.period,value,url:d.url+(Number.isInteger(t.page)?'#page='+t.page:''),source:d.source,publishedAt:d.publishedAt,checkedAt:d.reviewedAt,hash:d.hash,kind:t.kind||'reported-table',upstream:d.upstream,approximate:Boolean(t.approximate),qualifier:t.qualifier||'',evidenceUrl:t.evidenceUrl,raw:{document:t.document,page:t.page||null,row:i+1,reportedValue:value,sumDifference:t.sumDifference??null},evidence:t.evidence||`${t.page?'Trang '+t.page+'; ':''}${t.frequency==='ytd'?'lũy kế từ tháng 1 đến ':''}${t.period}; đơn vị ${t.unit}.`,note:(t.note||'')+(t.sumDifference?` Tổng nhóm chênh ${t.sumDifference} tấn với tổng nguồn; giữ nguyên số gốc.`:'')}];
   return s;
  });
 });
}
export function isVsaIndustryPost(p){
 return /thi-truong-thep|tinh-hinh.*thep|nganh-thep/.test(p.slug||'')&&!/toan-cau|the-gioi|trung-quoc/.test(p.slug||'');
}
export function parseVsaHistoricalTotals(post,checkedAt=new Date().toISOString()){
 const title=cleanText(post.title?.rendered||''),text=cleanText(post.content?.rendered||''),url=post.link?.replace(/^http:/,'https:');
 if(!isVsaIndustryPost(post)||!/^https:\/\/vsa\.com\.vn\//.test(url||''))return[];
 const match=title.match(/tháng\s+(\d{1,2})\/(20\d{2})/i)||title.match(/tháng\s+(\d{1,2})\s+và\s+\d+\s+tháng(?:\s+đầu)?\s+năm\s+(20\d{2})/i);
 if(!match||match[2]<'2015'||match[2]>'2023'||Number(match[1])>12)return[];
 const period=match[2]+'-'+match[1].padStart(2,'0');if(period>checkedAt.slice(0,7))return[];
 const block=text.split(/Tính chung|Tính lũy kế|Lũy kế|Cả năm|Tình hình[^\n]*\b\d+ tháng/i)[0];
 const patterns=[['production',/(?:Sản xuất thép các loại|Sản xuất các sản phẩm thép(?: của các doanh nghiệp thành viên VSA)?(?: trong tháng \d{1,2}\/20\d{2})?)\s+đạt\s+(hơn\s+)?(\d{1,3}(?:\.\d{3})+)\s+tấn/i],['sales',/(?:Bán hàng (?:sản phẩm )?thép (?:các loại|thành phẩm)(?: tháng \d{1,2}\/20\d{2})?)\s+đạt\s+(hơn\s+)?(\d{1,3}(?:\.\d{3})+)\s+tấn/i],['vsa_exports',/xuất khẩu (?:sản phẩm )?thép các loại\s+đạt\s+(hơn\s+)?(\d{1,3}(?:\.\d{3})+)\s+tấn/i]];
 return patterns.flatMap(([metric,re])=>{const m=block.match(re);if(!m||m[2].startsWith('0'))return[];const s=seriesDefinition('all_steel',metric,'vsa');return [{...s,observations:[{period,value:vnNumber(m[2]),url,source:'vsa',checkedAt,publishedAt:post.date,approximate:Boolean(m[1]),qualifier:m[1]?'>':'',kind:'reported-text',evidence:m[0],note:'Tổng thép thành phẩm của thành viên VSA, số tháng trong đoạn trước phần lũy kế. Không phân bổ tổng xuống từng sản phẩm.'}]}];});
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
