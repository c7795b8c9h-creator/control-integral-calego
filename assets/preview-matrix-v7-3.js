'use strict';
(function(){
  let showArchived=false;
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const sort=(a,b)=>(a.sort_order||0)-(b.sort_order||0)||String(a.name||a.label||'').localeCompare(String(b.name||b.label||''),'es');
  const slug=s=>String(s||'area').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28)||'area';
  const prefix=s=>String(s||'LIN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4)||'LIN';

  function areaModules(id){return S.modules.filter(m=>m.area_id===id&&!m.is_mold_control).sort(sort)}
  function moduleMachines(id){return S.machines.filter(m=>m.module_id===id).sort(sort)}
  function moduleItems(id){return S.items.filter(i=>i.module_id===id).sort(sort)}
  function countArea(a){const mods=areaModules(a.id),mids=new Set(mods.map(m=>m.id));return{mods:mods.filter(active).length,machines:S.machines.filter(m=>mids.has(m.module_id)&&active(m)).length,items:S.items.filter(i=>mids.has(i.module_id)&&active(i)).length}}
  async function refresh(msg){await loadConfig();renderMatrix();if(msg)toast(msg,'ok')}
  function ask(label,current=''){const v=prompt(label,current);return v==null?null:v.trim()}

  function simpleItemRow(i){return `<div class="mx-row ${active(i)?'':'archived'}"><div class="mx-main"><b>${esc(i.label)}</b><small>${photoLabel(i.photo_mode)}${active(i)?'':' · Eliminado'}</small></div><div class="mx-row-actions">${active(i)?`<button class="btn light sm" onclick="mxEditItem('${i.id}')">Editar</button><select class="mx-photo" onchange="mxPhoto('${i.id}',this.value)"><option value="none" ${i.photo_mode==='none'?'selected':''}>Sin foto</option><option value="optional" ${i.photo_mode==='optional'?'selected':''}>Foto opcional</option><option value="required" ${i.photo_mode==='required'?'selected':''}>Foto obligatoria</option></select><button class="btn light sm" onclick="moveItem('${i.id}',-1)">↑</button><button class="btn light sm" onclick="moveItem('${i.id}',1)">↓</button><button class="btn danger sm" onclick="mxRemoveItem('${i.id}')">Eliminar</button>`:`<button class="btn light sm" onclick="mxRestoreItem('${i.id}')">Restaurar</button>`}</div></div>`}
  function simpleMachineRow(m){return `<div class="mx-row ${active(m)?'':'archived'}"><div class="mx-main"><b>${esc(m.name)}</b><small>${esc(m.code)}${active(m)?'':' · Eliminada'}</small></div><div class="mx-row-actions">${active(m)?`<button class="btn light sm" onclick="mxEditMachine('${m.id}')">Editar</button><button class="btn danger sm" onclick="mxRemoveMachine('${m.id}')">Eliminar</button>`:`<button class="btn light sm" onclick="mxRestoreMachine('${m.id}')">Restaurar</button>`}</div></div>`}
  function simpleModule(m){const machines=moduleMachines(m.id).filter(x=>showArchived||active(x)),items=moduleItems(m.id).filter(x=>showArchived||active(x));return `<details class="mx-line ${active(m)?'':'archived'}" ${active(m)?'open':''}><summary><div><b>${esc(m.name)}</b><small>${moduleMachines(m.id).filter(active).length} máquinas · ${moduleItems(m.id).filter(active).length} preguntas${active(m)?'':' · Eliminada'}</small></div><span>⌄</span></summary><div class="mx-line-body"><div class="mx-line-actions">${active(m)?`<button class="btn light sm" onclick="mxEditModule('${m.id}')">Editar nombre</button><button class="btn primary sm" onclick="mxAddMachine('${m.id}')">+ Máquina</button><button class="btn primary sm" onclick="mxAddItem('${m.id}')">+ Pregunta</button><button class="btn danger sm" onclick="mxRemoveModule('${m.id}')">Eliminar línea</button>`:`<button class="btn light sm" onclick="mxRestoreModule('${m.id}')">Restaurar línea</button>`}</div><div class="mx-two"><section><div class="mx-section-title"><b>Máquinas</b><span>${moduleMachines(m.id).filter(active).length}</span></div>${machines.map(simpleMachineRow).join('')||'<div class="notice">Sin máquinas.</div>'}</section><section><div class="mx-section-title"><b>Preguntas de revisión</b><span>${moduleItems(m.id).filter(active).length}</span></div>${items.map(simpleItemRow).join('')||'<div class="notice">Sin preguntas.</div>'}</section></div></div></details>`}
  function simpleArea(a){const mods=areaModules(a.id).filter(m=>showArchived||active(m)),c=countArea(a);return `<section class="mx-area ${active(a)?'':'archived'}"><header class="mx-area-head"><div><h3>${esc(a.name)}</h3><p>${c.mods} líneas · ${c.machines} máquinas · ${c.items} preguntas${active(a)?'':' · Eliminada'}</p></div><div class="mx-area-actions">${active(a)?`<button class="btn light sm" onclick="mxEditArea('${a.id}')">Editar</button><button class="btn primary sm" onclick="mxAddModule('${a.id}')">+ Línea</button><button class="btn danger sm" onclick="mxRemoveArea('${a.id}')">Eliminar área</button>`:`<button class="btn light sm" onclick="mxRestoreArea('${a.id}')">Restaurar área</button>`}</div></header><div class="mx-lines">${mods.map(simpleModule).join('')||'<div class="notice mx-empty">Esta área no tiene líneas activas.</div>'}</div></section>`}

  window.renderMatrix=function(){
    if(!isManager())return;
    renderRandomSettings();
    const page=$('page-matrix');
    const p=page?.querySelector('.page-head p');if(p)p.textContent='Administre la estructura de forma simple: Área → Línea → Máquinas y preguntas.';
    const add=$('addAreaBtn');if(add)add.textContent='+ Nueva área';
    const areas=S.areas.filter(a=>a.code!=='molds'||S.modules.some(m=>m.area_id===a.id&&!m.is_mold_control)).filter(a=>showArchived||active(a)).sort(sort);
    $('matrixEditor').innerHTML=`<div class="mx-toolbar"><div><b>Estructura operativa</b><small>Los eliminados se ocultan de operación, pero el histórico se conserva.</small></div><button class="btn light sm" onclick="mxToggleArchived()">${showArchived?'Ocultar eliminadas':'Ver eliminadas'}</button></div><div class="mx-area-list">${areas.map(simpleArea).join('')||'<div class="notice">No hay áreas activas.</div>'}</div>`;
  };

  window.mxToggleArchived=()=>{showArchived=!showArchived;renderMatrix()};
  window.mxCreateArea=async()=>{try{const name=ask('Nombre de la nueva área');if(!name)return;const n=Math.max(0,...S.areas.map(a=>Number(a.sort_order)||0))+1;await must(db.from('areas').insert({code:`${slug(name)}-${Date.now().toString().slice(-5)}`,name,active:true,sort_order:n}));await refresh('Área creada.')}catch(e){fail(e,'Área')}};
  window.mxEditArea=async id=>{try{const a=byId(S.areas,id),name=ask('Nombre del área',a?.name||'');if(!name)return;await must(db.from('areas').update({name,updated_at:nowIso()}).eq('id',id));await refresh('Área actualizada.')}catch(e){fail(e,'Área')}};
  window.mxRemoveArea=async id=>{const a=byId(S.areas,id);if(!a||!confirm(`¿Eliminar ${a.name} de la operación?\n\nEl histórico NO se borrará y podrá restaurarla desde “Ver eliminadas”.`))return;try{await must(db.from('areas').update({active:false,updated_at:nowIso()}).eq('id',id));await refresh('Área eliminada de la operación.')}catch(e){fail(e,'Área')}};
  window.mxRestoreArea=async id=>{try{await must(db.from('areas').update({active:true,updated_at:nowIso()}).eq('id',id));await refresh('Área restaurada.')}catch(e){fail(e,'Área')}};

  window.mxAddModule=async areaId=>{try{const name=ask('Nombre de la nueva línea');if(!name)return;const mods=areaModules(areaId),n=Math.max(0,...mods.map(m=>Number(m.sort_order)||0))+1;await must(db.from('modules').insert({area_id:areaId,code:`${slug(name)}-${Date.now().toString().slice(-5)}`,name,prefix:prefix(name),active:true,sort_order:n,is_mold_control:false}));await refresh('Línea creada.')}catch(e){fail(e,'Línea')}};
  window.mxEditModule=async id=>{try{const m=byId(S.modules,id),name=ask('Nombre de la línea',m?.name||'');if(!name)return;await must(db.from('modules').update({name,updated_at:nowIso()}).eq('id',id));await refresh('Línea actualizada.')}catch(e){fail(e,'Línea')}};
  window.mxRemoveModule=async id=>{const m=byId(S.modules,id);if(!m||!confirm(`¿Eliminar la línea ${m.name} de la operación?`))return;try{await must(db.from('modules').update({active:false,updated_at:nowIso()}).eq('id',id));await refresh('Línea eliminada de la operación.')}catch(e){fail(e,'Línea')}};
  window.mxRestoreModule=async id=>{try{await must(db.from('modules').update({active:true,updated_at:nowIso()}).eq('id',id));await refresh('Línea restaurada.')}catch(e){fail(e,'Línea')}};

  window.mxAddMachine=async moduleId=>{try{const m=byId(S.modules,moduleId),name=ask('Nombre de la nueva máquina');if(!name)return;const list=moduleMachines(moduleId),n=Math.max(0,...list.map(x=>Number(x.sort_order)||0))+1;let code=`${m?.prefix||'MAQ'}-${n}`;if(S.machines.some(x=>x.code===code))code=`${m?.prefix||'MAQ'}-${Date.now().toString().slice(-4)}`;await must(db.from('machines').insert({module_id:moduleId,code,name,active:true,sort_order:n}));await refresh('Máquina creada.')}catch(e){fail(e,'Máquina')}};
  window.mxEditMachine=async id=>{try{const m=byId(S.machines,id),name=ask('Nombre de la máquina',m?.name||'');if(!name)return;await must(db.from('machines').update({name,updated_at:nowIso()}).eq('id',id));await refresh('Máquina actualizada.')}catch(e){fail(e,'Máquina')}};
  window.mxRemoveMachine=async id=>{const m=byId(S.machines,id);if(!m||!confirm(`¿Eliminar ${m.name} de la operación?`))return;try{await must(db.from('machines').update({active:false,updated_at:nowIso()}).eq('id',id));await refresh('Máquina eliminada de la operación.')}catch(e){fail(e,'Máquina')}};
  window.mxRestoreMachine=async id=>{try{await must(db.from('machines').update({active:true,updated_at:nowIso()}).eq('id',id));await refresh('Máquina restaurada.')}catch(e){fail(e,'Máquina')}};

  window.mxAddItem=async moduleId=>{try{const label=ask('Escriba la nueva pregunta o punto de revisión');if(!label)return;const list=moduleItems(moduleId),n=Math.max(0,...list.map(x=>Number(x.sort_order)||0))+1;await must(db.from('checklist_items').insert({module_id:moduleId,label,sort_order:n,photo_mode:'optional',active:true}));await refresh('Pregunta agregada.')}catch(e){fail(e,'Pregunta')}};
  window.mxEditItem=async id=>{try{const i=byId(S.items,id),label=ask('Pregunta o punto de revisión',i?.label||'');if(!label)return;await must(db.from('checklist_items').update({label,updated_at:nowIso()}).eq('id',id));await refresh('Pregunta actualizada.')}catch(e){fail(e,'Pregunta')}};
  window.mxPhoto=async(id,mode)=>{try{await must(db.from('checklist_items').update({photo_mode:mode,updated_at:nowIso()}).eq('id',id));const i=byId(S.items,id);if(i)i.photo_mode=mode;toast('Tipo de foto actualizado.','ok')}catch(e){fail(e,'Foto')}};
  window.mxRemoveItem=async id=>{const i=byId(S.items,id);if(!i||!confirm('¿Eliminar esta pregunta de la operación?'))return;try{await must(db.from('checklist_items').update({active:false,updated_at:nowIso()}).eq('id',id));await refresh('Pregunta eliminada.')}catch(e){fail(e,'Pregunta')}};
  window.mxRestoreItem=async id=>{try{await must(db.from('checklist_items').update({active:true,updated_at:nowIso()}).eq('id',id));await refresh('Pregunta restaurada.')}catch(e){fail(e,'Pregunta')}};

  // The original + Área handler remains attached. Capture the click first so only the simple flow runs.
  const addBtn=$('addAreaBtn');if(addBtn)addBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();mxCreateArea()},true);

  // An inactive area must also disappear from dashboard counts, while preserving machine history.
  const priorDashboard=window.renderDashboard;
  if(typeof priorDashboard==='function')window.renderDashboard=function(){const all=S.machines;S.machines=all.filter(m=>{const a=machineArea(m.id);return !a||active(a)});try{return priorDashboard()}finally{S.machines=all}};
})();
