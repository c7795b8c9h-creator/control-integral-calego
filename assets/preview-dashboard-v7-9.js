'use strict';
(function(){
  const priorRender=window.renderDashboard;
  const pct=(n,d)=>d?Math.round(n*100/d):0;
  const activeArea=a=>!!a&&active(a)&&a.code!=='molds';
  const activeModule=m=>!!m&&active(m)&&!m.is_mold_control&&activeArea(byId(S.areas,m.area_id));
  const activeMachine=m=>!!m&&active(m)&&activeModule(byId(S.modules,m.module_id));
  const selectedArea=()=>$('dashboardArea')?.value||'all';
  const selectedResp=()=>$('dashboardResponsible')?.value||'all';
  const selectedShift=()=>$('dashboardShiftFilter')?.value||'all';
  function areaForMachine(m){const mod=byId(S.modules,m?.module_id);return mod?byId(S.areas,mod.area_id):null}
  function assignedMachines(userId,areaId){
    const mods=new Set(S.allModulePerms.filter(x=>x.user_id===userId).map(x=>x.module_id));
    return S.machines.filter(m=>activeMachine(m)&&mods.has(m.module_id)&&(areaId==='all'||areaForMachine(m)?.id===areaId));
  }
  function dashboardMachines(areaId,respId){
    if(respId!=='all')return assignedMachines(respId,areaId);
    return S.machines.filter(m=>activeMachine(m)&&(areaId==='all'||areaForMachine(m)?.id===areaId));
  }
  function filteredReviews(respId,areaId){
    return (S.dashboard?.reviews||[]).filter(r=>{
      const m=byId(S.machines,r.machine_id);
      return activeMachine(m)&&(areaId==='all'||areaForMachine(m)?.id===areaId)&&(respId==='all'||r.reviewed_by===respId)&&r.kind==='checklist';
    });
  }
  function closedFor(reviews,turn){return new Set(reviews.filter(r=>Number(r.shift)===turn&&r.status==='closed').map(r=>r.machine_id)).size}
  function splitHtml(rows,expectedByTurn){
    return `<div class="round-shift-split">${[1,2,3].map(t=>{
      const done=rows[t]||0,expected=expectedByTurn[t]||0,cov=expected?pct(done,expected):0;
      return `<div class="round-shift-card"><span>T${t}</span><b>${done}/${expected}</b><small>${cov}% cobertura</small></div>`;
    }).join('')}</div>`;
  }
  function patchKpis(){
    const f={area:selectedArea(),resp:selectedResp(),shift:selectedShift()};if(f.shift!=='all')return;
    const machines=dashboardMachines(f.area,f.resp),reviews=filteredReviews(f.resp,f.area),done={1:closedFor(reviews,1),2:closedFor(reviews,2),3:closedFor(reviews,3)},expected={1:machines.length,2:machines.length,3:machines.length};
    const kpis=[...document.querySelectorAll('#dashboardKpis .kpi')];if(kpis.length<3)return;
    kpis[1].className='kpi round-split-kpi';
    kpis[1].innerHTML=`<span>Rondas por turno</span>${splitHtml(done,expected)}<small>${f.resp==='all'?'Cada turno se mide por separado contra las máquinas físicas del filtro.':'El supervisor no tiene turno fijo: T1, T2 y T3 se muestran por separado.'}</small>`;
    const pend={1:Math.max(0,expected[1]-done[1]),2:Math.max(0,expected[2]-done[2]),3:Math.max(0,expected[3]-done[3])};
    kpis[2].className='kpi round-split-kpi';
    kpis[2].innerHTML=`<span>Pendientes por turno</span><div class="round-pending-split">${[1,2,3].map(t=>`<div><span>T${t}</span><b>${pend[t]}</b><small>pendientes</small></div>`).join('')}</div><small>No se suman los tres turnos en un único número.</small>`;
    const banner=document.querySelector('.dashboard-filter-context');
    if(banner&&f.resp!=='all')banner.insertAdjacentHTML('beforeend',' <span class="badge blue">Sin turno fijo · vista separada T1/T2/T3</span>');
  }
  function patchResponsibleCards(){
    const f={area:selectedArea(),resp:selectedResp(),shift:selectedShift()};if(f.shift!=='all')return;
    const root=$('responsibleTable');if(!root)return;
    const profiles=S.profiles.filter(p=>p.role==='responsable'&&p.active&&(f.resp==='all'||p.id===f.resp));
    const html=profiles.map(p=>{
      const machines=assignedMachines(p.id,f.area);if(!machines.length&&f.resp==='all')return'';
      const reviews=filteredReviews(p.id,f.area),done={1:closedFor(reviews,1),2:closedFor(reviews,2),3:closedFor(reviews,3)},expected={1:machines.length,2:machines.length,3:machines.length};
      const ids=new Set(reviews.map(r=>r.id)),answers=(S.dashboard?.answers||[]).filter(a=>ids.has(a.review_id)),fails=answers.filter(a=>a.status==='no').length,open=answers.filter(a=>(a.status==='no'||a.status==='na')&&a.observation&&!a.observation_closed).length;
      return `<article class="decision-card"><div class="decision-head"><b>${esc(p.full_name)}</b><span class="badge blue">Sin turno fijo</span></div>${splitHtml(done,expected)}<div class="decision-foot"><span class="badge ${fails?'bad':'ok'}">${fails} falla(s)</span> <span class="badge ${open?'warn':'ok'}">${open} abierta(s)</span> <small>${machines.length} máquinas asignadas</small></div></article>`;
    }).join('');
    root.innerHTML=`<div class="decision-list">${html||'<div class="notice">No hay responsables vinculados a este filtro.</div>'}</div>`;
  }
  window.renderDashboard=function(){priorRender();patchKpis();patchResponsibleCards()};
})();
