'use strict';
(function(){
  const PV7=window.PV7=window.PV7||{};
  const selectedShift=()=>$('dashboardShiftFilter')?.value||'all';
  const shiftMatches=(r,s)=>s==='all'||Number(r?.shift)===Number(s);
  const areaLabel=()=>{const id=$('dashboardArea')?.value||'all';return id==='all'?'Todas las áreas':(byId(S.areas,id)?.name||'Área')};
  const responsibleLabel=()=>{const id=$('dashboardResponsible')?.value||'all';return id==='all'?'Todos los responsables':(byId(S.profiles,id)?.full_name||'Responsable')};
  const shiftLabel=()=>selectedShift()==='all'?'Todos los turnos':`Turno ${selectedShift()}`;

  PV7.strictDashboardScope=function(){
    const base=PV7.dashboardScope?PV7.dashboardScope():{reviews:[],answers:[],random:[],historyReviews:[],historyAnswers:[]};
    const s=selectedShift();
    const reviews=(base.reviews||[]).filter(r=>shiftMatches(r,s));
    const ids=new Set(reviews.map(r=>r.id));
    const historyReviews=(base.historyReviews||[]).filter(r=>shiftMatches(r,s));
    const hids=new Set(historyReviews.map(r=>r.id));
    return{
      reviews,
      answers:(base.answers||[]).filter(a=>ids.has(a.review_id)),
      random:(base.random||[]).filter(x=>shiftMatches(x,s)),
      historyReviews,
      historyAnswers:(base.historyAnswers||[]).filter(a=>hids.has(a.review_id))
    };
  };

  function evidenceTitle(){
    const el=$('evidenceDashboard');
    const h=el?.closest('.card')?.querySelector('h3');
    if(h)h.textContent=`Evidencias · ${areaLabel()} · ${shiftLabel()}`;
  }

  function evidenceEmpty(message){
    const el=$('evidenceDashboard');if(!el)return;
    S.dashboardPhotos=[];S.evidenceUrls={};
    el.innerHTML=`<div class="notice">${esc(message)}</div>`;
  }

  window.renderEvidenceDashboard=async function(){
    const el=$('evidenceDashboard');if(!el||!isManager()||!S.dashboard)return;
    evidenceTitle();
    const scope=PV7.strictDashboardScope();
    const ids=scope.reviews.map(r=>r.id);
    if(!ids.length){evidenceEmpty(`No hay evidencias para ${areaLabel()} · ${responsibleLabel()} · ${shiftLabel()} en esta fecha.`);return}
    el.innerHTML='<div class="notice">Actualizando evidencias del filtro seleccionado…</div>';
    try{
      const rows=await must(db.from('photo_evidence').select('*').in('review_id',ids).order('taken_at',{ascending:false}).limit(36));
      S.dashboardPhotos=rows||[];
      if(!rows?.length){evidenceEmpty(`No hay fotografías registradas para ${areaLabel()} · ${responsibleLabel()} · ${shiftLabel()}.`);return}
      const {data,error}=await db.functions.invoke('evidence',{body:{action:'signed_urls',evidence_ids:rows.map(x=>x.id)}});
      if(error)throw error;if(data?.error)throw new Error(data.error);
      S.evidenceUrls=data?.urls||{};
      const reviews=new Map(scope.reviews.map(r=>[r.id,r])),answers=new Map(scope.answers.map(a=>[a.id,a]));
      el.innerHTML='<div class="evidence-gallery">'+rows.slice(0,18).map(p=>{
        const r=reviews.get(p.review_id),m=byId(S.machines,r?.machine_id),area=machineArea(r?.machine_id),a=p.answer_id?answers.get(p.answer_id):null;
        const point=a?answerPointName(a):'Foto general',url=S.evidenceUrls[p.id]||'',reason=p.required_reason==='random'?'Aleatoria':p.required_reason==='fixed'?'Obligatoria':p.required_reason==='machine'?'General':'Opcional';
        return `<a class="evidence-card" ${url?`href="${esc(url)}" target="_blank" rel="noopener"`:''} title="Toque para ampliar la evidencia"><div class="evidence-thumb">${url?`<img src="${esc(url)}" alt="Evidencia ${esc(m?.name||'')}">`:'<span>Foto</span>'}</div><b>${esc(m?.name||'-')}</b><small>${esc(area?.name||'-')} · ${esc(point)}</small><small>${esc(reason)} · T${r?.shift||''}</small></a>`;
      }).join('')+'</div>';
    }catch(e){evidenceEmpty(`No fue posible cargar las evidencias de ${areaLabel()}.`);console.error(e)}
  };

  window.openAnalysis=function(){
    const {reviews,answers,random,historyAnswers}=PV7.strictDashboardScope();
    const suspicious=reviews.filter(r=>PV7.flatRound(r,answers));
    const open=historyAnswers.filter(a=>(a.status==='no'||a.status==='na')&&a.observation&&!a.observation_closed).length;
    const missing=random.filter(x=>!x.fulfilled).length,items=[];
    if(open)items.push({cls:'high',title:`${open} hallazgo(s) siguen abiertos`,text:`Filtro: ${areaLabel()} · ${responsibleLabel()} · ${shiftLabel()}.`});
    if(suspicious.length)items.push({cls:'medium',title:`${suspicious.length} ronda(s) merecen auditoría`,text:'Tienen todas las respuestas en Cumple y un patrón de respuesta muy uniforme o cercano al mínimo.'});
    if(missing)items.push({cls:'medium',title:`${missing} evidencia(s) aleatorias pendientes`,text:'Verifique que se completen dentro del mismo filtro seleccionado.'});
    if(!items.length)items.push({cls:'',title:'Sin alerta prioritaria',text:`No hay alertas con ${areaLabel()} · ${responsibleLabel()} · ${shiftLabel()}.`});
    $('analysisContent').innerHTML=items.map(x=>`<div class="priority-item ${x.cls}"><strong>${esc(x.title)}</strong><span>${esc(x.text)}</span></div>`).join('')+'<p class="notice">El análisis respeta exactamente Área, Responsable, Turno y Fecha del Dashboard.</p>';
    $('analysisDialog').showModal();
  };

  function renderContext(){
    if(!S.dashboard)return;
    let el=document.querySelector('.dashboard-filter-context');
    if(!el){el=document.createElement('div');el.className='dashboard-filter-context';const filters=$('dashboardArea')?.closest('.filters');if(filters)filters.insertAdjacentElement('afterend',el)}
    if(!el)return;
    const areaId=$('dashboardArea')?.value||'all';
    const area=areaId==='all'?null:byId(S.areas,areaId);
    const activeModules=area?S.modules.filter(m=>m.area_id===area.id&&active(m)&&!m.is_mold_control):[];
    const mids=new Set(activeModules.map(m=>m.id));
    const activeMachines=area?S.machines.filter(m=>mids.has(m.module_id)&&active(m)):[];
    el.innerHTML=`<b>Mostrando:</b> ${esc(areaLabel())} · ${esc(responsibleLabel())} · ${esc(shiftLabel())}${area&&activeMachines.length===0?` <span class="badge warn">${esc(area.name)} aún no tiene máquinas activas</span>`:''}`;
  }

  const priorRender=window.renderDashboard;
  if(typeof priorRender==='function')window.renderDashboard=function(){const result=priorRender();renderContext();return result};

  function filterChanged(){
    renderContext();
    const el=$('evidenceDashboard');if(el)el.innerHTML='<div class="notice">Aplicando filtro a evidencias…</div>';
    Promise.resolve().then(()=>renderEvidenceDashboard());
  }
  $('dashboardArea')?.addEventListener('change',filterChanged);
  $('dashboardResponsible')?.addEventListener('change',filterChanged);
  $('dashboardShiftFilter')?.addEventListener('change',filterChanged);

  // Defensive audit: every visible evidence must come from a review inside the strict scope.
  PV7.auditFilterIntegrity=function(){
    const scope=PV7.strictDashboardScope(),allowed=new Set(scope.reviews.map(r=>r.id));
    return (S.dashboardPhotos||[]).every(p=>allowed.has(p.review_id));
  };
})();
