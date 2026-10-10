// Mirrors the detail lookup and enrichment used by CafeF's FinancialAjax pages.
// Raw responses are archived separately; no missing financial value is invented.
export function sectorOf(value,kind){
 const rows=(kind==='IncSta'||kind==='CafeFRatios')?value.templace:(value.templace||[]).flatMap(s=>s.data||[]);
 const labels=rows.map(x=>x.name||'').join('\n');
 if(/NHNN|TCTD|Thu nhập lãi và các khoản|Cho vay khách hàng/i.test(labels))return 'bank';
 if(/FVTPL|AFS|chứng quyền|tài sản tài chính HTM/i.test(labels))return 'security';
 if(/tái bảo hiểm|phí bảo hiểm|HĐKD BH|HĐKDBH|dự phòng nghiệp vụ/i.test(labels))return 'insurance';
 return 'enterprise';
}
export function supplementUrl(symbol,type,frequency,page=1,size=50){return `https://cafef.vn/du-lieu/Ajax/PageNew/Get${type==='insurance'?'InsuranceKqkd':'SecurityLctt'}Detail.ashx?Symbol=${encodeURIComponent(symbol)}&pageIndex=${page}&pageSize=${size}&TypeTime=${frequency==='quarter'?'QUY':'NAM'}`;}
const oldInsurance={'1':null,'2':'1','3':'2','4':'9','5':'3','6':'4','7':'5','8':'15','9':'11','10':'10','11':'14','15':'15','16':'16','17':'17','18':'18','19':'20','20':'21','21':'19','22':'24','23':'9','24':'57','25':'24','26':'57','27':'24','28':'24','29':'22','30':'23','31':'26','32':'28','33':'40','40':'33','41':'42','42':'43','43.1':'51','43.2':'52','43':'53','44.1':'48','44.2':'49','44':'50','45':'63','46':'45','47':'46','48.1':'51','48.2':'52','48':'53','50':'54','51':'64','52':'65','53':'43','54':'50','57':'24','60':'60','61':'62','62':'61','70':'66'};
export function insuranceCode(period,code){
 const has=period.hasLctt??period.HasLctt??period.data.some(x=>String(x.code||x.MaSo||'')==='49');
 return has?code:Object.hasOwn(oldInsurance,code)?oldInsurance[code]:code;
}
function time(p){const t=String(p.time||p.Time||'').trim(),c=String(p.content||p.Content||'').trim();return (t&&c&&!t.includes(c)&&!/(\d{4})/.test(t)?t+'-'+c:t||c).toUpperCase();}
function samePeriod(a,b){return time(a)===time(b)||(Number(a.year)>0&&Number(a.quater||a.quarter)>0&&Number(a.year)===Number(b.Year||b.year)&&Number(a.quater||a.quarter)===Number(b.Quarter||b.quarter));}
export function enrich(value,extra,type){
 if(!extra||extra.Success!==true||!Array.isArray(extra.Data))throw Error('CafeF: phản hồi chi tiết ngành không hợp lệ');
 if(!extra.Data.length)return value;
 if(type==='insurance'){
  for(const p of value.data){const e=extra.Data.find(x=>samePeriod(p,x));if(!e?.Data?.length)continue;
   if(typeof e.HasLctt==='boolean')p.hasLctt=e.HasLctt;
   const seen=new Set(p.data.map(x=>String(x.code||x.MaSo||'')));
   for(const x of e.Data){const code=String(x.Code||x.code||'');if(code&&!seen.has(code)){p.data.push({code,value:x.Value??x.value,fromSupplement:true});seen.add(code);}}
  }
 }else{
  let offset=0;
  for(const section of value.templace){const displayOnly=(t,i)=>/^Trong đó có kỳ hạn/i.test(String(t.name||'').trim())||(i===0&&/^I+\./.test(String(t.name||'').trim()));
   const group=value.data.find(x=>x.code===section.code)||{code:section.code,data:[]};if(!value.data.includes(group))value.data.push(group);
   const original=group.data;
   group.data=extra.Data.map(p=>{let pointer=offset;const originalPeriod=original.find(x=>samePeriod(x,p));return {time:p.Time||p.time,content:p.Content||p.content||'',year:p.Year||p.year,quater:p.Quarter||p.quarter||0,type:originalPeriod?.type,data:section.data.map((t,i)=>{const index=displayOnly(t,i)?null:pointer++;const line=index===null?null:(p.Data||p.data||[])[index];return {code:t.code,value:line?.Value??line?.value??null,fromSupplement:true,supplementIndex:index};})};});
   offset+=section.data.filter((t,i)=>!displayOnly(t,i)).length;
  }
  value.count=Math.max(Number(value.count||0),extra.Data.length);
 }
 return value;
}
