'use strict';
(function(){
  function addPreviewBadge(){
    if(document.getElementById('previewV7Badge'))return;
    const b=document.createElement('div');
    b.id='previewV7Badge';b.className='preview-v7-badge';
    b.innerHTML='<b>PREVIEW V7</b><span>No afecta la versión publicada</span>';
    document.body.appendChild(b);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addPreviewBadge);else addPreviewBadge();

  window.compressImage=async function(file){
    return await new Promise((resolve,reject)=>{
      const img=new Image(),url=URL.createObjectURL(file);
      img.onload=()=>{
        URL.revokeObjectURL(url);
        let w=img.width,h=img.height;
        const max=960;
        if(w>max||h>max){const r=Math.min(max/w,max/h);w=Math.round(w*r);h=Math.round(h*r)}
        const c=document.createElement('canvas');c.width=w;c.height=h;
        const ctx=c.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
        let q=.68,data=c.toDataURL('image/jpeg',q);
        while(data.length>620000&&q>.42){q-=.06;data=c.toDataURL('image/jpeg',q)}
        resolve({dataUrl:data,mime:'image/jpeg',width:w,height:h,approxBytes:Math.round(data.length*.75)});
      };
      img.onerror=reject;img.src=url;
    });
  };

  const basePreview=window.previewPhoto;
  window.previewPhoto=function(){
    if(typeof basePreview==='function')basePreview();
    const f=$('photoInput')?.files?.[0];
    if(f&&$('photoHelp')){
      const mb=(f.size/1024/1024).toFixed(1);
      $('photoHelp').innerHTML=`Foto original: ${mb} MB. <b>Se guardará optimizada</b> para evidencia móvil: máx. 960 px y aprox. 0.2–0.5 MB.`;
    }
  };
})();
