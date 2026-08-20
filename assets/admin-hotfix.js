// Production auth/admin hotfix: robust session switching and user-password handling.
(function(){
  const PROJECT_REF='rigokcnzxezsziibxkak';

  async function freshSession(){
    let {data:{session},error}=await db.auth.getSession();
    if(error) throw error;
    if(!session) throw new Error('Sesión vencida. Salga e ingrese nuevamente.');
    const expiresMs=Number(session.expires_at||0)*1000;
    if(!expiresMs || expiresMs-Date.now()<120000){
      const refreshed=await db.auth.refreshSession();
      if(refreshed.error||!refreshed.data.session) throw new Error('Sesión vencida. Salga e ingrese nuevamente.');
      session=refreshed.data.session;
    }
    return session;
  }

  // Always pass a fresh access token to the protected user-management function.
  invokeAdmin=async function(body){
    const session=await freshSession();
    const {data,error}=await db.functions.invoke('admin-users',{
      body,
      headers:{Authorization:`Bearer ${session.access_token}`}
    });
    if(error){
      let detail='';
      try{
        if(error.context&&typeof error.context.json==='function'){
          const payload=await error.context.json();
          detail=payload?.error||payload?.message||'';
        }
      }catch(_e){}
      throw new Error(detail||error.message||'No se pudo administrar el usuario.');
    }
    if(data?.error) throw new Error(data.error);
    return data;
  };

  function clearProjectAuthStorage(){
    try{
      const prefix=`sb-${PROJECT_REF}-auth-token`;
      Object.keys(localStorage).filter(k=>k.startsWith(prefix)).forEach(k=>localStorage.removeItem(k));
    }catch(_e){}
    try{
      Object.keys(sessionStorage).filter(k=>k.includes(PROJECT_REF)&&k.includes('auth')).forEach(k=>sessionStorage.removeItem(k));
    }catch(_e){}
  }

  async function robustLogout(ev){
    if(ev){ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();}
    const btn=document.getElementById('logoutBtn');
    if(btn){btn.disabled=true;btn.textContent='Saliendo…';}
    try{ await db.auth.signOut({scope:'local'}); }catch(_e){}
    clearProjectAuthStorage();
    try{S.session=null;S.profile=null;}catch(_e){}
    try{showLogin();}catch(_e){location.replace(location.origin+location.pathname);return;}
    const pass=document.getElementById('loginPass');
    const user=document.getElementById('loginUser');
    if(pass) pass.value='';
    if(user){user.value='';setTimeout(()=>user.focus(),0);}
    if(btn){btn.disabled=false;btn.textContent='Salir';}
  }

  // Capture phase prevents the older async logout handler from running afterward.
  const logoutBtn=document.getElementById('logoutBtn');
  if(logoutBtn) logoutBtn.addEventListener('click',robustLogout,true);
  window.logout=robustLogout;

  // Keep Chrome/password managers from treating admin-created credentials as the manager login.
  function normalizePasswordInputs(root=document){
    root.querySelectorAll?.('input[type="password"]').forEach(input=>{
      if(input.id==='loginPass'){
        input.setAttribute('autocomplete','current-password');
      }else{
        input.setAttribute('autocomplete','new-password');
        input.setAttribute('autocapitalize','none');
        input.setAttribute('spellcheck','false');
        input.setAttribute('data-lpignore','true');
        input.setAttribute('data-1p-ignore','true');
      }
    });
  }
  normalizePasswordInputs();
  new MutationObserver(mutations=>{
    for(const m of mutations){
      for(const n of m.addedNodes){ if(n.nodeType===1) normalizePasswordInputs(n); }
    }
  }).observe(document.body,{childList:true,subtree:true});
})();
