(()=>{
  const libPromise=import(new URL('growth.mjs',document.currentScript.src).href);
  const el=id=>document.getElementById(id),h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=s=>s==null?'—':new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(Number(s));
  const date=s=>s&&Number.isFinite(Date.parse(s))?new Date(s).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa xác nhận';
  const link=(url,label)=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?`<a href="${h(u.href)}" target="_blank" rel="noopener noreferrer">${h(label)} ↗</a>`:'';}catch{return '';}};
  function sources(company,record={}){
    const files=record.attachments||[];
    return files.map((f,i)=>link(f.url,(f.title||`Tài liệu ${i+1}`)+' (PDF)')).join('')+(record.articleUrl?link(record.articleUrl,record.dateSource?'Hồ sơ công bố':'Trang công bố'):'')+(record.publishedAt?'<small>Công bố: '+date(record.publishedAt)+'</small>':'')+link(company.url,'Bảng số CafeF')+(!record.articleUrl?'<small>Chưa tìm được BCTC gốc đúng kỳ/phạm vi.</small>':'')+(record.explanationUrl?link(record.explanationUrl,'Giải trình của doanh nghiệp'):'')+(record.error?'<small>'+h(record.error)+'</small>':'');
  }
  let args=null,ready=false,ticket=0,page=1,rows=[];
  function clear(){ticket++;args=null;rows=[];if(el('growth-table'))el('growth-table').innerHTML='<tbody><tr><td class="empty">Đang tải bảng tăng trưởng…</td></tr></tbody>';if(el('growth-export'))el('growth-export').disabled=true;for(const id of ['growth-count','growth-caption','growth-summary'])if(el(id))el(id).textContent='Đang tải…';}
  async function render(next,reset=true){
    args=next;const id=++ticket,lib=await libPromise;if(id!==ticket)return;
    if(!ready){
      for(const name of ['growth-threshold','growth-recent','growth-research'])el(name).onchange=()=>{if(args)render(args);};
      el('growth-export').onclick=exportCSV;
      el('growth-prev').onclick=()=>{page--;render(args,false);};el('growth-next').onclick=()=>{page++;render(args,false);};
      el('growth-jump').onclick=()=>el('growth-panel').scrollIntoView({behavior:'smooth',block:'start'});ready=true;
    }
    if(reset)page=1;
    const {data,filtered,onDetail}=next,threshold=Number(el('growth-threshold').value),days=Number(el('growth-recent').value),mode=el('growth-research').value;
    const eligible=filtered.filter(c=>lib.qualifiesGrowth(c,threshold));
    rows=eligible.filter(c=>(!days||lib.recentPublication(data.research?.[c.symbol],days))&&(mode==='all'||(data.analysis?.[c.symbol]?.researchStatus==='verified'?'verified':'quantitative')===mode));
    const order=new Intl.Collator('vi');rows.sort((a,b)=>a.industryId===b.industryId?Number(b.metrics.profit.yoy.value)-Number(a.metrics.profit.yoy.value):a.industryId==null?1:b.industryId==null?-1:order.compare(a.industryName,b.industryName));
    const pages=Math.max(1,Math.ceil(rows.length/20));page=Math.min(page,pages);
    el('growth-caption').textContent=`Q${data.period.at(-1)}/${data.period.slice(0,4)} · Theo quý, ngành, sàn và tìm kiếm của bảng KQKD phía trên`;
    el('growth-count').textContent=`${rows.length} doanh nghiệp phù hợp · ${eligible.length} mã vượt ngưỡng trong bộ lọc KQKD · Trang ${page}/${pages}`;
    el('growth-summary').textContent=`${eligible.length} mã có doanh thu và LNST cùng tăng trên ${threshold}%. ${eligible.filter(c=>lib.recentPublication(data.research?.[c.symbol],30)).length} mã có ngày công bố được xác nhận trong 30 ngày qua.`;
    el('growth-jump').textContent=`↗ Cổ phiếu tăng trưởng đáng chú ý (${eligible.length})`;
    const percent=v=>v?.value==null?'—':`${Number(v.value)>0?'+':''}${num(v.value)}%`;
    const amount=m=>`<strong>${num(m.current.display)}</strong><span class="earn-up">${percent(m.yoy)} cùng kỳ</span><small>${h(m.label)}</small>`;
    let industry=null;
    el('growth-table').innerHTML='<thead><tr><th>Doanh nghiệp / ngành</th><th>Doanh thu quý · tỷ đồng</th><th>LNST quý · tỷ đồng</th><th>Lũy kế đến quý này</th><th>Vì sao tăng trưởng?</th><th>Điểm cần kiểm tra</th><th>Ngày công bố / kỳ thực tế</th><th>Nguồn báo cáo tài chính</th></tr></thead><tbody>'+rows.slice((page-1)*20,page*20).map(c=>{
      const r=data.research?.[c.symbol]||{},a=data.analysis?.[c.symbol]||{evidence:[],cautions:[]},name=c.industryName||'Chưa phân ngành';
      const group=industry!==name?`<tr class="earn-industry-group"><th colspan="8">${h(name)}</th></tr>`:'';industry=name;
      const status=a.researchStatus==='verified'?'Đã đọc nguồn doanh nghiệp':a.researchStatus==='stale'?'Cần rà soát lại giải trình':'Phân tích từ số liệu';
      return group+`<tr><td><button class="earn-company" data-symbol="${h(c.symbol)}">${h(c.symbol)} ↗</button><small>${h(c.name)}</small><small>${h(name)} · ${h(c.exchange)}</small></td><td>${amount(c.metrics.revenue)}</td><td>${amount(c.metrics.profit)}</td><td><span>DT: ${num(c.metrics.revenue.ytd.display)} tỷ</span><small>${percent(c.metrics.revenue.ytdGrowth)} cùng kỳ</small><span>LNST: ${num(c.metrics.profit.ytd.display)} tỷ</span><small>${percent(c.metrics.profit.ytdGrowth)} cùng kỳ</small></td><td class="growth-note"><b class="growth-status">${status}</b>${a.businessNote?'<p>'+h(a.businessNote)+'</p>':'<p class="muted">Chưa có kết luận nguyên nhân từ giải trình đã được xác nhận.</p>'}${(a.businessSources||[]).map(s=>link(s.url,s.title)).join('')}<details ${a.businessNote?'':'open'}><summary>Biến động tính từ CafeF</summary>${a.evidence.map(x=>'<p>'+h(x)+'</p>').join('')}</details></td><td class="growth-note">${a.cautions.map(x=>'<p>'+h(x)+'</p>').join('')||'<p>Cần đọc dòng tiền, thuyết minh và tính lặp lại của lợi nhuận.</p>'}</td><td class="growth-date"><b>${date(r.publishedAt)}</b>${r.publishedAt?`<small>${lib.recentPublication(r,30)?'Công bố trong 30 ngày':'Đã công bố hơn 30 ngày'}</small>`:'<small>Không dùng ngày thu thập thay ngày công bố.</small>'}${r.fiscalPeriod?'<span class="growth-fiscal">'+h(r.fiscalPeriod)+'</span>':'<small>Kỳ thực tế: cần đọc BCTC</small>'}</td><td class="earn-documents">${sources(c,r)}</td></tr>`;
    }).join('')+(rows.length?'':'<tr><td colspan="8" class="empty">Chưa có doanh nghiệp đáp ứng đồng thời các điều kiện. Có thể chọn quý trước hoặc bỏ bộ lọc ngày công bố.</td></tr>')+'</tbody>';
    el('growth-export').disabled=!rows.length;el('growth-prev').disabled=page===1;el('growth-next').disabled=page===pages;
    el('growth-table').querySelectorAll('[data-symbol]').forEach(b=>b.onclick=()=>onDetail(b.dataset.symbol));
  }
  function exportCSV(){
    const {data}=args;
    const table=[['Mã','Doanh nghiệp','Ngành','Kỳ CafeF','DT quý (tỷ)','DT YoY (%)','LNST quý (tỷ)','LNST YoY (%)','DT lũy kế (tỷ)','LNST lũy kế (tỷ)','Ngày công bố','Kỳ thực tế','Trạng thái nghiên cứu','Giải thích có nguồn','Biến động tính từ số liệu','Điểm cần kiểm tra','Nguồn BCTC','Nguồn giải thích'],...rows.map(c=>{const r=data.research?.[c.symbol]||{},a=data.analysis?.[c.symbol]||{};return [c.symbol,c.name,c.industryName||'Chưa phân ngành',data.period,c.metrics.revenue.current.display,c.metrics.revenue.yoy.value,c.metrics.profit.current.display,c.metrics.profit.yoy.value,c.metrics.revenue.ytd.display,c.metrics.profit.ytd.display,r.publishedAt||'Chưa xác nhận',r.fiscalPeriod||'Chưa xác nhận',a.researchStatus==='verified'?'Đã đọc nguồn doanh nghiệp':'Phân tích từ số liệu; cần đọc giải trình',a.businessNote,(a.evidence||[]).join(' | '),(a.cautions||[]).join(' | '),[...(r.attachments||[]).map(f=>f.url),r.articleUrl,c.url].filter(Boolean).join(' | '),(a.businessSources||[]).map(s=>s.url).join(' | ')];})];
    const safe=v=>'"'+String(v??'').replace(/^([=+@\t\r\n])/,' $1').replace(/"/g,'""')+'"';
    const url=URL.createObjectURL(new Blob(['\ufeff'+table.map(row=>row.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`Co_phieu_tang_truong_${data.period}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  window.VietLedgerGrowth={render,clear,sources};
})();
