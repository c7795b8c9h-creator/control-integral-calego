'use strict';
(function(){
  const PV7=window.PV7=window.PV7||{};
  const sort=(a,b)=>(a.sort_order||0)-(b.sort_order||0)||String(a.name||'').localeCompare(String(b.name||''),'es');
  const selectedShift=()=>$('dashboardShiftFilter')?.value||'all';
  const shiftMatches=(r,s)=>s==='all'||Number(r?.shift)===Number(s);
  const areaById=id=>byId(S.areas,id);
  const moduleById=id=>byId(S.modules,id);
  const machineById=id=>byId(S.machines,id);
  const isEffectiveArea=a=>!!a&&active(a)&&a.code!=='molds';
  const isEffectiveModule=m=>!!m&&active(m)&&!m.is_mold_control&&isEffectiveArea(areaById(m.area_id));
  const isEffectiveMachine=m=>!!m&&active(m)&&isEffectiveModule(moduleById(m.module_id));
  const effectiveAreas=()=>S.areas.filter(isEffectiveArea).sort(sort);
  const effectiveModules=()=>S.modules.filter(isEffectiveModule).sort(sort);
  const effectiveMachines=()=>S.machines.filter(isEffectiveMachine).sort(sort);
  const effectiveMachineIds=()=>new Set(effectiveMachines().map(m=>m.id));
  const areaName=id=>id==='all'?'Todas las áreas':(areaById(id)?.name||'Área');
  const respName=id=>id==='all'?'Todos los responsables':(byId(S.profiles,id)?.full_name||'Responsable');
  const shiftName=s=>s==='all'?'Todos los turnos':`Turno ${s}`;
  const pct=(n,d)=>d?Math.round(n*100/d):0;

  /* ---------- Effective hierarchy: inactive parents disappear everywhere ---------- */
  window.permittedModules=function(){
    return effectiveModules().filter(m=>isManager()||S.modulePerms.includes(m.id));
  };
  window.machinesForModule=function(id){
    const m=moduleById(id);if(!isEffectiveModule(m))return[];
    return S.machines.filter(x=>x.module_id===id&&isEffectiveMachine(x)).sort((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name,'es'));
  };
  window.itemsForModule=function(id){
    const m=moduleById(id);if(!isEffectiveModule(m))return[];
    return S.items.filter(x=>x.module_id===id&&active(x)).sort((a,b)=>a.sort_order-b.sort_order||a.label.localeCompare(b.label,'es'));
  };

  /* ---------- Anti-flat: physical confirmation is scoped to each review ---------- */
  S._inspectionAcks={
    _data:new Set(),
    _key(id){return `${S.review?.id||'no-review'}|${id}`},
    add(id){this._data.add(this._key(id));return this},
    has(id){return this._data.has(this._key(id))},
    delete(id){return this._data.delete(this._key(id))},
    clear(){this._data.clear()}
  };

  /* ---------- Photo preview: revoke temporary URLs and keep mobile preview compact ---------- */
  let photoObjectUrl=null;
  window.previewPhoto=function(){
    if(photoObjectUrl){try{URL.revokeObjectURL(photoObjectUrl)}catch(_e){}photoObjectUrl=null}
    const f=$('photoInput')?.files?.[0];if(!f)return;
    photoObjectUrl=URL.createObjectURL(f);
    const img=$('photoPreview');if(img){img.src=photoObjectUrl;img.classList.remove('hidden')}
    if($('photoHelp'))$('photoHelp').innerHTML=`Foto original: ${(f.size/1024/1024).toFixed(1)} MB. <b>Se guardará optimizada</b> a máx. 960 px.`;
  };
  $('photoDialog')?.addEventListener('close',()=>{if(photoObjectUrl){try{URL.revokeObjectURL(photoObjectUrl)}catch(_e){}photoObjectUrl=null}});

  /* ---------- Manager top context: one shift concept, not two ---------- */
  const priorRoleUI=window.renderRoleUI;
  if(typeof priorRoleUI==='function')window.renderRoleUI=function(){
    priorRoleUI();
    const shiftWrap=$('shiftSelect')?.closest('label');
    if(shiftWrap)shiftWrap.classList.toggle('curation-hide-manager-shift',isManager());
  };

  /* ---------- Dashboard: one strict source of truth for every block ---------- */
  function currentFilters(){return{area:$('dashboardArea')?.value||'all',resp:$('dashboardResponsible')?.value||'all',shift:selectedShift()}}
  function userModuleIds(userId){return new Set(S.allModulePerms.filter(x=>x.user_id===userId).map(x=>x.module_id).filter(id=>isEffectiveModule(moduleById(id))))}
  function assignedMachines(userId,areaId='all'){
    const mids=userModuleIds(userId);
    return effectiveMachines().filter(m=>mids.has(m.module_id)&&(areaId==='all'||machineArea(m.id)?.id===areaId));
  }
  function dashboardMachines(areaId,respId){
    const assigned=respId!=='all'?new Set(assignedMachines(respId,areaId).map(m=>m.id)):null;
    return effectiveMachines().filter(m=>(areaId==='all'||machineArea(m.id)?.id===areaId)&&(!assigned||assigned.has(m.id)));
  }
  function strictScope(){
    const D=S.dashboard||{reviews:[],answers:[],random:[],historyReviews:[],historyAnswers:[]},f=currentFilters(),valid=effectiveMachineIds();
    const keepReview=r=>valid.has(r.machine_id)&&(f.area==='all'||machineArea(r.machine_id)?.id===f.area)&&(f.resp==='all'||r.reviewed_by===f.resp)&&shiftMatches(r,f.shift);
    const reviews=(D.reviews||[]).filter(keepReview),ids=new Set(reviews.map(r=>r.id));
    const historyReviews=(D.historyReviews||[]).filter(keepReview),hids=new Set(historyReviews.map(r=>r.id));
    const random=(D.random||[]).filter(x=>valid.has(x.machine_id)&&(f.area==='all'||machineArea(x.machine_id)?.id===f.area)&&(f.resp==='all'||x.responsible_id===f.resp)&&shiftMatches(x,f.shift));
    return{reviews,answers:(D.answers||[]).filter(a=>ids.has(a.review_id)),random,historyReviews,historyAnswers:(D.historyAnswers||[]).filter(a=>hids.has(a.review_id))};
  }
  PV7.strictDashboardScope=strictScope;

  function populateFilters(){
    const oldArea=$('dashboardArea')?.value||'all',oldResp=$('dashboardResponsible')?.value||'all';
    const areaEl=$('dashboardArea'),respEl=$('dashboardResponsible');if(!areaEl||!respEl)return;
    areaEl.innerHTML='<option value="all">Todas</option>'+effectiveAreas().map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
    areaEl.value=[...areaEl.options].some(o=>o.value===oldArea)?oldArea:'all';
    const area=areaEl.value;
    const allowedProfiles=S.profiles.filter(p=>p.role==='responsable'&&p.active).filter(p=>{
      if(area==='all')return true;
      const mids=userModuleIds(p.id);return effectiveModules().some(m=>m.area_id===area&&mids.has(m.id)) || (S.dashboard?.reviews||[]).some(r=>r.reviewed_by===p.id&&machineArea(r.machine_id)?.id===area);
    });
    respEl.innerHTML='<option value="all">Todos</option>'+allowedProfiles.map(p=>`<option value="${p.id}">${esc(p.full_name)}</option>`).join('');
    respEl.value=[...respEl.options].some(o=>o.value===oldResp)?oldResp:'all';
  }

  function contextBanner(){
    let el=document.querySelector('.dashboard-filter-context');
    if(!el){el=document.createElement('div');el.className='dashboard-filter-context';$('dashboardArea')?.closest('.filters')?.insertAdjacentElement('afterend',el)}
    if(!el)return;
    const f=currentFilters(),machines=dashboardMachines(f.area,f.resp);
    el.innerHTML=`<b>Mostrando:</b> ${esc(areaName(f.area))} · ${esc(respName(f.resp))} · ${esc(shiftName(f.shift))}${f.area!=='all'&&machines.length===0?` <span class="badge warn">Sin equipos activos configurados</span>`:''}`;
  }

  function stateFor(m,t,reviews,answers){
    const rr=reviews.filter(r=>r.kind==='checklist'&&r.machine_id===m.id&&Number(r.shift)===Number(t)).sort((a,b)=>String(b.closed_at||b.started_at).localeCompare(String(a.closed_at||a.started_at))),r=rr[0];
    if(!r)return{cls:'pending',label:'Pendiente',detail:'Sin ronda'};
    const aa=answers.filter(a=>a.review_id===r.id),fails=aa.filter(a=>a.status==='no').length,flat=PV7.flatRound?.(r,answers),u=byId(S.profiles,r.reviewed_by);
    return{cls:fails?'bad':r.status==='closed'?(flat?'warn':'ok'):'progress',label:fails?`${fails} falla(s)`:r.status==='closed'?(flat?'Auditar':'Cerrada'):'En curso',detail:u?.full_name||''};
  }
  function machineCards(ms,reviews,answers,s){
    const turns=s==='all'?[1,2,3]:[Number(s)];
    return `<div class="machine-grid">${ms.map(m=>`<article class="machine-card"><div class="machine-name"><b>${esc(m.name)}</b><small>${esc(moduleById(m.module_id)?.name||'')}</small></div><div class="shift-pills ${s==='all'?'':'single-shift'}">${turns.map(t=>{const x=stateFor(m,t,reviews,answers);return`<div class="shift-pill ${x.cls}"><span>T${t}</span><b>${esc(x.label)}</b><small>${esc(x.detail)}</small></div>`}).join('')}</div></article>`).join('')}</div>`;
  }
  function renderCoverage(reviews,answers,machines,s){
    const holder=$('shiftMatrix');if(!holder)return;
    if(!machines.length){holder.innerHTML='<div class="notice">No hay equipos activos con el filtro seleccionado.</div>';return}
    const areas=[...new Set(machines.map(m=>machineArea(m.id)?.id).filter(Boolean))].map(areaById).filter(Boolean).sort(sort);
    holder.innerHTML='<div class="business-coverage">'+areas.map(a=>{
      const am=machines.filter(m=>machineArea(m.id)?.id===a.id);
      if(a.code==='production'){
        const groups=[];
        const iny=am.filter(m=>moduleById(m.module_id)?.code==='iny');if(iny.length)groups.push(`<div class="machine-subgroup"><div class="subgroup-title">Inyección <span>${iny.length}</span></div>${machineCards(iny,reviews,answers,s)}</div>`);
        const order=['tap','abl','aut','val'];
        const coll=order.map(code=>({code,mod:S.modules.find(x=>x.code===code),ms:am.filter(m=>moduleById(m.module_id)?.code===code)})).filter(g=>g.ms.length);
        if(coll.length)groups.push(`<div class="machine-subgroup"><div class="subgroup-title">Colapsibles <span>${coll.reduce((n,g)=>n+g.ms.length,0)}</span></div>${coll.map(g=>`<div class="curation-module-group"><b>${esc(g.mod?.name||g.code)}</b>${machineCards(g.ms,reviews,answers,s)}</div>`).join('')}</div>`);
        const known=new Set(['iny','tap','abl','aut','val']),other=am.filter(m=>!known.has(moduleById(m.module_id)?.code));
        if(other.length)groups.push(machineCards(other,reviews,answers,s));
        return `<section class="business-section"><div class="business-title"><b>${esc(a.name)}</b><span>${am.length} equipos</span></div>${groups.join('')}</section>`;
      }
      const mods=[...new Set(am.map(m=>m.module_id))].map(moduleById).filter(Boolean).sort(sort);
      return `<section class="business-section"><div class="business-title"><b>${esc(a.name)}</b><span>${am.length} equipos</span></div>${mods.map(m=>{const mm=am.filter(x=>x.module_id===m.id);return`<div class="machine-subgroup"><div class="subgroup-title">${esc(m.name)} <span>${mm.length}</span></div>${machineCards(mm,reviews,answers,s)}</div>`}).join('')}</section>`;
    }).join('')+'</div>';
  }

  function renderResponsiblesCurated(reviews,answers,f){
    const el=$('responsibleTable');if(!el)return;
    const performed=new Set(reviews.map(r=>r.reviewed_by));
    const rows=S.profiles.filter(p=>p.role==='responsable'&&p.active&&(f.resp==='all'||p.id===f.resp)).map(p=>{
      const assigned=assignedMachines(p.id,f.area).length,rr=reviews.filter(r=>r.reviewed_by===p.id&&r.kind==='checklist'),ids=new Set(rr.map(r=>r.id)),aa=answers.filter(a=>ids.has(a.review_id));
      const closed=new Set(rr.filter(r=>r.status==='closed').map(r=>`${r.machine_id}|${r.shift}`)).size,expected=f.shift==='all'?null:assigned;
      const fail=aa.filter(a=>a.status==='no').length,open=aa.filter(a=>(a.status==='no'||a.status==='na')&&a.observation&&!a.observation_closed).length,flat=rr.filter(r=>PV7.flatRound?.(r,aa)).length;
      const ds=rr.filter(r=>r.duration_seconds!=null).map(r=>r.duration_seconds),avg=ds.length?Math.round(ds.reduce((x,y)=>x+y,0)/ds.length/6)/10:null;
      return{p,assigned,closed,expected,cov:expected?pct(closed,expected):null,fail,open,flat,avg};
    }).filter(x=>x.assigned>0||performed.has(x.p.id)||f.resp!=='all');
    el.innerHTML=`<div class="decision-list">${rows.map(x=>`<article class="decision-card"><div class="decision-head"><b>${esc(x.p.full_name)}</b>${f.shift==='all'?'<span class="badge blue">Vista día</span>':`<span class="badge ${x.cov>=95?'ok':x.cov>=70?'warn':'bad'}">${x.cov}%</span>`}</div><div class="decision-metrics"><span><b>${x.assigned}</b> asignados</span><span><b>${x.closed}${x.expected!=null?'/'+x.expected:''}</b> rondas</span><span><b>${x.fail}</b> fallas</span><span><b>${x.open}</b> abiertas</span></div><div class="decision-foot">${x.flat?`<span class="badge warn">${x.flat} para auditar</span>`:'<span class="badge ok">Sin patrón plano</span>'}${x.avg!=null?` <small>${x.avg} min prom.</small>`:''}</div></article>`).join('')||'<div class="notice">No hay responsables vinculados a este filtro.</div>'}</div>`;
  }

  function renderActionsCurated(scope,machines,f){
    const el=$('priorityList');if(!el)return;
    const actions=[],closed=new Set(scope.reviews.filter(r=>r.kind==='checklist'&&r.status==='closed').map(r=>`${r.machine_id}|${r.shift}`)),turns=f.shift==='all'?[1,2,3]:[Number(f.shift)];
    machines.forEach(m=>turns.forEach(t=>{if(!closed.has(`${m.id}|${t}`))actions.push({score:15-t,title:`${m.name} · Turno ${t}`,text:'Ronda pendiente.',kind:'pending'})}));
    const rmap=new Map(scope.historyReviews.map(r=>[r.id,r]));
    scope.historyAnswers.filter(a=>(a.status==='no'||a.status==='na')&&a.observation&&!a.observation_closed).forEach(a=>{const r=rmap.get(a.review_id);if(!r)return;const age=Math.max(0,Math.floor((Date.now()-new Date(a.answered_at||r.started_at))/86400000));actions.push({score:60+age,title:`${machineById(r.machine_id)?.name||'Equipo'} · hallazgo abierto`,text:`${a.observation||statusLabel(a.status)}${age?` · ${age} día(s)`:''}`,kind:'failure'})});
    scope.reviews.filter(r=>PV7.flatRound?.(r,scope.answers)).forEach(r=>actions.push({score:35,title:`Auditar · ${machineById(r.machine_id)?.name||'Equipo'}`,text:`Ronda de ${byId(S.profiles,r.reviewed_by)?.full_name||'responsable'} con patrón muy uniforme.`,kind:'audit'}));
    actions.sort((a,b)=>b.score-a.score);
    el.innerHTML=`<div class="action-stack">${actions.slice(0,8).map((a,i)=>`<div class="action-row ${a.kind}"><span class="action-rank">${i+1}</span><div><b>${esc(a.title)}</b><small>${esc(a.text)}</small></div></div>`).join('')||'<div class="notice good-note">No hay acciones críticas con el filtro actual.</div>'}</div>`;
  }

  function renderRecurringCurated(scope){
    const el=$('moldDashboard');if(!el)return;
    const rmap=new Map(scope.historyReviews.map(r=>[r.id,r])),counts=new Map();
    scope.historyAnswers.filter(a=>a.status==='no').forEach(a=>{const r=rmap.get(a.review_id);if(r)counts.set(r.machine_id,(counts.get(r.machine_id)||0)+1)});
    const rows=[...counts.entries()].filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]).slice(0,8);
    el.innerHTML=`<div class="recurrence-list">${rows.map(([mid,n])=>{const m=machineById(mid);return`<div class="recurrence-row"><div><b>${esc(m?.name||'-')}</b><small>${esc(machineArea(mid)?.name||'')} · ${esc(moduleById(m?.module_id)?.name||'')}</small></div><span class="badge bad">${n} fallas</span><small>Revisar repetición del mismo equipo/punto.</small></div>`}).join('')||'<div class="notice good-note">No hay equipos con 2 o más fallas en los últimos 7 días.</div>'}</div>`;
  }

  window.renderDashboard=function(){
    if(!S.dashboard)return;
    populateFilters();contextBanner();
    const f=currentFilters(),machines=dashboardMachines(f.area,f.resp),scope=strictScope(),turnFactor=f.shift==='all'?3:1;
    const checklist=scope.reviews.filter(r=>r.kind==='checklist'),closed=new Set(checklist.filter(r=>r.status==='closed').map(r=>`${r.machine_id}|${r.shift}`)).size,expected=machines.length*turnFactor,pending=Math.max(0,expected-closed),coverage=pct(closed,expected);
    const open=scope.historyAnswers.filter(a=>(a.status==='no'||a.status==='na')&&a.observation&&!a.observation_closed).length,suspicious=checklist.filter(r=>PV7.flatRound?.(r,scope.answers)).length,randomDone=scope.random.filter(x=>x.fulfilled).length;
    const productionOnly=f.area!=='all'&&areaById(f.area)?.code==='production';
    $('dashboardKpis').innerHTML=`<div class="kpi"><b>${machines.length}</b><span>${productionOnly?'Máquinas productivas':'Puntos / equipos activos'}</span><small>Entidades físicas del filtro</small></div><div class="kpi ${coverage>=95?'ok':coverage>=75?'warn':'bad'}"><b>${closed}/${expected}</b><span>Rondas esperadas</span><small>${coverage}% cobertura · ${shiftName(f.shift)}</small></div><div class="kpi ${pending?'warn':'ok'}"><b>${pending}</b><span>Rondas pendientes</span><small>${f.shift==='all'?'Equipo-turno sin cerrar':'Pendientes en T'+f.shift}</small></div><div class="kpi ${open?'bad':'ok'}"><b>${open}</b><span>Hallazgos abiertos · 7 días</span><small>Solo dentro del filtro</small></div><div class="kpi ${suspicious?'warn':'ok'}"><b>${suspicious}</b><span>Rondas para auditar</span><small>Patrón plano o ritmo anormal</small></div>`;
    document.querySelectorAll('.dashboard-inline-note').forEach(n=>n.remove());const note=document.createElement('div');note.className='dashboard-inline-note';note.innerHTML=`<b>Evidencia aleatoria:</b> ${randomDone}/${scope.random.length||0} cumplidas.`;$('dashboardKpis').after(note);
    const title=(id,text)=>{const h=$(id)?.closest('.card')?.querySelector('h3');if(h)h.textContent=text};
    title('responsibleTable',`Cumplimiento por supervisor · ${shiftName(f.shift)}`);title('priorityList','Qué requiere acción ahora');title('shiftMatrix',`Cobertura por equipo · ${areaName(f.area)}`);title('moldDashboard','Reincidencias · últimos 7 días');
    renderResponsiblesCurated(scope.reviews,scope.answers,f);renderActionsCurated(scope,machines,f);renderCoverage(scope.reviews,scope.answers,machines,f.shift);renderRecurringCurated(scope);
  };

  /* ---------- Checklist manager: no orphan modules from inactive areas ---------- */
  window.renderChecklistManager=function(){
    const mods=effectiveModules(),current=S._managerTemplateModule&&mods.some(m=>m.id===S._managerTemplateModule)?S._managerTemplateModule:mods[0]?.id;S._managerTemplateModule=current;const mod=byId(mods,current),its=mod?itemsForModule(mod.id):[],ms=mod?machinesForModule(mod.id):[];
    $('checkManagerView').innerHTML=`<div class="module-tabs">${mods.map(m=>`<button class="tab-btn ${m.id===current?'active':''}" onclick="selectTemplateModule('${m.id}')">${esc(areaById(m.area_id)?.name||'')} · ${esc(m.name)}</button>`).join('')}</div>${mod?`<div class="card"><div class="page-head"><div><h3>${esc(mod.name)}</h3><p>${esc(areaById(mod.area_id)?.name||'')} · ${ms.length} equipo(s) · ${its.length} punto(s).</p></div><button class="btn light sm" onclick="showPage('matrix')">Abrir Matriz</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Punto</th><th>Foto</th></tr></thead><tbody>${its.map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.label)}</b></td><td>${photoBadge(x.photo_mode)}</td></tr>`).join('')}</tbody></table></div></div>`:'<div class="notice">No hay líneas activas.</div>'}`;
  };

  /* ---------- Users: hide permissions belonging to deleted parent areas ---------- */
  function curatedUserCard(u){const p=permsForUser(u.id),areas=effectiveAreas(),mods=effectiveModules();return`<div class="user-card" id="user_${u.id}"><div class="user-fields"><label>Nombre<input id="u_name_${u.id}" value="${esc(u.full_name)}"></label><label>Usuario<input id="u_username_${u.id}" value="${esc(u.username||'')}"></label><label>Rol<select id="u_role_${u.id}"><option value="responsable" ${u.role==='responsable'?'selected':''}>Responsable</option><option value="gerente" ${u.role==='gerente'?'selected':''}>Gerente</option></select></label><label>Estado<select id="u_active_${u.id}"><option value="true" ${u.active?'selected':''}>Activo</option><option value="false" ${!u.active?'selected':''}>Inactivo</option></select></label><label class="full-span">Nueva clave <small>(dejar vacía para conservar)</small><input id="u_pass_${u.id}" type="password" placeholder="Mínimo 8 caracteres"></label></div><details><summary>Permisos · ${p.areas.filter(id=>isEffectiveArea(areaById(id))).length} área(s) · ${p.modules.filter(id=>isEffectiveModule(moduleById(id))).length} línea(s)</summary><div class="permissions-grid"><div><b>Áreas</b><div class="checks">${areas.map(a=>`<label><input type="checkbox" class="u_area_${u.id}" value="${a.id}" ${p.areas.includes(a.id)?'checked':''}>${esc(a.name)}</label>`).join('')}</div></div><div><b>Líneas</b><div class="checks">${mods.map(m=>`<label><input type="checkbox" class="u_mod_${u.id}" value="${m.id}" ${p.modules.includes(m.id)?'checked':''}>${esc(areaById(m.area_id)?.name||'')} / ${esc(m.name)}</label>`).join('')}</div></div></div></details><div class="actions"><button class="btn dark sm" onclick="saveUser('${u.id}')">Guardar</button>${u.id!==S.profile.id?`<button class="btn danger sm" onclick="deleteUser('${u.id}')">Eliminar</button>`:''}</div></div>`}
  window.renderUsers=function(){if(!isManager())return;$('userCards').innerHTML=S.profiles.map(curatedUserCard).join('')};
  window.renderNewUserCard=function(){const areas=effectiveAreas(),mods=effectiveModules();$('userCards').insertAdjacentHTML('afterbegin',`<div class="user-card" id="newUser"><div class="user-fields"><label>Nombre<input id="nu_name"></label><label>Usuario<input id="nu_username"></label><label>Clave<input id="nu_pass" type="password"></label><label>Rol<select id="nu_role"><option value="responsable">Responsable</option><option value="gerente">Gerente</option></select></label></div><details open><summary>Permisos</summary><div class="permissions-grid"><div><b>Áreas</b><div class="checks">${areas.map(a=>`<label><input type="checkbox" class="nu_area" value="${a.id}">${esc(a.name)}</label>`).join('')}</div></div><div><b>Líneas</b><div class="checks">${mods.map(m=>`<label><input type="checkbox" class="nu_mod" value="${m.id}">${esc(areaById(m.area_id)?.name||'')} / ${esc(m.name)}</label>`).join('')}</div></div></div></details><div class="actions"><button class="btn primary" onclick="createUser()">Crear usuario</button><button class="btn light" onclick="$('newUser').remove()">Cancelar</button></div></div>`)};

  /* ---------- QR: hide descendants of inactive areas/modules and block stale QR client-side ---------- */
  window.renderQrPage=async function(){if(!isManager())return;try{const {data,error}=await db.rpc('manager_machine_qr_tokens');if(error)throw error;S.qrTokens=(data||[]).filter(x=>isEffectiveMachine(machineById(x.machine_id)));$('toggleQrRequired').textContent=S.settings.qr_required?'QR obligatorio: ACTIVADO':'QR obligatorio: DESACTIVADO';$('toggleQrRequired').className='btn '+(S.settings.qr_required?'primary':'light');$('qrGrid').innerHTML=S.qrTokens.map(x=>{const m=machineById(x.machine_id);return`<div class="qr-card"><canvas id="qr_${x.machine_id}"></canvas><h3>${esc(x.machine_name)}</h3><div class="qr-code">${esc(x.machine_code)}</div><small>${esc(machineArea(x.machine_id)?.name||'')} · ${esc(moduleById(m?.module_id)?.name||'')}</small><button class="btn light sm no-print" onclick="printOneQr('${x.machine_id}')">Imprimir</button></div>`}).join('')||'<div class="notice">No hay equipos activos para generar QR.</div>';setTimeout(()=>S.qrTokens.forEach(x=>drawQr(x)),10);await loadQrAudit()}catch(e){fail(e,'QR')}};
  const priorValidate=window.validateQrText||validateQrText;
  window.validateQrText=async function(text,method){const q=parseQr(text);if(!q)return toast('Código QR no reconocido.','bad');const m=S.machines.find(x=>String(x.code).toUpperCase()===String(q.code).toUpperCase());if(!isEffectiveMachine(m))return toast('Este equipo ya no está activo en la estructura operativa.','bad');return priorValidate(text,method)};

  /* ---------- Observations: area + responsible filters, same mental model as Dashboard ---------- */
  function ensureObservationFilters(){
    const filters=$('obsStatus')?.closest('.filters');if(!filters||$('obsAreaFilter'))return;
    const areaLabel=document.createElement('label');areaLabel.innerHTML='Área<select id="obsAreaFilter"><option value="all">Todas</option></select>';
    const respLabel=document.createElement('label');respLabel.innerHTML='Responsable<select id="obsResponsibleFilter"><option value="all">Todos</option></select>';
    filters.insertBefore(areaLabel,filters.firstChild);filters.insertBefore(respLabel,$('obsSearch')?.closest('label')||null);
    $('obsAreaFilter').addEventListener('change',renderObservations);$('obsResponsibleFilter').addEventListener('change',renderObservations);
    const th=$('obsBody')?.closest('table')?.querySelector('thead th:nth-child(2)');if(th)th.textContent='Equipo / punto';
  }
  function populateObservationFilters(){
    ensureObservationFilters();if(!$('obsAreaFilter'))return;
    const oldA=$('obsAreaFilter').value||'all',oldR=$('obsResponsibleFilter').value||'all';
    const obsAreas=new Set((typeof OBS!=='undefined'?OBS:[]).map(x=>machineArea(x.r?.machine_id)?.id).filter(Boolean));
    const areas=S.areas.filter(a=>active(a)||obsAreas.has(a.id)).sort(sort);$('obsAreaFilter').innerHTML='<option value="all">Todas</option>'+areas.map(a=>`<option value="${a.id}">${esc(a.name)}${active(a)?'':' · eliminada'}</option>`).join('');$('obsAreaFilter').value=[...$('obsAreaFilter').options].some(o=>o.value===oldA)?oldA:'all';
    $('obsResponsibleFilter').innerHTML='<option value="all">Todos</option>'+S.profiles.filter(p=>p.role==='responsable').map(p=>`<option value="${p.id}">${esc(p.full_name)}</option>`).join('');$('obsResponsibleFilter').value=[...$('obsResponsibleFilter').options].some(o=>o.value===oldR)?oldR:'all';
  }
  window.renderObservations=function(){
    populateObservationFilters();const st=$('obsStatus').value,q=$('obsSearch').value.trim().toLowerCase(),af=$('obsAreaFilter')?.value||'all',rf=$('obsResponsibleFilter')?.value||'all';
    const rows=(typeof OBS!=='undefined'?OBS:[]).filter(x=>st==='all'||(st==='open'&&!x.a.observation_closed)||(st==='closed'&&x.a.observation_closed)).filter(x=>af==='all'||machineArea(x.r?.machine_id)?.id===af).filter(x=>rf==='all'||x.r?.reviewed_by===rf).filter(x=>{const m=machineById(x.r?.machine_id),u=byId(S.profiles,x.r?.reviewed_by),blob=`${machineArea(x.r?.machine_id)?.name||''} ${m?.name||''} ${answerPointName(x.a)} ${x.a.observation||''} ${u?.full_name||''}`.toLowerCase();return!q||blob.includes(q)});
    $('obsBody').innerHTML=rows.map(x=>{const m=machineById(x.r?.machine_id),u=byId(S.profiles,x.r?.reviewed_by),a=machineArea(x.r?.machine_id);return`<tr><td>${esc(x.r?.work_date||'')} · T${x.r?.shift||''}</td><td><b>${esc(m?.name||'-')}</b><small class="curation-cell-sub">${esc(a?.name||'-')}</small></td><td>${esc(answerPointName(x.a))}</td><td><span class="badge ${statusClass(x.a.status)}">${statusLabel(x.a.status)}</span></td><td>${esc(x.a.observation)}</td><td>${esc(u?.full_name||'-')}</td><td>${x.a.observation_closed?`<span class="badge ok">Solucionada</span><div>${esc(x.a.solution||'')}</div><button class="btn light sm" onclick="resolveObs('${x.a.id}',false)">Reabrir</button>`:`<textarea id="sol_${x.a.id}" placeholder="Acción correctiva"></textarea><button class="btn dark sm" onclick="resolveObs('${x.a.id}',true)">Solucionar</button>`}</td></tr>`}).join('')||'<tr><td colspan="7">No hay observaciones con este filtro.</td></tr>';
  };
  ensureObservationFilters();

  /* ---------- Runtime integrity helpers for curation ---------- */
  PV7.curationAudit=function(){
    const f=currentFilters(),scope=strictScope(),allowed=new Set(scope.reviews.map(r=>r.id));
    return{
      evidence_scope_ok:(S.dashboardPhotos||[]).every(p=>allowed.has(p.review_id)),
      inactive_parent_leaks:effectiveMachines().filter(m=>!isEffectiveArea(machineArea(m.id))||!isEffectiveModule(moduleById(m.module_id))).length,
      dashboard_area:f.area,
      dashboard_responsible:f.resp,
      dashboard_shift:f.shift
    };
  };
})();
