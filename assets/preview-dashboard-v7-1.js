'use strict';
(function(){
  const PROD_CODES=new Set(['iny','abl','aut','tap','val']);
  const COLLAPSIBLE_ORDER=['tap','abl','aut','val'];
  const moduleCodeForMachine=m=>machineModule(m.id)?.code||'';
  const isProductionMachine=m=>!!m&&active(m)&&PROD_CODES.has(moduleCodeForMachine(m));
  const productionMachines=areaId=>S.machines.filter(m=>isProductionMachine(m)&&(areaId==='all'||machineArea(m.id)?.id===areaId));
  const productionMachineIds=()=>new Set(S.machines.filter(isProductionMachine).map(m=>m.id));
  const expectedMachinesForUser=(userId,areaId)=>{
    const mids=new Set(S.allModulePerms.filter(x=>x.user_id===userId).map(x=>x.module_id));
    return S.machines.filter(m=>isProductionMachine(m)&&mids.has(m.module_id)&&(areaId==='all'||machineArea(m.id)?.id===areaId)).length;
  };
  const pct=(n,d)=>d?Math.round(n*100/d):0;

  function productionHistory(scope){
    const prod=productionMachineIds();
    const hr=scope.historyReviews.filter(r=>prod.has(r.machine_id));
    const ids=new Set(hr.map(r=>r.id));
    return{reviews:hr,answers:scope.historyAnswers.filter(a=>ids.has(a.review_id))};
  }

  function setDashboardTitles(selectedShift,machineCount){
    const set=(id,t)=>{const h=$(id)?.closest('.card')?.querySelector('h3');if(h)h.textContent=t};
    set('responsibleTable',`Cumplimiento por supervisor · Turno ${selectedShift}`);
    set('priorityList','Qué requiere acción ahora');
    set('shiftMatrix',`Cobertura por máquina y turno · ${machineCount} máquinas físicas`);
    set('moldDashboard','Máquinas reincidentes · últimos 7 días');
  }

  window.renderDashboard=function(){
    if(!S.dashboard)return;
    populateDashboardFilters();
    const scope=PV7.dashboardScope(),area=$('dashboardArea').value||'all',selectedShift=shift();
    const machines=productionMachines(area),machineIds=new Set(machines.map(m=>m.id));
    const reviews=scope.reviews.filter(r=>machineIds.has(r.machine_id));
    const reviewIds=new Set(reviews.map(r=>r.id));
    const answers=scope.answers.filter(a=>reviewIds.has(a.review_id));
    const checklist=reviews.filter(r=>r.kind==='checklist');
    const closedKeys=new Set(checklist.filter(r=>r.status==='closed').map(r=>`${r.machine_id}|${r.shift}`));
    const physicalMachines=machines.length,expectedSlots=physicalMachines*3,coverage=pct(closedKeys.size,expectedSlots),pending=Math.max(0,expectedSlots-closedKeys.size);

    const hist=productionHistory(scope),hmap=new Map(hist.reviews.map(r=>[r.id,r]));
    const openNc=hist.answers.filter(a=>(a.status==='no'||a.status==='na')&&a.observation&&!a.observation_closed).length;
    const failByMachine=new Map();
    hist.answers.filter(a=>a.status==='no').forEach(a=>{const r=hmap.get(a.review_id);if(r)failByMachine.set(r.machine_id,(failByMachine.get(r.machine_id)||0)+1)});
    const recurring=[...failByMachine.entries()].filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]);
    const suspicious=checklist.filter(r=>PV7.flatRound(r,answers)).length;
    const random=scope.random.filter(x=>machineIds.has(x.machine_id)),randomDone=random.filter(x=>x.fulfilled).length;

    setDashboardTitles(selectedShift,physicalMachines);
    $('dashboardKpis').innerHTML=`
      <div class="kpi"><b>${physicalMachines}</b><span>Máquinas productivas</span><small>Equipos físicos, sin multiplicar turnos</small></div>
      <div class="kpi ${coverage>=95?'ok':coverage>=75?'warn':'bad'}"><b>${closedKeys.size}/${expectedSlots}</b><span>Rondas del día</span><small>${coverage}% de cobertura · 3 turnos</small></div>
      <div class="kpi ${pending?'warn':'ok'}"><b>${pending}</b><span>Rondas pendientes</span><small>Máquina-turno aún sin cerrar</small></div>
      <div class="kpi ${openNc?'bad':'ok'}"><b>${openNc}</b><span>Hallazgos abiertos · 7 días</span><small>Producción únicamente</small></div>
      <div class="kpi ${suspicious?'warn':'ok'}"><b>${suspicious}</b><span>Rondas para auditar</span><small>Patrón plano o ritmo anormal</small></div>`;

    document.querySelectorAll('.dashboard-inline-note').forEach(n=>n.remove());
    const note=document.createElement('div');note.className='dashboard-inline-note';note.innerHTML=`<b>Evidencia aleatoria:</b> ${randomDone}/${random.length||0} cumplidas. ${random.length&&randomDone<random.length?'<span class="badge warn">Pendiente</span>':'<span class="badge ok">Al día</span>'}`;$('dashboardKpis').after(note);

    renderResponsiblesV71(reviews,answers,selectedShift,area);
    renderActionsV71(reviews,answers,hist.reviews,hist.answers,machines);
    renderMachineShiftsV71(reviews,answers,machines);
    renderRecurringV71(recurring,hist.reviews,hist.answers);
  };

  function renderResponsiblesV71(reviews,answers,selectedShift,areaId){
    const selected=$('dashboardResponsible').value||'all';
    const rows=S.profiles.filter(p=>p.role==='responsable'&&p.active&&(selected==='all'||p.id===selected)).map(p=>{
      const assigned=expectedMachinesForUser(p.id,areaId);
      const rr=reviews.filter(r=>r.reviewed_by===p.id&&r.kind==='checklist'&&r.shift===selectedShift);
      const ids=new Set(rr.map(r=>r.id)),aa=answers.filter(a=>ids.has(a.review_id));
      const closed=new Set(rr.filter(r=>r.status==='closed').map(r=>r.machine_id)).size;
      const fail=aa.filter(a=>a.status==='no').length,open=aa.filter(a=>(a.status==='no'||a.status==='na')&&a.observation&&!a.observation_closed).length,flat=rr.filter(r=>PV7.flatRound(r,aa)).length;
      const durations=rr.filter(r=>r.duration_seconds!=null).map(r=>r.duration_seconds),avg=durations.length?Math.round(durations.reduce((x,y)=>x+y,0)/durations.length/6)/10:null;
      return{p,assigned,closed,cov:pct(closed,assigned),fail,open,flat,avg};
    }).filter(x=>x.assigned>0||selected!=='all');

    $('responsibleTable').innerHTML=`<div class="decision-list">${rows.map(x=>`<article class="decision-card"><div class="decision-head"><b>${esc(x.p.full_name)}</b><span class="badge ${x.cov>=95?'ok':x.cov>=70?'warn':'bad'}">T${selectedShift} · ${x.cov}%</span></div><div class="decision-metrics"><span><b>${x.assigned}</b> máquinas asignadas</span><span><b>${x.closed}/${x.assigned}</b> rondas cerradas</span><span><b>${x.fail}</b> fallas</span><span><b>${x.open}</b> abiertas</span></div><div class="decision-foot">${x.flat?`<span class="badge warn">${x.flat} ronda(s) para auditar</span>`:'<span class="badge ok">Sin patrón plano</span>'}${x.avg!=null?` <small>${x.avg} min prom.</small>`:''}</div></article>`).join('')||'<div class="notice">No hay responsables con máquinas asignadas en este filtro.</div>'}</div>`;
  }

  function renderActionsV71(reviews,answers,hReviews,hAnswers,machines){
    const actions=[],closed=new Set(reviews.filter(r=>r.kind==='checklist'&&r.status==='closed').map(r=>`${r.machine_id}|${r.shift}`));
    machines.forEach(m=>{for(let s=1;s<=3;s++)if(!closed.has(`${m.id}|${s}`))actions.push({score:15-s,title:`${m.name} · Turno ${s}`,text:'Ronda pendiente. Confirmar responsable y ejecución.',kind:'pending'})});
    const rmap=new Map(hReviews.map(r=>[r.id,r]));
    hAnswers.filter(a=>(a.status==='no'||a.status==='na')&&a.observation&&!a.observation_closed).forEach(a=>{const r=rmap.get(a.review_id);if(!r)return;const age=Math.max(0,Math.floor((Date.now()-new Date(a.answered_at||r.started_at))/86400000));actions.push({score:60+age,title:`${byId(S.machines,r.machine_id)?.name||'Máquina'} · hallazgo abierto`,text:`${a.observation||statusLabel(a.status)}${age?` · ${age} día(s) abierto`:''}`,kind:'failure'})});
    reviews.filter(r=>PV7.flatRound(r,answers)).forEach(r=>actions.push({score:35,title:`Auditar muestra · ${byId(S.machines,r.machine_id)?.name||'Máquina'}`,text:`Ronda de ${byId(S.profiles,r.reviewed_by)?.full_name||'responsable'} con patrón muy uniforme.`,kind:'audit'}));
    actions.sort((a,b)=>b.score-a.score);
    $('priorityList').innerHTML=`<div class="action-stack">${actions.slice(0,8).map((a,i)=>`<div class="action-row ${a.kind}"><span class="action-rank">${i+1}</span><div><b>${esc(a.title)}</b><small>${esc(a.text)}</small></div></div>`).join('')||'<div class="notice good-note">No hay acciones críticas con el filtro actual.</div>'}</div>`;
  }

  function stateFor(m,s,reviews,answers){
    const rr=reviews.filter(r=>r.kind==='checklist'&&r.machine_id===m.id&&r.shift===s).sort((a,b)=>String(b.closed_at||b.started_at).localeCompare(String(a.closed_at||a.started_at))),r=rr[0];
    if(!r)return{cls:'pending',label:'Pendiente',detail:'Sin ronda'};
    const aa=answers.filter(a=>a.review_id===r.id),fails=aa.filter(a=>a.status==='no').length,flat=PV7.flatRound(r,answers),u=byId(S.profiles,r.reviewed_by);
    return{cls:fails?'bad':r.status==='closed'?(flat?'warn':'ok'):'progress',label:fails?`${fails} falla(s)`:r.status==='closed'?(flat?'Auditar':'Cerrada'):'En curso',detail:u?.full_name||''};
  }

  function machineCards(ms,reviews,answers){return `<div class="machine-grid">${ms.map(m=>`<article class="machine-card"><div class="machine-name"><b>${esc(m.name)}</b></div><div class="shift-pills">${[1,2,3].map(s=>{const x=stateFor(m,s,reviews,answers);return`<div class="shift-pill ${x.cls}"><span>T${s}</span><b>${esc(x.label)}</b><small>${esc(x.detail)}</small></div>`}).join('')}</div></article>`).join('')}</div>`}

  function renderMachineShiftsV71(reviews,answers,machines){
    const byCode=new Map();machines.forEach(m=>{const c=moduleCodeForMachine(m);if(!byCode.has(c))byCode.set(c,[]);byCode.get(c).push(m)});
    const iny=(byCode.get('iny')||[]).sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name,'es'));
    const collapsible=COLLAPSIBLE_ORDER.map(code=>({code,mod:S.modules.find(m=>m.code===code),machines:(byCode.get(code)||[]).sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name,'es'))})).filter(g=>g.machines.length);
    $('shiftMatrix').innerHTML=`<div class="business-coverage">${iny.length?`<section class="business-section"><div class="business-title"><b>Inyección</b><span>${iny.length} máquinas</span></div>${machineCards(iny,reviews,answers)}</section>`:''}${collapsible.length?`<section class="business-section"><div class="business-title"><b>Colapsibles</b><span>${collapsible.reduce((n,g)=>n+g.machines.length,0)} máquinas</span></div>${collapsible.map(g=>`<div class="machine-subgroup"><div class="subgroup-title">${esc(g.mod?.name||g.code)} <span>${g.machines.length}</span></div>${machineCards(g.machines,reviews,answers)}</div>`).join('')}</section>`:''}</div>`;
  }

  function renderRecurringV71(recurring,hReviews,hAnswers){
    const rmap=new Map(hReviews.map(r=>[r.id,r])),rows=recurring.slice(0,8).map(([mid,n])=>{const m=byId(S.machines,mid),points=new Map();hAnswers.filter(a=>a.status==='no'&&rmap.get(a.review_id)?.machine_id===mid).forEach(a=>{const name=answerPointName(a);points.set(name,(points.get(name)||0)+1)});return{m,n,top:[...points.entries()].sort((a,b)=>b[1]-a[1])[0]}});
    $('moldDashboard').innerHTML=`<div class="recurrence-list">${rows.map(x=>`<div class="recurrence-row"><div><b>${esc(x.m?.name||'-')}</b><small>${esc(machineModule(x.m?.id)?.name||'')}</small></div><span class="badge bad">${x.n} fallas</span><small>${x.top?`Repite: ${esc(x.top[0])} (${x.top[1]})`:'Revisar tendencia'}</small></div>`).join('')||'<div class="notice good-note">No hay máquinas con 2 o más fallas en los últimos 7 días.</div>'}</div>`;
  }
})();
