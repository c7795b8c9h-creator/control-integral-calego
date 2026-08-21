# Curaduría integral · Preview V7.6

Fecha: 2026-08-20
Estado: PREVIEW, no fusionado a producción.

## Resultado ejecutivo

Se revisó la aplicación como producto completo: jerarquía Área → Línea → Equipo → Pregunta, Dashboard, filtros, responsables, evidencias, fotos, flujo operativo, anti-plana, matriz, usuarios, permisos, QR, observaciones, móvil, sesión y consistencia de datos.

## Corregido en V7.6

- Dashboard usa un único contexto estricto: Fecha + Área + Responsable + Turno.
- Evidencias y Análisis consumen exactamente el mismo contexto del Dashboard.
- Dashboard deja de depender de códigos fijos de Producción y soporta áreas nuevas como Logística.
- En vista Todas, se distinguen puntos/equipos físicos de rondas esperadas; nunca se presenta máquina-turno como cantidad de máquinas.
- Producción conserva agrupación especial: Inyección y Colapsibles; las demás áreas se agrupan por sus propias líneas.
- Responsable filtrado solo calcula contra equipos que realmente tiene asignados.
- Áreas, líneas o equipos con un padre desactivado dejan de aparecer en operación, Dashboard, usuarios y QR.
- El selector de la Matriz conserva Todas + una pestaña automática por cada área.
- Anti-plana: la confirmación física ahora pertenece a una ronda específica; no se reutiliza al pasar a otra máquina/ronda.
- Gerencia deja de tener dos controles de turno simultáneos: el Dashboard usa su filtro propio.
- Fallas y soluciones incorpora filtros de Área y Responsable.
- QR oculta equipos que ya no pertenecen a una estructura operativa activa y el cliente bloquea QR obsoletos.
- Usuarios y permisos no muestran líneas pertenecientes a áreas eliminadas.
- Vista de plantillas de Gerencia identifica Área · Línea y excluye jerarquías inactivas.
- Previsualización de foto libera recursos temporales y mantiene formato móvil compacto.

## Verificado en base de datos

- 0 máquinas activas dentro de líneas/áreas inactivas.
- 0 preguntas activas dentro de líneas/áreas inactivas.
- 0 permisos a áreas inactivas.
- 0 permisos a líneas inactivas.
- 0 usuarios activos sin perfil/Auth correspondiente.
- 0 perfiles sin usuario Auth.
- 0 usernames duplicados.
- 0 códigos duplicados de máquinas activas.
- 0 códigos duplicados de líneas activas.
- 0 nombres de áreas activas duplicados.
- Fotografías actuales: promedio aproximado 270 KB, máximo 497 KB, ninguna mayor de 1 MB.
- Rondas actuales: 2 cerradas, 0 borradores abandonados, 0 cierres inconsistentes.

## Calidad de contenido

Las preguntas activas son mayoritariamente específicas y orientadas a una observación real. Se detectó un error de redacción: “molde montao”.

Mejora estructural recomendada antes de publicación final: agregar a cada pregunta un campo independiente `criterio / qué observar`, editable desde Matriz. La V7 actual genera la ayuda secundaria mediante reglas sobre el texto de la pregunta; funciona, pero no es tan robusto como un criterio explícito mantenido por Calego.

## Backend que debe endurecerse antes de publicar V7

Los filtros de la Preview ya bloquean descendientes de áreas/líneas inactivas. Antes de fusionar a producción conviene llevar la misma regla a `has_module_access`, `validate_machine_qr` y `manager_machine_qr_tokens`, para que la protección no dependa solamente del cliente.

## Arquitectura

La Preview V7 está implementada como capas de hotfix sobre la V6 para permitir iteración rápida sin tocar producción. Antes de publicar debe consolidarse en una sola versión limpia de `app.js`/`style.css`, eliminando overlays históricos V7.1–V7.5 y dejando una única fuente de verdad.

## Validación

GitHub Actions valida sintaxis JavaScript y presencia de las capas críticas. Último check de la rama `preview-v7`: SUCCESS.
