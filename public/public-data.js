// Only included in the public build. Visitors receive data files, never admin APIs.
(()=>{
  const base=new URL('.',document.currentScript.src);
  const transform=import(new URL('public-data.mjs',base).href);
  let manifestPromise,version;
  const cache=new Map();
  async function manifest(refresh=false){
    if(refresh||!manifestPromise)manifestPromise=fetch(new URL('manifest.json',base),{cache:'no-store'}).then(async r=>{
      if(!r.ok)throw Error('Không đọc được bản dữ liệu công khai.');
      const m=await r.json();
      if(m.version!==version){cache.clear();version=m.version;}
      return m;
    }).catch(e=>{manifestPromise=null;throw e;});
    return manifestPromise;
  }
  async function chunk(asset){
    if(!cache.has(asset)){
      // Keep only a few company groups in memory on mobile devices.
      if(cache.size>=3)cache.delete(cache.keys().next().value);
      cache.set(asset,fetch(new URL(asset.replace(/^\//,''),base)).then(async r=>{
        if(!r.ok)throw Error('Bản dữ liệu đã thay đổi. Hãy tải lại trang.');
        if(typeof DecompressionStream==='undefined')throw Error('Vui lòng dùng phiên bản mới của Chrome, Edge, Safari hoặc Firefox.');
        const body=r.body.pipeThrough(new DecompressionStream('gzip'));
        return new Response(body).json();
      }).catch(e=>{cache.delete(asset);throw e;}));
    }
    return cache.get(asset);
  }
  window.VietLedgerData={interval:300000,async request(url,post=false){
    if(post)throw Error('Trang công khai chỉ dùng để tra cứu.');
    const u=new URL(url,location.origin);
    if(u.pathname==='/api/access')return {admin:false,protected:false,public:true};
    const m=await manifest(u.pathname==='/api/status');
    if(u.pathname==='/api/companies')return m.companies;
    if(u.pathname==='/api/status')return m.status;
    const symbol=(u.searchParams.get('symbol')||'HPG').toUpperCase();
    const c=m.companies.find(x=>x.symbol===symbol);
    if(!c)throw Error('Không tìm thấy doanh nghiệp.');
    const data=await chunk(c.asset);
    return (await transform).companyResponse(data[symbol],u.pathname,u.searchParams.get('frequency')||'year',u.searchParams.get('kind')||'IncSta');
  }};
})();
