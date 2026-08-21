'use strict';
(function(){
  let selectedArea='all';

  function visibleAreas(){
    return [...document.querySelectorAll('#matrixEditor .mx-area')];
  }

  function areaIdForSection(section,index){
    if(section.dataset.areaId)return section.dataset.areaId;
    const title=section.querySelector('.mx-area-head h3')?.textContent?.trim()||'';
    const candidates=S.areas
      .filter(a=>a.code!=='molds'||S.modules.some(m=>m.area_id===a.id&&!m.is_mold_control))
      .filter(a=>{
        if(section.classList.contains('archived'))return !active(a)&&a.name===title;
        return active(a)&&a.name===title;
      });
    const a=candidates[0]||S.areas.find(a=>a.name===title)||null;
    const id=a?.id||`area-${index}`;
    section.dataset.areaId=id;
    return id;
  }

  function applyAreaFilter(){
    const sections=visibleAreas();
    sections.forEach((section,index)=>{
      const id=areaIdForSection(section,index);
      section.hidden=selectedArea!=='all'&&id!==selectedArea;
    });
    document.querySelectorAll('.mx-area-tab').forEach(btn=>{
      const on=btn.dataset.area===selectedArea;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',on?'true':'false');
    });
    const shown=sections.filter(s=>!s.hidden).length;
    const count=document.querySelector('.mx-area-filter-count');
    if(count)count.textContent=selectedArea==='all'?`${shown} áreas visibles`:'1 área seleccionada';
  }

  function buildAreaTabs(){
    const editor=$('matrixEditor');
    const toolbar=editor?.querySelector('.mx-toolbar');
    if(!toolbar)return;
    editor.querySelector('.mx-area-filter')?.remove();

    const sections=visibleAreas();
    const data=sections.map((section,index)=>{
      const id=areaIdForSection(section,index);
      const name=section.querySelector('.mx-area-head h3')?.textContent?.trim()||'Área';
      return{id,name};
    });
    if(selectedArea!=='all'&&!data.some(x=>x.id===selectedArea))selectedArea='all';

    const bar=document.createElement('div');
    bar.className='mx-area-filter';
    bar.innerHTML=`<div class="mx-area-tabs" role="group" aria-label="Filtrar matriz por área"><button type="button" class="mx-area-tab" data-area="all">Todas</button>${data.map(x=>`<button type="button" class="mx-area-tab" data-area="${esc(x.id)}">${esc(x.name)}</button>`).join('')}</div><small class="mx-area-filter-count"></small>`;
    toolbar.insertAdjacentElement('afterend',bar);
    bar.querySelectorAll('.mx-area-tab').forEach(btn=>btn.addEventListener('click',()=>{selectedArea=btn.dataset.area||'all';applyAreaFilter()}));
    applyAreaFilter();
  }

  const previousRender=window.renderMatrix;
  window.renderMatrix=function(){
    previousRender();
    buildAreaTabs();
  };

  window.mxSelectArea=id=>{selectedArea=id||'all';applyAreaFilter()};
})();
