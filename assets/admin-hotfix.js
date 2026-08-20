// Explicitly forward the current Supabase access token to admin-users.
invokeAdmin = async function(body){
  const { data:{ session }, error:sessionError } = await db.auth.getSession();
  if(sessionError || !session?.access_token) throw new Error('Sesión vencida. Cierre sesión e ingrese nuevamente.');
  const { data, error } = await db.functions.invoke('admin-users', {
    body,
    headers:{ Authorization:`Bearer ${session.access_token}` }
  });
  if(error){
    let detail='';
    try{
      if(error.context && typeof error.context.json==='function'){
        const payload=await error.context.json();
        detail=payload?.error||payload?.message||'';
      }
    }catch(_e){}
    throw new Error(detail || error.message || 'No se pudo administrar el usuario.');
  }
  if(data?.error) throw new Error(data.error);
  return data;
};
