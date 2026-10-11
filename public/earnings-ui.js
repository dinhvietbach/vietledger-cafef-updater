/* New-quarter earnings use the same preserved CafeF statements as the report view. */
(()=>{
  const module=import(new URL('earnings.mjs',document.currentScript.src).href);
  const el=id=>document.getElementById(id);
  const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=p=>`Q${p.at(-1)}/${p.slice(0,4)}`;
  const number=s=>s==null?'—':new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(Number(s));
  const scope=s=>s==='consolidated'?'Hợp nhất':s==='separate'?'Riêng lẻ':'Phạm vi chưa xác nhận';
  const sectors={enterprise:'Doanh nghiệp',bank:'Ngân hàng',security:'Chứng khoán',insurance:'Bảo hiểm'};
  let ready=false,data=null,seq=0,page=1,visible=[],version='',detailSeq=0,selectedSymbol=null;
  const size=50;
  const fields=['current','yearAgo','yoy','previous','qoq','ytd','priorYtd','ytdGrowth'];
  const growthKeys=['yoy','qoq','ytdGrowth'];
  function titles(p){
    const y=+p.slice(0,4),q=+p.at(-1),prev=q===1?`${y-1}-Q4`:`${y}-Q${q-1}`;
    return [label(p),`Cùng kỳ Q${q}/${y-1}`,'Tăng trưởng cùng kỳ',`Quý trước ${label(prev)}`,'Tăng trưởng quý trước',`Lũy kế ${q*3}T/${y}`,`Lũy kế ${q*3}T/${y-1}`,'Tăng trưởng lũy kế'];
  }
  function cell(v,key){
    if(!v||v.value==null){
      const short=v?.reason&&['Nền bằng 0','Nền âm','Từ lỗ sang lãi','Từ lỗ về hòa vốn'].includes(v.reason)?v.reason:'—';
      return `<td class="earn-missing" title="${h(v?.reason||'Chưa có dữ liệu')}">${short}</td>`;
    }
    const percent=growthKeys.includes(key),value=percent?v.value:v.display;
    return `<td class="${percent?(Number(value)>0?'earn-up':Number(value)<0?'earn-down':''):''} ${key==='current'||key==='ytd'?'earn-focus':''}" title="${h(percent?'(Kỳ này / kỳ so sánh − 1) × 100':v.value+' · số gốc')}">${percent&&Number(value)>0?'+':''}${number(value)}${percent?'%':''}</td>`;
  }
  const cells=m=>fields.map(k=>cell(m?.[k],k)).join('');
  function headers(first){return `<thead><tr><th scope="col">${first}</th>${titles(el('earn-period').value).map((x,i)=>`<th scope="col" class="${i===0||i===5?'earn-focus':''}">${h(x)}</th>`).join('')}</tr></thead>`;}
  function currentMetric(c){return c.metrics?.[el('earn-metric').value];}
  function render(){
    if(!data)return;
    const p=el('earn-period').value,q=+p.at(-1),year=p.slice(0,4);
    el('earn-title').textContent=`Cập nhật báo cáo KQKD quý ${q}`;
    el('earn-year').textContent=year;
    const available=data.companies.filter(c=>c.available).length;
    el('earn-available').textContent=number(available);
    el('earn-total').textContent=`/ ${number(companies.length)} doanh nghiệp trong danh mục`;
    el('earn-pending').textContent=number(companies.length-available);
    el('earn-period-caption').textContent=`Quý ${q}/${year} · theo nhãn kỳ CafeF`;
    const comparable=data.companies.filter(c=>c.available&&c.metrics?.profit.yoy.value!=null);
    el('earn-growing').textContent=number(comparable.filter(c=>Number(c.metrics.profit.yoy.value)>0).length);
    el('earn-growing-note').textContent=`/ ${number(comparable.length)} mã đủ số so sánh LNST cùng kỳ`;
    el('earn-pending-note').hidden=available>0;
    el('earn-pending-note').textContent=`Chưa có KQKD ${label(p)} trong bản dữ liệu này. Bảng sẽ nhận số mới sau mỗi lượt cập nhật CafeF. Anh có thể chọn quý trước để tra cứu.`;
    const query=el('earn-search').value.trim().toLocaleLowerCase('vi'),exchange=el('earn-exchange').value,state=el('earn-state').value;
    const index=new Map(data.companies.map(c=>[c.symbol,c]));
    visible=companies.map(c=>({...c,...index.get(c.symbol)})).filter(c=>(!query||(c.symbol+' '+c.name).toLocaleLowerCase('vi').includes(query))&&(exchange==='all'||exchange===c.exchange)&&(state==='all'||state==='available'&&c.available||state==='pending'&&!c.available));
    const sort=el('earn-sort').value;
    visible.sort((a,b)=>{
      if(sort==='symbol')return a.symbol.localeCompare(b.symbol);
      const av=currentMetric(a)?.[sort]?.[sort==='current'?'display':'value'],bv=currentMetric(b)?.[sort]?.[sort==='current'?'display':'value'];
      return av==null&&bv==null?a.symbol.localeCompare(b.symbol):av==null?1:bv==null?-1:Number(bv)-Number(av)||a.symbol.localeCompare(b.symbol);
    });
    const pages=Math.max(1,Math.ceil(visible.length/size));page=Math.min(page,pages);
    el('earn-table').innerHTML=headers('Doanh nghiệp / chỉ tiêu')+'<tbody>'+visible.slice((page-1)*size,page*size).map(c=>{
      const m=currentMetric(c);
      return `<tr><td><button class="earn-company" data-symbol="${h(c.symbol)}" ${!c.available?'disabled':''}>${h(c.symbol)} <span>↗</span></button><span class="tag">${h(c.exchange)}</span><small class="earn-company-name">${h(c.name)}</small><small>${c.available?h(scope(c.scope))+' · '+h(sectors[c.sector]||'Theo CafeF'):'Chưa có KQKD kỳ này'}${c.issues?.length?' · ⚠ Có cảnh báo nguồn':''}</small>${c.available?'<small class="earn-metric-label">'+h(m?.label)+'</small>':''}</td>${cells(m)}</tr>`;
    }).join('')+(visible.length?'':`<tr><td colspan="9" class="empty">Không có doanh nghiệp phù hợp với bộ lọc.</td></tr>`)+'</tbody>';
    el('earn-count').textContent=`${number(visible.length)} doanh nghiệp · Trang ${page}/${pages}`;
    el('earn-prev').disabled=page<=1;el('earn-next').disabled=page>=pages;
    el('earn-export').disabled=!visible.length;
    el('earn-table').querySelectorAll('.earn-company').forEach(b=>b.onclick=()=>showDetail(b.dataset.symbol));
  }
  async function loadSeason(){
    const ticket=++seq;detailSeq++;selectedSymbol=null;el('earn-detail').hidden=true;
    el('earn-error').hidden=true;el('earn-table').innerHTML='<tbody><tr><td class="empty">Đang đọc KQKD từ CafeF…</td></tr></tbody>';
    el('earn-export').disabled=true;
    const p=el('earn-period').value;el('earn-title').textContent=`Cập nhật báo cáo KQKD quý ${p.at(-1)}`;el('earn-year').textContent=p.slice(0,4);
    try{const result=await api('/api/earnings?period='+encodeURIComponent(p));if(ticket!==seq)return;data=result;page=1;render();}
    catch(e){if(ticket!==seq)return;data=null;el('earn-error').hidden=false;el('earn-error-text').textContent=e.message;el('earn-table').innerHTML='<tbody><tr><td class="empty">Chưa tải được bảng KQKD. Bấm “Thử lại”.</td></tr></tbody>';}
  }
  async function showDetail(symbol){
    const ticket=++detailSeq,p=el('earn-period').value;selectedSymbol=symbol;
    const panel=el('earn-detail');panel.hidden=false;
    el('earn-detail-title').textContent=`${symbol} · Chi tiết KQKD ${label(p)}`;
    el('earn-detail-table').innerHTML='<tbody><tr><td>Đang tải báo cáo chi tiết…</td></tr></tbody>';el('earn-detail-sources').innerHTML='';
    panel.scrollIntoView({behavior:'smooth',block:'start'});
    try{
      const [reports,lib]=await Promise.all([api(`/api/reports?symbol=${encodeURIComponent(symbol)}&kind=IncSta&frequency=quarter`),module]);
      if(ticket!==detailSeq)return;
      const rows=lib.incomeDetail(reports,p),report=reports.find(r=>r.period===p&&!r.missing);
      el('earn-detail-title').textContent=`${symbol} · ${companies.find(c=>c.symbol===symbol)?.name||''}`;
      el('earn-detail-subtitle').textContent=`KQKD ${label(p)} · ${scope(report?.scope)} · Tỷ đồng, riêng EPS: đồng/CP`;
      el('earn-detail-table').innerHTML=headers('Chỉ tiêu kết quả kinh doanh')+'<tbody>'+rows.map(row=>`<tr class="${row.level===0?'major':''}"><td>${h(row.label)}${row.unit==='VND/share'?'<small>Đồng/CP · không cộng EPS lũy kế</small>':''}</td>${cells(row)}</tr>`).join('')+'</tbody>';
      const y=+p.slice(0,4),q=+p.at(-1),wanted=new Set([q===1?`${y-1}-Q4`:`${y}-Q${q-1}`,...Array.from({length:q},(_,i)=>`${y}-Q${i+1}`),...Array.from({length:q},(_,i)=>`${y-1}-Q${i+1}`)]);
      el('earn-detail-sources').innerHTML='<h3>Nguồn số liệu dùng để so sánh</h3>'+reports.filter(r=>wanted.has(r.period)&&!r.missing).map(r=>`<div class="earn-source"><a href="${h(r.url)}" target="_blank" rel="noopener">CafeF ${label(r.period)} ↗</a><span>${h(scope(r.scope))} · Thu thập ${h(new Date(r.updated).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}))}</span>${r.issues?.length?'<p>⚠ '+r.issues.map(h).join(' ')+'</p>':''}</div>`).join('');
    }catch(e){if(ticket===detailSeq)el('earn-detail-table').innerHTML=`<tbody><tr><td>${h(e.message)}</td></tr></tbody>`;}
  }
  function exportCSV(){
    const metric=el('earn-metric').selectedOptions[0].textContent;
    const rows=[['Mã CK','Doanh nghiệp','Sàn','Trạng thái','Phạm vi','Chỉ tiêu','Đơn vị',...titles(el('earn-period').value)],...visible.map(c=>{const m=currentMetric(c);return [c.symbol,c.name,c.exchange,c.available?'Đã có tại CafeF':'Chưa có',scope(c.scope),m?.label||metric,'Tỷ đồng / %',...fields.map(k=>m?.[k]?.value==null?m?.[k]?.reason||'Chưa có dữ liệu':growthKeys.includes(k)?m[k].value+'%':m[k].display)];}),[],['Nguồn','CafeF'],['Lũy kế','Tổng số riêng quý Q1 đến quý được chọn. Không thay số thiếu bằng 0.'],['Nhãn kỳ','Theo CafeF; niên độ tài chính doanh nghiệp có thể khác năm dương lịch.']];
    const safe=s=>'"'+String(s??'').replace(/^([=+@\t\r\n])/,' $1').replace(/"/g,'""')+'"';
    const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download=`KQKD_${el('earn-period').value}_${el('earn-metric').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function open(){
    if(!ready){
      const lib=await module;
      el('earn-period').innerHTML=lib.earningsPeriods().map(p=>`<option value="${p}">${label(p)}</option>`).join('');
      el('earn-metric').innerHTML=lib.EARNINGS_METRICS.map(m=>`<option value="${m.key}" ${m.key==='profit'?'selected':''}>${h(m.label)}</option>`).join('');
      el('earn-exchange').innerHTML='<option value="all">Tất cả sàn</option>'+[...new Set(companies.map(c=>c.exchange))].sort().map(s=>`<option>${h(s)}</option>`).join('');
      el('earn-period').onchange=loadSeason;
      for(const id of ['earn-search','earn-exchange','earn-state','earn-sort','earn-metric'])el(id).addEventListener(id==='earn-search'?'input':'change',()=>{page=1;render();});
      el('earn-prev').onclick=()=>{page--;render();};el('earn-next').onclick=()=>{page++;render();};
      el('earn-retry').onclick=loadSeason;el('earn-export').onclick=exportCSV;
      el('earn-detail-close').onclick=()=>{detailSeq++;selectedSymbol=null;el('earn-detail').hidden=true;};
      el('earn-open-report').onclick=()=>{if(!selectedSymbol)return;document.querySelector('.nav[data-view="reports"]').click();frequency='quarter';el('frequency').value='quarter';kind='IncSta';document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.kind==='IncSta'));choose(selectedSymbol);};
      ready=true;
    }
    if(!data){version=status.lastFinished;await loadSeason();}
  }
  window.VietLedgerEarnings={open,async refresh(nextVersion){
    if(!ready)return;
    const lib=await module,periods=lib.earningsPeriods(),oldLatest=el('earn-period').options[0]?.value;
    if(oldLatest!==periods[0]){const selected=el('earn-period').value;el('earn-period').innerHTML=periods.map(p=>`<option value="${p}">${label(p)}</option>`).join('');if(selected!==oldLatest&&periods.includes(selected))el('earn-period').value=selected;version='';}
    if(version!==nextVersion){version=nextVersion;await loadSeason();}
  }};
})();
