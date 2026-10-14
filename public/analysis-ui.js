(()=>{
  const module=import(new URL('analysis-data.mjs',document.currentScript.src).href);
  const el=id=>document.getElementById(id);
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const count=n=>Number(n||0).toLocaleString('vi-VN');
  const date=s=>s?s.split('-').reverse().join('/'):'—';
  const stamp=s=>s?new Date(s).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa kiểm tra';
  let data=null,ready=false,loading=false,page=1,filtered=[],version='',sequence=0,filterAnalysis;
  const size=30;
  const filters=()=>({query:el('analysis-query').value,symbol:el('analysis-symbol').value,source:el('analysis-source').value,category:el('analysis-category').value,from:el('analysis-from').value,to:el('analysis-to').value,order:el('analysis-order').value});
  function options(id,values,label){const select=el(id),value=select.value;select.innerHTML=`<option value="">${label}</option>`+[...new Set(values)].sort((a,b)=>a.localeCompare(b,'vi')).map(v=>`<option value="${h(v)}">${h(v)}</option>`).join('');if(values.includes(value))select.value=value;}
  function render(){
    if(!data)return;
    el('analysis-total').textContent=count(data.items.length);
    el('analysis-publishers').textContent=count(new Set(data.items.map(r=>r.sourceCode)).size);
    const dates=data.items.map(r=>r.date).sort();
    el('analysis-range').textContent=dates.length?`${date(dates[0])} → ${date(dates.at(-1))}`:'Đang thu thập';
    el('analysis-checked').textContent=`Kiểm tra CafeF: ${stamp(data.checkedAt)} · giờ Việt Nam`;
    el('analysis-status').textContent=data.error?`Lần kiểm tra gần nhất chưa hoàn tất. Đang hiển thị danh mục đã lưu lúc ${stamp(data.checkedAt)}. ${data.error}`:data.complete?`Đã kiểm tra toàn bộ danh mục CafeF: ${count(data.totalAtSource)} báo cáo tại lần quét đầy đủ gần nhất.${data.retained?' Giữ thêm '+count(data.retained)+' báo cáo từ các lần trước.':''} Tự kiểm tra cùng lịch cập nhật của website.`:`Đang thu thập danh mục lịch sử; đã lưu ${count(data.items.length)} báo cáo. Chưa xác nhận đủ toàn bộ kho CafeF.`;
    const f=filters(),invalid=f.from&&f.to&&f.from>f.to;
    filtered=invalid?[]:filterAnalysis(data.items,f);
    const pages=Math.max(1,Math.ceil(filtered.length/size));page=Math.min(page,pages);
    el('analysis-results').innerHTML=filtered.slice((page-1)*size,page*size).map(r=>`<tr><td><time datetime="${r.date}">${date(r.date)}</time></td><td><a class="analysis-title" href="${h(r.url)}" target="_blank" rel="noopener">${h(r.title)}</a><div class="analysis-tags">${r.symbols.map(s=>`<button class="analysis-ticker" data-symbol="${h(s)}" aria-label="Lọc báo cáo ${h(s)}">${h(s)}</button>`).join('')}<span>${h(r.category)}</span>${r.archived?'<span>· Lưu từ lần trước</span>':''}</div></td><td><strong>${h(r.sourceCode)}</strong>${r.sourceName?`<small>${h(r.sourceName)}</small>`:''}</td><td><div class="analysis-links">${(r.documentUrl||r.pdfUrl)?`<a class="secondary" href="${h(r.documentUrl||r.pdfUrl)}" target="_blank" rel="noopener">${r.pdfUrl?'Đọc PDF':'Xem tài liệu'} ↗</a>`:'<span>Chưa có tệp gốc</span>'}<a href="${h(r.url)}" target="_blank" rel="noopener">Trang CafeF ↗</a></div></td></tr>`).join('')||`<tr><td colspan="4" class="empty">${invalid?'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.':data.items.length?'Không có báo cáo phù hợp. Hãy đổi hoặc xóa bộ lọc.':'Chưa có danh mục báo cáo được xuất bản.'}</td></tr>`;
    el('analysis-count').textContent=`${count(filtered.length)} / ${count(data.items.length)} báo cáo · Trang ${page}/${count(pages)}`;
    el('analysis-prev').disabled=page<=1;el('analysis-next').disabled=page>=pages;el('analysis-export').disabled=!filtered.length;
    el('analysis-results').querySelectorAll('[data-symbol]').forEach(b=>b.onclick=()=>{el('analysis-symbol').value=b.dataset.symbol;page=1;render();});
  }
  function init(){
    if(ready)return;ready=true;
    for(const id of ['analysis-query','analysis-symbol','analysis-source','analysis-category','analysis-from','analysis-to','analysis-order'])el(id).addEventListener(id==='analysis-query'||id==='analysis-symbol'?'input':'change',()=>{page=1;render();});
    el('analysis-clear').onclick=()=>{for(const id of ['analysis-query','analysis-symbol','analysis-source','analysis-category','analysis-from','analysis-to'])el(id).value='';page=1;render();};
    el('analysis-prev').onclick=()=>{page--;render();};el('analysis-next').onclick=()=>{page++;render();};
    el('analysis-refresh').onclick=()=>open(undefined,true).catch(e=>toast(e.message));
    el('analysis-export').onclick=()=>{
      const csv=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,'\t$&').replace(/"/g,'""')+'"';
      const rows=[['Ngày báo cáo (CafeF)','Tiêu đề','Mã CK','Đơn vị phân tích','Tên đơn vị','Loại báo cáo','Tài liệu gốc','Trang CafeF'],...filtered.map(r=>[r.date,r.title,r.symbols.join(', '),r.sourceCode,r.sourceName,r.category,r.documentUrl||r.pdfUrl,r.url])];
      const blob=new Blob(['\ufeff'+rows.map(row=>row.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='VietLedger_bao_cao_phan_tich.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
  }
  async function open(symbol,force=false){
    init();if(symbol!==undefined){for(const id of ['analysis-query','analysis-source','analysis-category','analysis-from','analysis-to'])el(id).value='';el('analysis-symbol').value=symbol;page=1;}
    if(data&&!force){render();return;}
    const seq=++sequence;loading=true;el('analysis-refresh').disabled=true;el('analysis-error').hidden=true;
    if(!data)el('analysis-results').innerHTML='<tr><td colspan="4" class="empty">Đang tải danh mục báo cáo phân tích…</td></tr>';
    try{
      ({filterAnalysis}=await module);
      if(force)await api('/api/status');
      const snapshot=await api('/api/analysis-reports');if(seq!==sequence)return;
      data=snapshot;options('analysis-source',data.items.map(r=>r.sourceCode),'Tất cả đơn vị');options('analysis-category',data.items.map(r=>r.category),'Tất cả loại báo cáo');render();
    }catch(error){el('analysis-error').hidden=false;el('analysis-error').textContent='Không tải được danh mục báo cáo. '+error.message;if(!data)el('analysis-results').innerHTML='<tr><td colspan="4" class="empty">Bấm “Tải lại danh mục” để thử lại.</td></tr>';throw error;
    }finally{if(seq===sequence){loading=false;el('analysis-refresh').disabled=false;}}
  }
  window.VietLedgerAnalysis={open,async refresh(next){if(!loading&&next!==version){version=next;await open(undefined,true);}}};
})();
