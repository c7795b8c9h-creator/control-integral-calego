'use strict';
(function(){
  const ML=window.ML=window.ML||{};
  S.machineLinks=S.machineLinks||[];
  let matrixArea='all',showArchivedLinks=false;

  const sort=(a,b)=>(a.sort_order||0)-(b.sort_order||0)||String(a.name||a.label||'').localeCompare(String(b.name||b.label||''),'es');
  const areaById=id=>byId(S.areas,id);
  const moduleById=id=>byId(S.modules,id);
  const machineById=id=>byId(S.machines,id);
  const moduleArea=mid=>areaById(moduleById(mid)?.area_id);
  const effectiveArea=a=>!!a&&active(a)&&a.code!=='molds';
  const effectiveModule=m=>!!m&&active(m)&&!m.is_mold_control&&effectiveArea(moduleArea(m.id));
  const linkActive=l=>l?.active!==false;
  const moduleLinks=(mid,includeInactive=false)=>(S.machineLinks||[]).filter(l=>l.module_id===mid&&(includeInactive||linkActive(l))).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const machineLinks=(machineId,includeInactive=false)=>(S.machineLinks||[]).filter(l=>l.machine_id===machineId&&(includeInactive||linkActive(l)));
  const isLinked=(machineId,moduleId)=>machineLinks(machineId).some(l=>l.module_id===moduleId);
  const activeTargets=()=>S.machineLinks.filter(l=>linkActive(l)).map(l=>({link:l,machine:machineById(l.machine_id),module:moduleById(l.module_id)})).filter(x=>active(x.machine)&&effectiveModule(x.module));
  const targetKey=(machineId,moduleId)=>machineId+'|'+moduleId;

  ML.moduleLinks=moduleLinks;
  ML.machineLinks=machineLinks;
  ML.isLinked=isLinked;
  ML.activeTargets=activeTargets;

  const previousLoadConfig=loadConfig;
  loadConfig=window.loadConfig=async function(){
    await previousLoadConfig();
    try{
      S.machineLinks=await must(db.from('machine_module_links').select('*').order('sort_order'));
    }catch(e){
      S.machineLinks=S.machines.map(m=>({machine_id:m.id,module_id:m.module_id,active:m.active,sort_order:m.sort_order}));
      console.error('machine_module_links fallback',e);
    }
  };

  machinesForModule=window.machinesForModule=function(moduleId){
    const mod=moduleById(moduleId);if(!effectiveModule(mod)&&!mod?.is_mold_control)return[];
    const ids=new Set(moduleLinks(moduleId).map(l=>l.machine_id));
    return S.machines.filter(m=>ids.has(m.id)&&active(m)).sort(sort);
  };

  const previousFindReview=findReview;
  findReview=window.findReview=async function(kind,machineId,moduleId=null){
    let q=db.from('review_sessions').select('*')
      .eq('kind',kind).eq('work_date',workDate()).eq('shift',shift())
      .eq('machine_id',machineId).eq('reviewed_by',S.profile.id);
    if(moduleId)q=q.eq('module_id',moduleId);
    const rows=await must(q.order('started_at',{ascending:false}).limit(1));
    return rows?.[0]||null;
  };

  beginChecklist=window.beginChecklist=async function(moduleId,machineId){
    const mod=moduleById(moduleId),machine=machineById(machineId);
    if(!mod||!machine)throw new Error('Seleccione una línea y equipo.');
    if(!isLinked(machineId,moduleId))throw new Error('Este equipo no está vinculado a la línea seleccionada.');
    let r=await findReview('checklist',machineId,moduleId);
    if(!r)r=await createReview('checklist',machineId,moduleId,null);
    S.review=r;S.point=0;S.pointSeenAt=Date.now();
    await loadReviewData(r,false);
    if(S.random.enabled){
      const {data,error}=await db.rpc('ensure_random_checklist_assignments',{p_module_id:moduleId,p_work_date:workDate(),p_shift:shift()});
      if(error)throw error;
      S.randomAssignments=(data||[]).filter(x=>x.machine_id===machineId);
    }else S.randomAssignments=[];
    renderCheckFlow();return r;
  };

  const oldValidateQrText=validateQrText;
  validateQrText=window.validateQrText=async function(text,method){
    if(S.page==='molds')return oldValidateQrText(text,method);
    const q=parseQr(text);
    if(!q)return toast('Código QR no reconocido.','bad');
    if(S.qrContext?.machineCode&&q.code.toUpperCase()!==S.qrContext.machineCode.toUpperCase())return toast('Este QR corresponde a otro equipo.','bad');
    try{
      const machine=S.machines.find(m=>String(m.code).toUpperCase()===q.code.toUpperCase());
      if(!machine)throw new Error('Equipo no encontrado.');
      let moduleId=S.review?.module_id||$('moduleSelect')?.value||null;
      const autoStart=!!S.qrContext?.autoStartChecklist;
      if(autoStart&&!S.review){
        const permitted=new Set(S.modulePerms);
        const candidates=machineLinks(machine.id).map(l=>moduleById(l.module_id)).filter(m=>effectiveModule(m)&&permitted.has(m.id));
        const selected=$('moduleSelect')?.value;
        if(selected&&candidates.some(m=>m.id===selected))moduleId=selected;
        else if(candidates.length===1)moduleId=candidates[0].id;
        else if(candidates.length>1)throw new Error('Este equipo tiene varias líneas de revisión. Seleccione Área y Línea antes de escanear.');
        else throw new Error('No tiene una línea habilitada para este equipo.');
      }
      if(!moduleId)throw new Error('Seleccione primero la línea que va a revisar.');
      const {data,error}=await db.rpc('validate_machine_qr_v2',{
        p_machine_code:q.code,p_token:q.token,p_work_date:workDate(),p_shift:shift(),p_module_id:moduleId,
        p_method:method,p_device:navigator.userAgent.slice(0,450)
      });
      if(error)throw error;
      stopQrScanner();$('qrDialog').close();toast('QR validado.','ok');
      if(autoStart){
        const mod=moduleById(moduleId),area=moduleArea(moduleId);
        if(area){$('areaSelect').value=area.id;fillModuleSelect();$('moduleSelect').value=moduleId;fillMachineSelect();$('machineSelect').value=machine.id}
        await beginChecklist(moduleId,machine.id);return;
      }
      if(S.review&&S.review.machine_id===data.machine_id&&S.review.module_id===moduleId){
        S.review=(await findReview('checklist',data.machine_id,moduleId))||S.review;renderCheckFlow();
      }
    }catch(e){fail(e,'QR inválido')}
  };

  function ensureLinkDialog(){
    let d=$('machineLinkDialog');if(d)return d;
    d=document.createElement('dialog');d.id='machineLinkDialog';d.className='modal-dialog small-dialog';
    d.innerHTML='<form method="dialog" class="dialog-head"><strong>Vincular equipo existente</strong><button class="icon-btn">✕</button></form><p class="notice">El equipo conserva su mismo código y su mismo QR. Solo se agrega esta línea como nueva ruta de revisión.</p><label>Equipo físico<select id="machineLinkSelect"></select></label><div id="machineLinkInfo" class="notice"></div><button id="machineLinkConfirm" class="btn primary full" type="button">Vincular equipo</button>';
    document.body.appendChild(d);
    $('machineLinkConfirm').addEventListener('click',async()=>{
      const moduleId=d.dataset.moduleId,machineId=$('machineLinkSelect').value;if(!moduleId||!machineId)return;
      try{
        const n=moduleLinks(moduleId,true).length+1;
        await must(db.from('machine_module_links').upsert({machine_id:machineId,module_id:moduleId,active:true,sort_order:n,updated_at:nowIso()}));
        d.close();await refreshMatrix('Equipo vinculado. Se reutiliza el QR existente.');
      }catch(e){fail(e,'Vínculo')}
    });
    return d;
  }

  async function refreshMatrix(msg){await loadConfig();renderMatrix();if(msg)toast(msg,'ok')}
  const promptText=(label,current='')=>{const v=prompt(label,current);return v==null?null:v.trim()};
  const areaModules=id=>S.modules.filter(m=>m.area_id===id&&!m.is_mold_control).sort(sort);
  const moduleItems=id=>S.items.filter(i=>i.module_id===id).sort(sort);
  const linkedRows=(moduleId)=>moduleLinks(moduleId,true).map(l=>({link:l,machine:machineById(l.machine_id)})).filter(x=>x.machine).sort((a,b)=>sort(a.machine,b.machine));

  function machineRow(moduleId,x){
    const m=x.machine,l=x.link,shared=machineLinks(m.id).filter(y=>effectiveModule(moduleById(y.module_id))).length;
    const visible=active(m)&&linkActive(l);
    if(!showArchivedLinks&&!visible)return'';
    return '<div class="mx-row '+(visible?'':'archived')+'"><div class="mx-main"><b>'+esc(m.name)+'</b><small>'+esc(m.code)+' · QR único'+(shared>1?' · '+shared+' líneas vinculadas':'')+(visible?'':' · Fuera de esta línea')+'</small></div><div class="mx-row-actions">'+(visible?'<button class="btn light sm" onclick="mxEditPhysicalMachine(\''+m.id+'\')">Editar equipo</button><button class="btn danger sm" onclick="mxUnlinkMachine(\''+moduleId+'\',\''+m.id+'\')">'+(shared>1?'Desvincular':'Retirar equipo')+'</button>':'<button class="btn light sm" onclick="mxRestoreMachineLink(\''+moduleId+'\',\''+m.id+'\')">Restaurar</button>')+'</div></div>';
  }

  function itemRow(i){
    if(!showArchivedLinks&&!active(i))return'';
    return '<div class="mx-row '+(active(i)?'':'archived')+'"><div class="mx-main"><b>'+esc(i.label)+'</b><small>'+photoLabel(i.photo_mode)+(active(i)?'':' · Eliminada')+'</small></div><div class="mx-row-actions">'+(active(i)?'<button class="btn light sm" onclick="mxEditItem(\''+i.id+'\')">Editar</button><select class="mx-photo" onchange="mxPhoto(\''+i.id+'\',this.value)"><option value="none" '+(i.photo_mode==='none'?'selected':'')+'>Sin foto</option><option value="optional" '+(i.photo_mode==='optional'?'selected':'')+'>Foto opcional</option><option value="required" '+(i.photo_mode==='required'?'selected':'')+'>Foto obligatoria</option></select><button class="btn light sm" onclick="moveItem(\''+i.id+'\',-1)">↑</button><button class="btn light sm" onclick="moveItem(\''+i.id+'\',1)">↓</button><button class="btn danger sm" onclick="mxRemoveItem(\''+i.id+'\')">Eliminar</button>':'<button class="btn light sm" onclick="mxRestoreItem(\''+i.id+'\')">Restaurar</button>')+'</div></div>';
  }

  function moduleHtml(mod){
    const links=linkedRows(mod.id),items=moduleItems(mod.id);
    const visibleLinks=links.filter(x=>showArchivedLinks||(active(x.machine)&&linkActive(x.link)));
    const visibleItems=items.filter(x=>showArchivedLinks||active(x));
    if(!showArchivedLinks&&!active(mod))return'';
    return '<details class="mx-line '+(active(mod)?'':'archived')+'" '+(active(mod)?'open':'')+'><summary><div><b>'+esc(mod.name)+'</b><small>'+links.filter(x=>active(x.machine)&&linkActive(x.link)).length+' equipos vinculados · '+items.filter(active).length+' preguntas'+(active(mod)?'':' · Eliminada')+'</small></div><span>⌄</span></summary><div class="mx-line-body"><div class="mx-line-actions">'+(active(mod)?'<button class="btn light sm" onclick="mxEditModule(\''+mod.id+'\')">Editar nombre</button><button class="btn primary sm" onclick="mxOpenLinkMachine(\''+mod.id+'\')">+ Vincular existente</button><button class="btn primary sm" onclick="mxCreatePhysicalMachine(\''+mod.id+'\')">+ Crear equipo nuevo</button><button class="btn primary sm" onclick="mxAddItem(\''+mod.id+'\')">+ Pregunta</button><button class="btn danger sm" onclick="mxRemoveModule(\''+mod.id+'\')">Eliminar línea</button>':'<button class="btn light sm" onclick="mxRestoreModule(\''+mod.id+'\')">Restaurar línea</button>')+'</div><div class="mx-two"><section><div class="mx-section-title"><b>Equipos para revisar</b><span>'+visibleLinks.length+'</span></div>'+visibleLinks.map(x=>machineRow(mod.id,x)).join('')+(visibleLinks.length?'':'<div class="notice">Sin equipos vinculados.</div>')+'</section><section><div class="mx-section-title"><b>Preguntas de revisión</b><span>'+visibleItems.length+'</span></div>'+visibleItems.map(itemRow).join('')+(visibleItems.length?'':'<div class="notice">Sin preguntas.</div>')+'</section></div></div></details>';
  }

  function areaHtml(a){
    const mods=areaModules(a.id).filter(m=>showArchivedLinks||active(m));
    const links=mods.flatMap(m=>moduleLinks(m.id)).filter(linkActive);
    const physical=new Set(links.map(l=>l.machine_id).filter(id=>active(machineById(id))));
    const items=mods.flatMap(m=>moduleItems(m.id)).filter(active).length;
    if(!showArchivedLinks&&!active(a))return'';
    return '<section class="mx-area '+(active(a)?'':'archived')+'" data-area-id="'+a.id+'" '+(matrixArea!=='all'&&matrixArea!==a.id?'hidden':'')+'><header class="mx-area-head"><div><h3>'+esc(a.name)+'</h3><p>'+mods.filter(active).length+' líneas · '+physical.size+' equipos físicos · '+links.length+' vínculos de revisión · '+items+' preguntas</p></div><div class="mx-area-actions">'+(active(a)?'<button class="btn light sm" onclick="mxEditArea(\''+a.id+'\')">Editar</button><button class="btn primary sm" onclick="mxAddModule(\''+a.id+'\')">+ Línea</button><button class="btn danger sm" onclick="mxRemoveArea(\''+a.id+'\')">Eliminar área</button>':'<button class="btn light sm" onclick="mxRestoreArea(\''+a.id+'\')">Restaurar área</button>')+'</div></header><div class="mx-lines">'+mods.map(moduleHtml).join('')+'</div></section>';
  }

  renderMatrix=window.renderMatrix=function(){
    if(!isManager())return;
    renderRandomSettings();
    const areas=S.areas.filter(a=>a.code!=='molds').filter(a=>showArchivedLinks||active(a)).sort(sort);
    if(matrixArea!=='all'&&!areas.some(a=>a.id===matrixArea))matrixArea='all';
    $('matrixEditor').innerHTML='<div class="mx-toolbar"><div><b>Catálogo único de equipos</b><small>Un equipo físico = un código = un QR. Las áreas solo crean vínculos de revisión.</small></div><button class="btn light sm" onclick="mxToggleArchivedLinks()">'+(showArchivedLinks?'Ocultar eliminados':'Ver eliminados')+'</button></div><div class="mx-area-filter"><div class="mx-area-tabs"><button class="mx-area-tab '+(matrixArea==='all'?'active':'')+'" onclick="mxSelectLinkedArea(\'all\')">Todas</button>'+areas.map(a=>'<button class="mx-area-tab '+(matrixArea===a.id?'active':'')+'" onclick="mxSelectLinkedArea(\''+a.id+'\')">'+esc(a.name)+'</button>').join('')+'</div></div><div class="mx-area-list">'+areas.map(areaHtml).join('')+'</div>';
  };

  window.mxToggleArchivedLinks=()=>{showArchivedLinks=!showArchivedLinks;renderMatrix()};
  window.mxSelectLinkedArea=id=>{matrixArea=id||'all';renderMatrix()};
  window.mxOpenLinkMachine=moduleId=>{
    const d=ensureLinkDialog(),already=new Set(moduleLinks(moduleId).map(l=>l.machine_id));
    const options=S.machines.filter(m=>active(m)&&!already.has(m.id)).sort(sort);
    if(!options.length)return toast('No hay equipos disponibles para vincular.','bad');
    d.dataset.moduleId=moduleId;
    $('machineLinkSelect').innerHTML=options.map(m=>'<option value="'+m.id+'">'+esc(m.code)+' · '+esc(m.name)+'</option>').join('');
    $('machineLinkInfo').textContent='No se crea otro QR.';
    d.showModal();
  };

  window.mxCreatePhysicalMachine=async moduleId=>{
    try{
      const mod=moduleById(moduleId),name=promptText('Nombre del equipo nuevo');if(!name)return;
      const prefix=String(mod?.prefix||'EQ').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5)||'EQ';
      let n=1,code=prefix+'-'+n;while(S.machines.some(m=>String(m.code).toUpperCase()===code)){n++;code=prefix+'-'+n}
      const machine=await must(db.from('machines').insert({module_id:moduleId,code,name,active:true,sort_order:n}).select('*').single());
      await must(db.from('machine_module_links').insert({machine_id:machine.id,module_id:moduleId,active:true,sort_order:n}));
      await refreshMatrix('Equipo físico creado con un único QR.');
    }catch(e){fail(e,'Equipo')}
  };

  window.mxEditPhysicalMachine=async machineId=>{
    try{const m=machineById(machineId),name=promptText('Nombre del equipo físico',m?.name||'');if(!name)return;await must(db.from('machines').update({name,updated_at:nowIso()}).eq('id',machineId));await refreshMatrix('Equipo actualizado en todas las áreas vinculadas.')}catch(e){fail(e,'Equipo')}
  };

  window.mxUnlinkMachine=async(moduleId,machineId)=>{
    const m=machineById(machineId),links=machineLinks(machineId);
    if(links.length<=1){
      if(!confirm('Este es el único vínculo de '+(m?.name||'este equipo')+'. ¿Retirarlo de la operación y desactivar su QR?'))return;
      try{
        await must(db.from('machine_module_links').update({active:false,updated_at:nowIso()}).eq('machine_id',machineId).eq('module_id',moduleId));
        await must(db.from('machines').update({active:false,updated_at:nowIso()}).eq('id',machineId));
        await refreshMatrix('Equipo retirado de la operación.');
      }catch(e){fail(e,'Equipo')}
    }else{
      if(!confirm('¿Desvincular '+(m?.name||'el equipo')+' de esta línea? El equipo y su QR seguirán activos en las demás áreas.'))return;
      try{await must(db.from('machine_module_links').update({active:false,updated_at:nowIso()}).eq('machine_id',machineId).eq('module_id',moduleId));await refreshMatrix('Equipo desvinculado.')}catch(e){fail(e,'Vínculo')}
    }
  };

  window.mxRestoreMachineLink=async(moduleId,machineId)=>{
    try{
      await must(db.from('machines').update({active:true,updated_at:nowIso()}).eq('id',machineId));
      await must(db.from('machine_module_links').upsert({machine_id:machineId,module_id:moduleId,active:true,updated_at:nowIso()}));
      await refreshMatrix('Equipo restaurado.');
    }catch(e){fail(e,'Equipo')}
  };

  const userModuleIds=userId=>new Set(S.allModulePerms.filter(x=>x.user_id===userId).map(x=>x.module_id));
  const selectedShift=()=>$('dashboardShiftFilter')?.value||'all';
  const shiftMatches=(r,s)=>s==='all'||Number(r.shift)===Number(s);
  const filters=()=>({area:$('dashboardArea')?.value||'all',resp:$('dashboardResponsible')?.value||'all',shift:selectedShift()});

  function ensureShiftFilter(){
    if($('dashboardShiftFilter'))return;
    const root=$('dashboardArea')?.closest('.filters');if(!root)return;
    const label=document.createElement('label');
    label.innerHTML='Turno<select id="dashboardShiftFilter"><option value="all">Todos los turnos</option><option value="1">Turno 1</option><option value="2">Turno 2</option><option value="3">Turno 3</option></select>';
    const resp=$('dashboardResponsible')?.closest('label');if(resp)root.insertBefore(label,resp);else root.appendChild(label);
    $('dashboardShiftFilter').addEventListener('change',()=>{renderDashboard();renderEvidenceDashboard()});
  }

  function targetsFor(areaId='all',respId='all'){
    const mids=respId==='all'?null:userModuleIds(respId);
    return activeTargets().filter(t=>(areaId==='all'||t.module.area_id===areaId)&&(!mids||mids.has(t.module.id)));
  }

  function moduleIdForRandom(x){
    if(x.checklist_item_id)return byId(S.items,x.checklist_item_id)?.module_id||null;
    if(x.scope==='module')return x.scope_id;
    return null;
  }

  function strictScope(){
    const D=S.dashboard||{reviews:[],answers:[],random:[],historyReviews:[],historyAnswers:[]},f=filters();
    const keepReview=r=>{
      const mod=moduleById(r.module_id);
      return !!mod&&effectiveModule(mod)&&(f.area==='all'||mod.area_id===f.area)&&(f.resp==='all'||r.reviewed_by===f.resp)&&shiftMatches(r,f.shift);
    };
    const reviews=(D.reviews||[]).filter(keepReview),ids=new Set(reviews.map(r=>r.id));
    const historyReviews=(D.historyReviews||[]).filter(keepReview),hids=new Set(historyReviews.map(r=>r.id));
    const random=(D.random||[]).filter(x=>{
      const mid=moduleIdForRandom(x),mod=moduleById(mid);
      return !!mod&&(f.area==='all'||mod.area_id===f.area)&&(f.resp==='all'||x.responsible_id===f.resp)&&shiftMatches(x,f.shift);
    });
    return{reviews,answers:(D.answers||[]).filter(a=>ids.has(a.review_id)),random,historyReviews,historyAnswers:(D.historyAnswers||[]).filter(a=>hids.has(a.review_id))};
  }
  window.PV7=window.PV7||{};PV7.strictDashboardScope=strictScope;

  function populateFilters(){
    const areaEl=$('dashboardArea'),respEl=$('dashboardResponsible');if(!areaEl||!respEl)return;
    const oldA=areaEl.value||'all',oldR=respEl.value||'all';
    const areas=S.areas.filter(effectiveArea).sort(sort);
    areaEl.innerHTML='<option value="all">Todas</option>'+areas.map(a=>'<option value="'+a.id+'">'+esc(a.name)+'</option>').join('');
    areaEl.value=[...areaEl.options].some(o=>o.value===oldA)?oldA:'all';
    const area=areaEl.value;
    const people=S.profiles.filter(p=>p.role==='responsable'&&p.active).filter(p=>area==='all'||targetsFor(area,p.id).length);
    respEl.innerHTML='<option value="all">Todos</option>'+people.map(p=>'<option value="'+p.id+'">'+esc(p.full_name)+'</option>').join('');
    respEl.value=[...respEl.options].some(o=>o.value===oldR)?oldR:'all';
  }

  function roundState(target,t,reviews,answers){
    const rows=reviews.filter(r=>r.kind==='checklist'&&r.machine_id===target.machine.id&&r.module_id===target.module.id&&Number(r.shift)===Number(t)).sort((a,b)=>String(b.closed_at||b.started_at).localeCompare(String(a.closed_at||a.started_at)));
    const r=rows[0];if(!r)return{cls:'pending',label:'Pendiente',detail:'Sin ronda'};
    const aa=answers.filter(a=>a.review_id===r.id),fails=aa.filter(a=>a.status==='no').length,u=byId(S.profiles,r.reviewed_by);
    return{cls:fails?'bad':r.status==='closed'?'ok':'progress',label:fails?fails+' falla(s)':r.status==='closed'?'Cerrada':'En curso',detail:u?.full_name||''};
  }

  function splitCard(done,expected){
    return '<div class="round-shift-split">'+[1,2,3].map(t=>'<div class="round-shift-card"><span>T'+t+'</span><b>'+done[t]+'/'+expected+'</b><small>'+(expected?Math.round(done[t]*100/expected):0)+'% cobertura</small></div>').join('')+'</div>';
  }

  function renderCoverage(targets,reviews,answers,s){
    const el=$('shiftMatrix');if(!el)return;
    const turns=s==='all'?[1,2,3]:[Number(s)];
    const areaIds=[...new Set(targets.map(t=>t.module.area_id))];
    el.innerHTML=areaIds.map(aid=>{
      const a=areaById(aid),mods=[...new Set(targets.filter(t=>t.module.area_id===aid).map(t=>t.module.id))].map(moduleById).filter(Boolean).sort(sort);
      return '<section class="business-section"><div class="business-title"><b>'+esc(a?.name||'Área')+'</b><span>'+new Set(targets.filter(t=>t.module.area_id===aid).map(t=>t.machine.id)).size+' equipos físicos</span></div>'+mods.map(mod=>{
        const rows=targets.filter(t=>t.module.id===mod.id);
        return '<div class="machine-subgroup"><div class="subgroup-title">'+esc(mod.name)+' <span>'+rows.length+' vínculos</span></div><div class="machine-grid">'+rows.map(target=>'<article class="machine-card"><div class="machine-name"><b>'+esc(target.machine.name)+'</b><small>'+esc(target.machine.code)+' · QR único</small></div><div class="shift-pills '+(s==='all'?'':'single-shift')+'">'+turns.map(t=>{const x=roundState(target,t,reviews,answers);return'<div class="shift-pill '+x.cls+'"><span>T'+t+'</span><b>'+esc(x.label)+'</b><small>'+esc(x.detail)+'</small></div>'}).join('')+'</div></article>').join('')+'</div></div>';
      }).join('')+'</section>';
    }).join('')||'<div class="notice">No hay equipos vinculados con este filtro.</div>';
  }

  function renderResponsible(targets,reviews,answers,f){
    const el=$('responsibleTable');if(!el)return;
    const people=S.profiles.filter(p=>p.role==='responsable'&&p.active&&(f.resp==='all'||p.id===f.resp));
    el.innerHTML='<div class="decision-list">'+people.map(p=>{
      const pt=targetsFor(f.area,p.id),rr=reviews.filter(r=>r.reviewed_by===p.id&&r.kind==='checklist');
      if(!pt.length&&!rr.length&&f.resp==='all')return'';
      const expected=pt.length,done={1:0,2:0,3:0};
      [1,2,3].forEach(t=>done[t]=new Set(rr.filter(r=>r.status==='closed'&&Number(r.shift)===t).map(r=>targetKey(r.machine_id,r.module_id))).size);
      const ids=new Set(rr.map(r=>r.id)),aa=answers.filter(a=>ids.has(a.review_id)),fail=aa.filter(a=>a.status==='no').length,open=aa.filter(a=>(a.status==='no'||a.status==='na')&&a.observation&&!a.observation_closed).length;
      return '<article class="decision-card"><div class="decision-head"><b>'+esc(p.full_name)+'</b><span class="badge blue">Por turno</span></div>'+splitCard(done,expected)+'<div class="decision-foot"><span class="badge '+(fail?'bad':'ok')+'">'+fail+' falla(s)</span> <span class="badge '+(open?'warn':'ok')+'">'+open+' abierta(s)</span> <small>'+expected+' puntos de revisión</small></div></article>';
    }).join('')+'</div>';
  }

  renderDashboard=window.renderDashboard=function(){
    if(!S.dashboard)return;
    ensureShiftFilter();populateFilters();
    const f=filters(),targets=targetsFor(f.area,f.resp),scope=strictScope(),reviews=scope.reviews,answers=scope.answers;
    const physical=new Set(targets.map(t=>t.machine.id)).size,expected=targets.length,done={1:0,2:0,3:0};
    [1,2,3].forEach(t=>done[t]=new Set(reviews.filter(r=>r.kind==='checklist'&&r.status==='closed'&&Number(r.shift)===t).map(r=>targetKey(r.machine_id,r.module_id))).size);
    const open=scope.historyAnswers.filter(a=>(a.status==='no'||a.status==='na')&&a.observation&&!a.observation_closed).length;
    const failures=answers.filter(a=>a.status==='no').length;
    const randomDone=scope.random.filter(x=>x.fulfilled).length;
    $('dashboardKpis').innerHTML='<div class="kpi"><b>'+physical+'</b><span>Equipos físicos</span><small>Sin duplicarlos entre áreas</small></div><div class="kpi"><b>'+expected+'</b><span>Puntos de revisión</span><small>Equipo × línea vinculada</small></div><div class="kpi round-split-kpi"><span>Rondas por turno</span>'+splitCard(done,expected)+'<small>No se suman T1+T2+T3 en un número gigante.</small></div><div class="kpi '+(failures?'bad':'ok')+'"><b>'+failures+'</b><span>Fallas del filtro</span></div><div class="kpi '+(open?'warn':'ok')+'"><b>'+open+'</b><span>Hallazgos abiertos</span><small>'+randomDone+'/'+scope.random.length+' fotos aleatorias cumplidas</small></div>';
    renderResponsible(targets,reviews,answers,f);
    const priority=$('priorityList');
    if(priority){
      const closed=new Set(reviews.filter(r=>r.kind==='checklist'&&r.status==='closed').map(r=>targetKey(r.machine_id,r.module_id)+'|'+r.shift)),turns=f.shift==='all'?[1,2,3]:[Number(f.shift)],actions=[];
      targets.forEach(t=>turns.forEach(sh=>{if(!closed.has(targetKey(t.machine.id,t.module.id)+'|'+sh))actions.push({title:t.machine.name+' · '+t.module.name+' · T'+sh,text:'Ronda pendiente.'})}));
      priority.innerHTML=actions.slice(0,12).map(x=>'<div class="priority-item medium"><strong>'+esc(x.title)+'</strong><span>'+esc(x.text)+'</span></div>').join('')||'<div class="notice">Sin rondas pendientes con este filtro.</div>';
    }
    renderCoverage(targets,reviews,answers,f.shift);
    const molds=reviews.filter(r=>r.kind==='mold');if(typeof renderMoldDashboard==='function')renderMoldDashboard(molds,answers);
    let banner=document.querySelector('.dashboard-filter-context');if(!banner){banner=document.createElement('div');banner.className='dashboard-filter-context';$('dashboardArea')?.closest('.filters')?.insertAdjacentElement('afterend',banner)}
    if(banner)banner.innerHTML='<b>Mostrando:</b> '+esc(f.area==='all'?'Todas las áreas':areaById(f.area)?.name||'Área')+' · '+esc(f.resp==='all'?'Todos los responsables':byId(S.profiles,f.resp)?.full_name||'Responsable')+' · '+esc(f.shift==='all'?'Todos los turnos':'Turno '+f.shift);
  };

  renderEvidenceDashboard=window.renderEvidenceDashboard=async function(){
    const el=$('evidenceDashboard');if(!el||!isManager()||!S.dashboard)return;
    const scope=strictScope(),ids=scope.reviews.map(r=>r.id);
    if(!ids.length){el.innerHTML='<div class="notice">No hay evidencias para el filtro seleccionado.</div>';return}
    try{
      const rows=await must(db.from('photo_evidence').select('*').in('review_id',ids).order('taken_at',{ascending:false}).limit(36));
      if(!rows?.length){el.innerHTML='<div class="notice">No hay fotografías para el filtro seleccionado.</div>';return}
      const {data,error}=await db.functions.invoke('evidence',{body:{action:'signed_urls',evidence_ids:rows.map(x=>x.id)}});if(error)throw error;
      const urls=data?.urls||{},reviews=new Map(scope.reviews.map(r=>[r.id,r])),answers=new Map(scope.answers.map(a=>[a.id,a]));
      S.dashboardPhotos=rows;S.evidenceUrls=urls;
      el.innerHTML='<div class="evidence-gallery">'+rows.slice(0,18).map(p=>{const r=reviews.get(p.review_id),m=machineById(r?.machine_id),mod=moduleById(r?.module_id),a=moduleArea(r?.module_id),ans=p.answer_id?answers.get(p.answer_id):null,point=ans?answerPointName(ans):'Foto general',url=urls[p.id]||'';return'<a class="evidence-card" '+(url?'href="'+esc(url)+'" target="_blank" rel="noopener"':'')+'><div class="evidence-thumb">'+(url?'<img loading="lazy" src="'+esc(url)+'" alt="Evidencia">':'<span>Foto</span>')+'</div><b>'+esc(m?.name||'-')+'</b><small>'+esc(a?.name||'-')+' · '+esc(mod?.name||'-')+'</small><small>'+esc(point)+' · T'+(r?.shift||'')+'</small></a>'}).join('')+'</div>';
    }catch(e){el.innerHTML='<div class="notice">No fue posible cargar las evidencias.</div>';console.error(e)}
  };

  openAnalysis=window.openAnalysis=function(){
    const s=strictScope(),open=s.historyAnswers.filter(a=>(a.status==='no'||a.status==='na')&&a.observation&&!a.observation_closed).length,missing=s.random.filter(x=>!x.fulfilled).length;
    $('analysisContent').innerHTML='<div class="priority-item '+(open?'high':'')+'"><strong>'+open+' hallazgo(s) abierto(s)</strong><span>Respeta Área, Responsable, Turno y línea de revisión.</span></div><div class="priority-item '+(missing?'medium':'')+'"><strong>'+missing+' evidencia(s) aleatoria(s) pendiente(s)</strong></div>';
    $('analysisDialog').showModal();
  };
})();