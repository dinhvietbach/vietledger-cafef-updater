(()=>{
  const module=import(new URL('financial-charts.mjs',document.currentScript.src).href);
  const el=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format=v=>v==null?'—':new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(Number(v));
  const period=p=>!p?'—':p.includes('Q')?'Q'+p.at(-1)+'/'+p.slice(0,4):/^\d{4}-\d{2}-\d{2}$/.test(p)?p.split('-').reverse().join('/'):p;
  const colors=['#087f77','#d58b27','#557ad0','#b45c8b'];
  const cardPeriods=card=>card.periods||dataset.periods;
  const labelValue=(value,unit)=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:unit==='tỷ đồng'?0:2}).format(Number(value));
  let context=null,dataset=null,version=0,hidden=new Map(),identity='',ready=false;
  function clear(message='Đang tải dữ liệu biểu đồ…'){version++;context=null;dataset=null;el('financial-chart-grid').innerHTML='<p class="chart-empty">'+escape(message)+'</p>';el('financial-chart-caption').textContent=message;el('financial-chart-export').disabled=true;}
  const sourceLink=s=>{try{const u=new URL(s.url);return u.protocol==='https:'&&!u.username&&!u.password?`<a href="${escape(u.href)}" target="_blank" rel="noopener noreferrer">${escape(period(s.period)+' · '+s.label+' · '+(['CafeFRatios','MarketValuation'].includes(s.kind)?'CafeF công bố':({consolidated:'Hợp nhất',separate:'Riêng lẻ'}[s.scope]||'Chưa xác nhận phạm vi')))} ↗</a>`:'';}catch{return '';}};
  function pointDetails(card,p){
    el('chart-point-'+card.id).innerHTML='<b>'+escape(period(p))+'</b>'+card.series.map((s,i)=>{const x=s.points.find(x=>x.period===p);return `<div><span class="chart-dot" style="background:${colors[i%colors.length]}"></span><strong>${escape(s.label)}: ${format(x?.value)} ${escape(s.unit)}</strong>${x?.reason?'<small>'+escape(x.reason)+'</small>':''}${x?.formula?'<small>'+escape(x.formula)+'</small>':''}${(x?.warnings||[]).map(w=>'<small class="chart-warning">'+escape(w)+'</small>').join('')}${(x?.sources||[]).map(sourceLink).join('')}</div>`;}).join('');
  }
  function plot(card){
    const periods=cardPeriods(card),n=periods.length,showLabels=el('financial-chart-labels').checked,disabled=hidden.get(card.id)||new Set(),series=card.series.map((s,i)=>({...s,color:colors[i%colors.length]})).filter(s=>!disabled.has(s.key));
    const hasData=series.some(s=>s.points.some(x=>x.value!=null));
    if(!hasData)return '<div class="chart-empty">'+(series.length?'Chưa đủ dữ liệu cho biểu đồ này. Mở bảng số liệu để xem lý do.':'Chọn ít nhất một chỉ tiêu ở chú giải để xem biểu đồ.')+'</div>';
    const longest=Math.max(6,...series.flatMap(s=>s.points.filter(p=>p.value!=null).map(p=>labelValue(p.value,s.unit).length+(s.unit==='%'?1:0))));
    const W=showLabels?Math.max(n<=3?320:600,n*Math.max(76,longest*7+18)+122):600,H=320,L=66,R=56,T=40,B=52,pw=W-L-R,ph=H-T-B,step=pw/Math.max(1,n),x=i=>L+step*(i+.5),axes={};
    for(const axis of ['left','right']){
      const values=series.filter(s=>s.axis===axis).flatMap(s=>s.points.filter(p=>p.value!=null).map(p=>Number(p.value)));
      if(!values.length)continue;
      let min=Math.min(0,...values),max=Math.max(0,...values);if(min===max){min=0;max=1;}
      const pad=(max-min)*.12;axes[axis]={min:min<0?min-pad:0,max:max>0?max+pad:0};
    }
    const y=(v,axis)=>{const a=axes[axis];return T+(a.max-v)/(a.max-a.min)*ph;};
    const compact=v=>new Intl.NumberFormat('vi-VN',{notation:'compact',maximumFractionDigits:1}).format(v);
    let svg=`<svg viewBox="0 0 ${W} ${H}" style="min-width:${W}px" role="img" aria-label="${escape(card.title+' · '+context.symbol)}"><title>${escape(card.title+' · '+context.symbol)}</title>`;
    for(const [axis,a] of Object.entries(axes)){
      const unit=series.find(s=>s.axis===axis)?.unit;
      svg+=`<text x="${axis==='left'?L:W-R}" y="15" text-anchor="${axis==='left'?'start':'end'}" class="chart-axis-unit">${escape(unit)}</text>`;
      for(let i=0;i<=4;i++){const value=a.min+(a.max-a.min)*i/4,pos=y(value,axis);if(axis==='left')svg+=`<line x1="${L}" x2="${W-R}" y1="${pos}" y2="${pos}" class="chart-grid-line"/>`;svg+=`<text x="${axis==='left'?L-8:W-R+8}" y="${pos+4}" text-anchor="${axis==='left'?'end':'start'}" class="chart-axis">${escape(compact(value))}</text>`;}
      if(axis==='left'||!axes.left)svg+=`<line x1="${L}" x2="${W-R}" y1="${y(0,axis)}" y2="${y(0,axis)}" class="chart-zero"/>`;
    }
    const bars=series.filter(s=>s.type==='bar'),barWidth=Math.min(22,step*.7/Math.max(1,bars.length));
    for(const s of series){
      const axis=s.axis;if(!axes[axis])continue;
      if(s.type==='bar')for(let i=0;i<n;i++){const p=s.points[i];if(p.value==null)continue;const py=y(Number(p.value),axis),zero=y(0,axis),bx=x(i)+(bars.indexOf(s)-(bars.length-1)/2)*barWidth-barWidth/2;svg+=`<rect x="${bx}" y="${Math.min(py,zero)}" width="${barWidth*.88}" height="${Math.max(1,Math.abs(py-zero))}" rx="2" fill="${s.color}" opacity=".82"><title>${escape(period(p.period)+' · '+s.label+': '+format(p.value)+' '+s.unit)}</title></rect>`;}
      else {
        let segment=[];const paths=[];for(let i=0;i<n;i++){const p=s.points[i];if(p.value==null){if(segment.length)paths.push(segment);segment=[];}else segment.push([x(i),y(Number(p.value),axis)]);}if(segment.length)paths.push(segment);
        for(const path of paths)svg+=`<polyline points="${path.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>`;
        for(let i=0;i<n;i++){const p=s.points[i];if(p.value!=null)svg+=`<circle cx="${x(i)}" cy="${y(Number(p.value),axis)}" r="3.5" fill="${s.color}"><title>${escape(period(p.period)+' · '+s.label+': '+format(p.value)+' '+s.unit)}</title></circle>`;}
      }
    }
    // Each period has enough horizontal room for its longest label. Separate
    // close values vertically and connect displaced labels to their data point.
    if(showLabels)for(let i=0;i<n;i++){
      const labels=series.filter(s=>s.points[i]?.value!=null).map(s=>{
        const p=s.points[i],py=y(Number(p.value),s.axis),px=x(i)+(s.type==='bar'?(bars.indexOf(s)-(bars.length-1)/2)*barWidth:0);
        return {s,p,px,py,ly:py+(Number(p.value)<0?16:-10)};
      }).sort((a,b)=>a.ly-b.ly);
      let bottom=T-12;
      for(const l of labels){l.ly=Math.max(bottom+18,l.ly);bottom=l.ly;}
      const overflow=Math.max(0,(labels.at(-1)?.ly||0)-(H-B-3));
      for(const l of labels){l.ly-=overflow;if(Math.abs(l.ly-l.py)>18)svg+=`<line x1="${l.px}" y1="${l.py}" x2="${x(i)}" y2="${l.ly-4}" stroke="${l.s.color}" opacity=".5"/>`;svg+=`<text x="${x(i)}" y="${l.ly}" text-anchor="middle" class="chart-value-label" fill="${l.s.color}">${escape(labelValue(l.p.value,l.s.unit)+(l.s.unit==='%'?'%':''))}<title>${escape(l.s.label+': '+format(l.p.value)+' '+l.s.unit)}</title></text>`;}
    }
    const every=showLabels?1:Math.max(1,Math.ceil(n/6));
    for(let i=0;i<n;i++){
      const p=periods[i];if((i%every===0&&i<=n-1-every)||i===n-1)svg+=`<text x="${x(i)}" y="${H-26}" text-anchor="middle" class="chart-axis">${escape(period(p))}</text>`;
      const label=card.series.map(s=>s.label+': '+format(s.points[i].value)+' '+s.unit).join('; ');
      svg+=`<rect x="${L+i*step}" y="${T}" width="${step}" height="${ph}" fill="transparent" class="chart-hit" tabindex="0" role="button" data-chart="${card.id}" data-period="${p}" aria-label="${escape(period(p)+'; '+label)}"><title>${escape(period(p)+'\n'+label)}</title></rect>`;
    }
    return svg+'</svg>';
  }
  function draw(){
    if(!dataset)return;
    const group=el('financial-chart-group').value,cards=dataset.charts.filter(c=>group==='all'||c.group===group),n=dataset.periods.length;
    el('financial-chart-caption').textContent=`${context.symbol} · ${context.frequency==='quarter'?'Theo quý':'Theo năm'} · ${n}/${dataset.totalPeriods} kỳ trong khoảng năm đã chọn${n?' · '+period(dataset.periods[0])+' → '+period(dataset.periods.at(-1)):''}`;
    if(group==='Định giá')el('financial-chart-caption').textContent=`${context.symbol} · Định giá CafeF · Kỳ năm và ngày kiểm tra được ghi riêng trên từng biểu đồ`;
    el('financial-chart-export').disabled=!cards.some(c=>cardPeriods(c).length);
    if(!cards.some(c=>cardPeriods(c).length)){el('financial-chart-grid').innerHTML='<p class="chart-empty">Chưa có dữ liệu trong khoảng năm đã chọn. Chọn khoảng năm khác để xem biểu đồ.</p>';return;}
    el('financial-chart-grid').innerHTML=cards.map(card=>{
      const periods=cardPeriods(card),frequency=card.frequency||context.frequency,disabled=hidden.get(card.id)||new Set(),warningCount=card.series.reduce((n,s)=>n+s.points.filter(p=>p.value!=null&&p.warnings.length).length,0);
      return `<article class="financial-chart-card" aria-label="${escape(card.title)}"><div class="chart-card-heading"><div><span class="eyebrow">${escape(card.group)}</span><h3>${escape(card.title)}</h3></div><span class="chart-frequency">${frequency==='day'?'NGÀY KIỂM TRA':frequency==='year'?'NĂM':'QUÝ'}</span></div><div class="chart-legend">${card.series.map((s,i)=>`<button class="chart-legend-button" data-card="${card.id}" data-series="${s.key}" aria-pressed="${!disabled.has(s.key)}"><span class="chart-dot" style="background:${colors[i%colors.length]}"></span>${escape(s.label)}${s.axis==='right'?' · trục phải':''}</button>`).join('')}</div><div class="financial-plot" id="plot-${card.id}">${plot(card)}</div><p class="chart-note">${escape(card.note)}</p>${warningCount?'<p class="chart-warning">⚠ Có số liệu kèm cảnh báo nguồn; bấm kỳ để đọc chi tiết.</p>':''}<details class="chart-data"><summary>Bảng số liệu & nguồn</summary><div class="chart-period-control"><label>Đọc chi tiết kỳ <select data-detail-card="${card.id}" aria-label="Kỳ xem nguồn ${escape(card.title)}">${periods.map(p=>`<option ${p===periods.at(-1)?'selected':''} value="${p}">${period(p)}</option>`).join('')}</select></label></div><div class="chart-values"><table><caption class="sr-only">${escape(card.title)} · ${escape(context.symbol)}</caption><thead><tr><th>Kỳ</th>${card.series.map(s=>`<th>${escape(s.label)}<small>${escape(s.unit)}</small></th>`).join('')}</tr></thead><tbody>${periods.map((p,i)=>`<tr><td>${period(p)}</td>${card.series.map(s=>`<td title="${escape(s.points[i].reason||s.points[i].warnings.join(' '))}">${format(s.points[i].value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="chart-point-details" id="chart-point-${card.id}" aria-live="polite"></div></details></article>`;
    }).join('');
    for(const card of cards){pointDetails(card,cardPeriods(card).at(-1));const plot=el('plot-'+card.id);plot.scrollLeft=plot.scrollWidth-plot.clientWidth;}
    el('financial-chart-grid').querySelectorAll('[data-series]').forEach(b=>b.onclick=()=>{const set=hidden.get(b.dataset.card)||new Set();set.has(b.dataset.series)?set.delete(b.dataset.series):set.add(b.dataset.series);hidden.set(b.dataset.card,set);draw();});
    el('financial-chart-grid').querySelectorAll('[data-period]').forEach(b=>{const show=()=>{const card=cards.find(c=>c.id===b.dataset.chart),article=b.closest('article');article.querySelector('details').open=true;article.querySelector('select').value=b.dataset.period;pointDetails(card,b.dataset.period);};b.onclick=show;b.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();show();}};});
    el('financial-chart-grid').querySelectorAll('[data-detail-card]').forEach(s=>s.onchange=()=>pointDetails(cards.find(c=>c.id===s.dataset.detailCard),s.value));
  }
  async function render(next){
    context=next;const ticket=++version;
    if(identity!==next.symbol){hidden=new Map();identity=next.symbol;}
    try{const {buildFinancialCharts}=await module;if(ticket!==version)return;
      if(!ready){el('financial-chart-window').onchange=()=>context&&render(context);el('financial-chart-group').onchange=draw;el('financial-chart-labels').onchange=draw;el('financial-chart-export').onclick=exportCSV;ready=true;}
      dataset=buildFinancialCharts(next.allKinds,{frequency:next.frequency,from:next.from,to:next.to,limit:Number(el('financial-chart-window').value)});draw();
    }catch(error){if(ticket===version)clear('Không dựng được biểu đồ. Hãy tải lại trang.');}
  }
  function exportCSV(){
    if(!dataset||!context)return;
    const group=el('financial-chart-group').value,rows=[['Mã','Biểu đồ','Chỉ tiêu','Kỳ','Giá trị','Đơn vị','Ghi chú','Nguồn']];
    for(const card of dataset.charts.filter(c=>group==='all'||c.group===group))for(const s of card.series)for(const p of s.points)rows.push([context.symbol,card.title,s.label,p.period,p.value,s.unit,[p.reason,p.formula,...p.warnings].filter(Boolean).join(' | '),p.sources.map(s=>s.url).filter(Boolean).join(' | ')]);
    const safe=v=>{let s=String(v??'');if(/^[=+@\t\r\n-]/.test(s)&&!/^[-]?\d+(?:\.\d+)?$/.test(s))s=' '+s;return '"'+s.replace(/"/g,'""')+'"';};
    const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`${context.symbol}_Bieu_do_${context.frequency}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  window.VietLedgerCharts={render,clear};
})();
