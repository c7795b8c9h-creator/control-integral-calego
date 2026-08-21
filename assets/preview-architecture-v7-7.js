'use strict';
(function(){
  const PV7=window.PV7=window.PV7||{};
  const currentAssetBase=(()=>{try{return new URL('.',document.currentScript?.src||location.href).href}catch(_){return './'}})();
  const selectedShift=()=>$('dashboardShiftFilter')?.value||'all';
  const shiftMatches=(r,s)=>s==='all'||Number(r?.shift)===Number(s);
  const dateMinus=(dateStr,days)=>{const d=new Date(dateStr+'T12:00:00-05:00');d.setDate(d.getDate()-days);return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};

  /* One dashboard fetch path: 7-day reviews once + answers once + today's random assignments. */
  async function fetchAnswers(ids){
    if(!ids.length)return[];
    const out=[];
    for(let i=0;i<ids.length;i+=120){
      const rows=await must(db.from('review_answers')
        .select('id,review_id,checklist_item_id,mold_parameter_id,status,actual_value,observation,observation_closed,solution,answered_at')
        .in('review_id',ids.slice(i,i+120)));
      out.push(...(rows||[]));
    }
    return out;
  }
  const optimizedLoadDashboard=async function(){
    if(!isManager())return;
    try{
      setSync('Actualizando dashboard…');
      const date=$('workDate').value||today(),from=dateMinus(date,6);
      const [historyReviews,random]=await Promise.all([
        must(db.from('review_sessions')
          .select('id,kind,work_date,shift,machine_id,module_id,mold_id,reviewed_by,status,started_at,closed_at,duration_seconds,qr_validated_at')
          .gte('work_date',from).lte('work_date',date).order('started_at')),
        must(db.from('random_photo_assignments')
          .select('id,work_date,shift,machine_id,responsible_id,checklist_item_id,mold_parameter_id,fulfilled')
          .eq('work_date',date))
      ]);
      const historyAnswers=await fetchAnswers((historyReviews||[]).map(r=>r.id));
      const todayReviews=(historyReviews||[]).filter(r=>r.work_date===date),todayIds=new Set(todayReviews.map(r=>r.id));
      const todayAnswers=historyAnswers.filter(a=>todayIds.has(a.review_id));
      S.dashboard={reviews:todayReviews,answers:todayAnswers,random:random||[],historyReviews:historyReviews||[],historyAnswers,from};
      renderDashboard();await renderEvidenceDashboard();setSync('Conectado');
    }catch(e){fail(e,'Dashboard');setSync('Error de sincronización')}
  };
  window.loadDashboard=optimizedLoadDashboard;
  try{loadDashboard=optimizedLoadDashboard}catch(_e){}

  /* Strict evidence query: only fetch what can be displayed. */
  function scopeLabels(){
    const aid=$('dashboardArea')?.value||'all',rid=$('dashboardResponsible')?.value||'all',s=selectedShift();
    return{
      area:aid==='all'?'Todas las áreas':(byId(S.areas,aid)?.name||'Área'),
      responsible:rid==='all'?'Todos los responsables':(byId(S.profiles,rid)?.full_name||'Responsable'),
      shift:s==='all'?'Todos los turnos':`Turno ${s}`
    };
  }
  const optimizedEvidence=async function(){
    const el=$('evidenceDashboard');if(!el||!isManager()||!S.dashboard)return;
    const labels=scopeLabels(),scope=PV7.strictDashboardScope?PV7.strictDashboardScope():PV7.dashboardScope();
    const ids=(scope.reviews||[]).map(r=>r.id),h=el.closest('.card')?.querySelector('h3');
    if(h)h.textContent=`Evidencias · ${labels.area} · ${labels.shift}`;
    if(!ids.length){S.dashboardPhotos=[];S.evidenceUrls={};el.innerHTML=`<div class="notice">No hay evidencias para ${esc(labels.area)} · ${esc(labels.responsible)} · ${esc(labels.shift)}.</div>`;return}
    el.innerHTML='<div class="notice">Actualizando evidencias…</div>';
    try{
      const rows=await must(db.from('photo_evidence').select('id,review_id,answer_id,required_reason,taken_at').in('review_id',ids).order('taken_at',{ascending:false}).limit(18));
      S.dashboardPhotos=rows||[];
      if(!rows?.length){S.evidenceUrls={};el.innerHTML=`<div class="notice">No hay fotografías registradas para ${esc(labels.area)}.</div>`;return}
      const {data,error}=await db.functions.invoke('evidence',{body:{action:'signed_urls',evidence_ids:rows.map(x=>x.id)}});
      if(error)throw error;if(data?.error)throw new Error(data.error);
      S.evidenceUrls=data?.urls||{};
      const reviews=new Map((scope.reviews||[]).map(r=>[r.id,r])),answers=new Map((scope.answers||[]).map(a=>[a.id,a]));
      el.innerHTML='<div class="evidence-gallery">'+rows.map(p=>{
        const r=reviews.get(p.review_id),m=byId(S.machines,r?.machine_id),area=machineArea(r?.machine_id),a=p.answer_id?answers.get(p.answer_id):null;
        const point=a?answerPointName(a):'Foto general',url=S.evidenceUrls[p.id]||'',reason=p.required_reason==='random'?'Aleatoria':p.required_reason==='fixed'?'Obligatoria':p.required_reason==='machine'?'General':'Opcional';
        return `<a class="evidence-card" ${url?`href="${esc(url)}" target="_blank" rel="noopener"`:''}><div class="evidence-thumb">${url?`<img loading="lazy" decoding="async" src="${esc(url)}" alt="Evidencia ${esc(m?.name||'')}">`:'<span>Foto</span>'}</div><b>${esc(m?.name||'-')}</b><small>${esc(area?.name||'-')} · ${esc(point)}</small><small>${esc(reason)} · T${r?.shift||''}</small></a>`;
      }).join('')+'</div>';
    }catch(e){el.innerHTML=`<div class="notice">No fue posible cargar las evidencias de ${esc(labels.area)}.</div>`;console.error(e)}
  };
  window.renderEvidenceDashboard=optimizedEvidence;
  try{renderEvidenceDashboard=optimizedEvidence}catch(_e){}

  /* Collapse duplicate dashboard change handlers into one render + one evidence request. */
  let dashboardTimer=null;
  function scheduleDashboard(){
    clearTimeout(dashboardTimer);
    dashboardTimer=setTimeout(()=>{try{renderDashboard()}catch(e){console.error(e)}Promise.resolve().then(()=>renderEvidenceDashboard())},70);
  }
  ['dashboardArea','dashboardResponsible','dashboardShiftFilter'].forEach(id=>{
    const el=$(id);if(!el)return;
    el.addEventListener('change',e=>{e.stopImmediatePropagation();scheduleDashboard()},true);
  });

  /* Memory-safe image compression and object URL cleanup for repeated mobile photo capture. */
  async function canvasBlob(canvas,quality){return await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality))}
  const optimizedCompressImage=async function(file){
    let source=null,url=null;
    try{
      if('createImageBitmap'in window){source=await createImageBitmap(file)}
      else{
        url=URL.createObjectURL(file);
        source=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url});
      }
      let w=source.width,h=source.height;const max=960;
      if(w>max||h>max){const ratio=Math.min(max/w,max/h);w=Math.round(w*ratio);h=Math.round(h*ratio)}
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(source,0,0,w,h);
      let q=.68,blob=await canvasBlob(canvas,q);
      while(blob&&blob.size>520000&&q>.42){q-=.06;blob=await canvasBlob(canvas,q)}
      if(!blob)throw new Error('No fue posible optimizar la fotografía.');
      const dataUrl=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(blob)});
      return{dataUrl,mime:'image/jpeg',width:w,height:h,approxBytes:blob.size};
    }finally{
      if(source?.close)try{source.close()}catch(_e){}
      if(url)URL.revokeObjectURL(url);
    }
  };
  window.compressImage=optimizedCompressImage;
  try{compressImage=optimizedCompressImage}catch(_e){}
  let previewUrl=null;
  $('photoInput')?.addEventListener('change',()=>{
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    const src=$('photoPreview')?.src||'';previewUrl=src.startsWith('blob:')?src:null;
  });
  $('photoDialog')?.addEventListener('close',()=>{if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null}});

  /* QR fallback for browsers without BarcodeDetector (notably some Safari/iOS versions). */
  let jsQrPromise=null;
  function loadJsQr(){
    if(window.jsQR)return Promise.resolve();
    if(jsQrPromise)return jsQrPromise;
    jsQrPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src=new URL('vendor/jsqr.min.js',currentAssetBase).href;s.async=true;
      s.onload=()=>window.jsQR?resolve():reject(new Error('No se pudo iniciar el lector QR alternativo.'));
      s.onerror=()=>reject(new Error('No se pudo cargar el lector QR alternativo.'));document.head.appendChild(s);
    });
    return jsQrPromise;
  }
  const robustQrScanner=async function(){
    stopQrScanner();
    if(!navigator.mediaDevices?.getUserMedia){$('qrScannerMsg').textContent='Cámara no disponible. Use la alternativa manual.';return}
    try{
      S.qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
      $('qrVideo').srcObject=S.qrStream;await $('qrVideo').play();
      if('BarcodeDetector'in window){
        const detector=new BarcodeDetector({formats:['qr_code']});
        const tick=async()=>{if(!S.qrStream)return;try{const codes=await detector.detect($('qrVideo'));if(codes?.[0]?.rawValue){await validateQrText(codes[0].rawValue,'camera');return}}catch(_e){}S.qrLoop=requestAnimationFrame(tick)};tick();return;
      }
      $('qrScannerMsg').textContent='Activando lector compatible con este dispositivo…';await loadJsQr();
      $('qrScannerMsg').textContent='Apunte la cámara al QR de la máquina.';
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});let last=0;
      const tick=async ts=>{
        if(!S.qrStream)return;
        if(ts-last<220){S.qrLoop=requestAnimationFrame(tick);return}last=ts;
        const v=$('qrVideo'),vw=v.videoWidth||640,vh=v.videoHeight||480,scale=Math.min(1,640/vw);canvas.width=Math.max(1,Math.round(vw*scale));canvas.height=Math.max(1,Math.round(vh*scale));ctx.drawImage(v,0,0,canvas.width,canvas.height);
        try{const img=ctx.getImageData(0,0,canvas.width,canvas.height),code=window.jsQR(img.data,img.width,img.height,{inversionAttempts:'dontInvert'});if(code?.data){await validateQrText(code.data,'camera');return}}catch(_e){}
        S.qrLoop=requestAnimationFrame(tick);
      };S.qrLoop=requestAnimationFrame(tick);
    }catch(e){$('qrScannerMsg').textContent='No fue posible abrir la cámara. Permita el acceso o use el código manual.';console.error(e)}
  };
  window.startQrScanner=robustQrScanner;
  try{startQrScanner=robustQrScanner}catch(_e){}

  /* Lightweight connectivity feedback: no service worker, no stale offline cache. */
  const syncOnline=()=>{if(!navigator.onLine)setSync('Sin conexión · los cambios requieren internet');else if(S.session)setSync('Conectado')};
  window.addEventListener('online',syncOnline);window.addEventListener('offline',syncOnline);syncOnline();

  PV7.architecture={version:'7.7-lite',dashboardQueries:3,evidenceLimit:18,maxPhotoPx:960,qrFallback:true,noServiceWorker:true};
})();
