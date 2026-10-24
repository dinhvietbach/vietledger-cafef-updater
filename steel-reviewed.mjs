import {seriesDefinition,PRODUCT_BY_ID,cleanText,vnNumber} from './steel-data.mjs';
import {createHash} from 'node:crypto';

const EN_MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
export function vnsteelReportLinks(html,base='https://www.vnsteel.vn/tin-thi-truong-thep/'){
 const docs=new Map();
 for(const a of String(html).matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/gi)){
  const href=a[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1],title=cleanText(a[2]).trim();
  if(!href||!/(?:tháng\s*\d|\d+\s*tháng)/i.test(title)||!/VNSTEEL/i.test(title)||!/(?:tiêu thụ|kết quả sản xuất)/i.test(title))continue;
  try{const u=new URL(href,base);if(u.protocol==='https:'&&u.hostname==='www.vnsteel.vn'&&/^\/tin-thi-truong-thep\/[a-z0-9-]+-\d+\.html$/.test(u.pathname)&&!u.search&&!u.hash)docs.set(u.href,{url:u.href,title,source:'vnsteel'});}catch{}
 }
 return [...docs.values()].slice(0,6);
}
export function worldsteelLinks(html,base,checkedAt=new Date().toISOString()){
 return [...new Set([...html.matchAll(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)].flatMap(m=>{try{const u=new URL(m[1]||m[2]||m[3],base),p=u.pathname.match(/^\/media\/press-releases\/(20\d{2})\/([a-z]+)-(20\d{2})-crude-steel-production\/$/);if(u.protocol!=='https:'||u.hostname!=='worldsteel.org'||!p||p[1]!==p[3]||!EN_MONTHS.includes(p[2]))return[];const period=p[3]+'-'+String(EN_MONTHS.indexOf(p[2])+1).padStart(2,'0');return period>= '2015-01'&&period<checkedAt.slice(0,7)?[u.href]:[];}catch{return[];}}))].sort((a,b)=>{const period=u=>{const m=u.match(/\/([a-z]+)-(20\d{2})-crude/);return m[2]+'-'+String(EN_MONTHS.indexOf(m[1])+1).padStart(2,'0');};return period(b).localeCompare(period(a));});
}
export function parseWorldsteel(html,{url,checkedAt=new Date().toISOString()}={}){
 const h=String(html),u=new URL(url),m=u.pathname.match(/\/(20\d{2})\/([a-z]+)-(20\d{2})-crude-steel-production\/$/);
 if(u.protocol!=='https:'||u.hostname!=='worldsteel.org'||!m||m[1]!==m[3]||!EN_MONTHS.includes(m[2]))throw Error('URL công bố Worldsteel không hợp lệ');
 const period=m[3]+'-'+String(EN_MONTHS.indexOf(m[2])+1).padStart(2,'0');
 if(period<'2015-01'||period>=checkedAt.slice(0,7))throw Error('Kỳ Worldsteel chưa kết thúc');
 const title=cleanText(h.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'').toLowerCase();
 if(!title.includes(`${m[2]} ${m[3]} crude steel production`))throw Error('Tiêu đề Worldsteel không khớp kỳ');
 const tables=[...h.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(x=>x[0]);
 const table=tables.find(t=>/Viet\s*Nam/i.test(cleanText(t))&&/\(Mt\)/i.test(cleanText(t)));
 if(!table)throw Error('Chưa có dòng Việt Nam trong bảng Worldsteel; giữ dữ liệu trước');
 const row=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>cleanText(c[1]).trim())).find(r=>/^Viet\s*Nam(?:\s*\(e\))?$/i.test(r[0]||''));
 if(!row||row.length!==5||!/^\d+(?:\.\d+)?$/.test(row[1])||!/^\d+(?:\.\d+)?$/.test(row[3]))throw Error('Bảng Worldsteel đổi cấu trúc');
 const values=[Number(row[1])*1e6,Number(row[3])*1e6];if(values[0]<=0||values[0]>20e6||values[1]<values[0]||values[1]>240e6)throw Error('Số Worldsteel ngoài miền kiểm tra');
 const published=cleanText(h).match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\s+Brussels/i);
 const publishedAt=published?published[3]+'-'+String(EN_MONTHS.indexOf(published[2].toLowerCase())+1).padStart(2,'0')+'-'+published[1].padStart(2,'0'):null;
 if(!publishedAt||publishedAt>checkedAt.slice(0,10))throw Error('Ngày công bố Worldsteel chưa xác minh');
 return ['month','ytd'].map((frequency,i)=>{const s=seriesDefinition('crude_steel','production','reviewed-worldsteel');return {...s,id:s.id+'.'+frequency,frequency,entity:'industry',unit:'tấn',scope:'Thép thô Việt Nam theo Worldsteel; tách khỏi thép thành phẩm và phôi.',sourceLabel:'Worldsteel · công bố trực tiếp',method:'Đọc dòng Viet Nam trong bảng công bố tháng. Giữ độ làm tròn triệu tấn; lũy kế không thay thế số riêng tháng.',observations:[{period,value:values[i],url,source:'worldsteel',publishedAt,checkedAt,hash:createHash('sha256').update(h).digest('hex'),kind:'reported-table',approximate:true,qualifier:'≈',estimated:/\(e\)/i.test(row[0]),evidenceUrl:url,evidence:row.join(' | '),note:`Bảng ghi ${row[i===0?1:3]} triệu tấn, ${frequency==='month'?'riêng tháng':'lũy kế từ tháng 1'}. Giữ số làm tròn của nguồn; không suy số chính xác từ tỷ lệ tăng trưởng.`}]};});
}

export function reviewedSeries(review){
 return review.tables.flatMap(t=>{
  const d=review.docs[t.document];
  if(!d?.hash||(!Number.isInteger(t.page)&&!t.evidenceUrl)||t.values.length!==t.products.length)throw Error('Thiếu chứng cứ bảng đã rà soát');
  return t.values.map((value,i)=>{
   const product=t.products[i],basis=t.basis?'reviewed-'+t.basis:'reviewed-vsa',frequency=t.frequency||'month';
   const s=seriesDefinition(product,t.metric,basis);
   s.id+='.'+frequency+(t.entity?'.'+t.entity:'');s.frequency=frequency;s.unit=t.unit;s.scope=t.scope;s.entity=t.entity||'industry';s.sourceLabel={'vsa':'VSA · công bố trực tiếp','vnsteel':'VNSTEEL · bản tin thị trường','vcbs-vsa':'VCBS trích VSA','vietnambiz-vsa':'VietnamBiz trích VSA','fpts-wsa':'FPTS trích WSA','hpg-official':'Hòa Phát · công bố doanh nghiệp'}[d.source]||d.source;
   if(t.metric==='market_share')s.label=PRODUCT_BY_ID[product].name+' · Thị phần '+t.entity;
   if(t.metric==='capacity')s.label=PRODUCT_BY_ID[product].name+' · Công suất '+t.entity;
   if(d.source==='nkg-official')s.sourceLabel='Nam Kim · công bố doanh nghiệp';
   if(d.source==='worldsteel')s.sourceLabel='Worldsteel · công bố trực tiếp';
   if(d.source==='cafef-reported')s.sourceLabel='CafeF · dẫn VSA / thông tin Nam Kim';
   if(d.source==='psi-vsa')s.sourceLabel='PSI · tổng hợp FiinPro / VSA';
   if(t.metric==='sales_domestic')s.label=PRODUCT_BY_ID[product].name+' · Tiêu thụ nội địa';
   if(t.metric==='export_share')s.label=PRODUCT_BY_ID[product].name+' · Tỷ trọng xuất khẩu';
   s.method='Số công bố tại bảng/nhãn/đoạn đã đọc trực tiếp; giữ độ làm tròn của nguồn. Các báo cáo trích cùng nguồn gốc không phải đối soát độc lập.';
   s.observations=[{period:t.period,value,url:d.url+(Number.isInteger(t.page)?'#page='+t.page:''),source:d.source,sourceLabel:s.sourceLabel,scope:t.scope,publishedAt:d.publishedAt,checkedAt:d.reviewedAt,hash:d.hash,kind:t.kind||'reported-table',upstream:d.upstream,approximate:Boolean(t.approximate),qualifier:t.qualifier||'',evidenceUrl:t.evidenceUrl,raw:{document:t.document,page:t.page||null,row:i+1,reportedValue:value,sumDifference:t.sumDifference??null},evidence:t.evidence||`${t.page?'Trang '+t.page+'; ':''}${t.frequency==='ytd'?'lũy kế từ tháng 1 đến ':''}${t.period}; đơn vị ${t.unit}.`,note:(t.note||'')+(t.sumDifference?` Tổng nhóm chênh ${t.sumDifference} tấn với tổng nguồn; giữ nguyên số gốc.`:'')}];
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
