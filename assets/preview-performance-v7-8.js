'use strict';
(function(){
  const PV7=window.PV7=window.PV7||{};
  const assetBase=(()=>{try{return new URL('.',document.currentScript?.src||location.href).href}catch(_){return './'}})();

  /* Avoid a huge PostgREST .in(...) URL as history grows. */
  async function fetchObservationAnswers(reviewIds){
    const out=[];
    for(let i=0;i<reviewIds.length;i+=100){
      const rows=await must(
        db.from('review_answers')
          .select('id,review_id,checklist_item_id,mold_parameter_id,status,observation,observation_closed,solution,answered_at')
          .in('review_id',reviewIds.slice(i,i+100))
          .not('observation','is',null)
      );
      out.push(...(rows||[]));
    }
    return out;
  }

  const scalableLoadObservations=async function(){
    if(!isManager())return;
    try{
      const reviews=await must(
        db.from('review_sessions')
          .select('id,work_date,shift,machine_id,reviewed_by,started_at')
          .order('started_at',{ascending:false})
          .limit(2000)
      );
      const answers=await fetchObservationAnswers((reviews||[]).map(x=>x.id));
      const reviewMap=new Map((reviews||[]).map(r=>[r.id,r]));
      OBS=(answers||[])
        .filter(a=>String(a.observation||'').trim())
        .map(a=>({a,r:reviewMap.get(a.review_id)}));
      renderObservations();
    }catch(e){fail(e,'Fallas y soluciones')}
  };
  window.loadObservations=scalableLoadObservations;
  try{loadObservations=scalableLoadObservations}catch(_e){}

  /* QR generation is manager-only and infrequent: do not pay this cost at login. */
  let qrCodePromise=null;
  function loadQrCodeGenerator(){
    if(window.QRCode?.toCanvas)return Promise.resolve();
    if(qrCodePromise)return qrCodePromise;
    qrCodePromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=new URL('vendor/qrcode-1.5.1.min.js',assetBase).href;
      script.async=true;
      script.onload=()=>window.QRCode?.toCanvas?resolve():reject(new Error('No se pudo iniciar el generador QR.'));
      script.onerror=()=>reject(new Error('No se pudo cargar el generador QR.'));
      document.head.appendChild(script);
    });
    return qrCodePromise;
  }
  const originalRenderQrPage=renderQrPage;
  const lazyRenderQrPage=async function(){
    if(!isManager())return;
    try{
      setSync('Preparando QR…');
      await loadQrCodeGenerator();
      return await originalRenderQrPage();
    }catch(e){fail(e,'QR');setSync('Conectado')}
  };
  window.renderQrPage=lazyRenderQrPage;
  try{renderQrPage=lazyRenderQrPage}catch(_e){}

  PV7.architecture={...(PV7.architecture||{}),version:'7.8-lite',observationsChunked:true,qrGeneratorLazy:true};
})();
