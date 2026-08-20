# Control Integral Calego

Aplicación web de control operativo de CALEGO.

## Producción

- App: https://control-integral-calego.vercel.app
- Backend: Supabase (Auth, PostgreSQL, RLS, Storage y Edge Functions)
- Hosting: Vercel
- Rama principal: `main`

## Funcionalidad

- Listas de chequeo por área, línea, máquina y turno.
- Validación QR por máquina.
- Evidencia fotográfica obligatoria, opcional y aleatoria.
- Control de moldes contra ficha estándar y tolerancias.
- Fallas, observaciones y cierre de soluciones por Gerencia.
- Dashboard gerencial.
- Administración de usuarios, permisos y matriz maestra.

## Bundle de producción

`index.html` reconstruye los estilos desde `style.txt` y el JavaScript desde `app0.txt` a `app4.txt`. Estos archivos corresponden al bundle que está publicado en Vercel.

El workflow `.github/workflows/sync-production.yml` permite volver a sincronizar el repositorio con el bundle actualmente desplegado en producción.

## Seguridad

El frontend usa únicamente la clave publicable de Supabase. Las autorizaciones se aplican mediante RLS y funciones de servidor. **Nunca** debe almacenarse una clave `service_role`, contraseña administrativa o secreto de Edge Functions en este repositorio.
