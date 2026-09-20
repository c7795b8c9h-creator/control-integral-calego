# V8 · Catálogo físico único de equipos

Objetivo: un equipo físico existe una sola vez y conserva un único código y QR.

## Reglas
- Las áreas y líneas de revisión no crean copias del equipo físico.
- Una línea puede **vincular un equipo existente** y reutilizar su mismo `machine_id`, código y QR.
- Una línea puede **crear un equipo nuevo exclusivo**. Se crea una sola máquina física y un vínculo inicial.
- Un equipo puede estar vinculado simultáneamente a Producción, Mantenimiento, Calidad u otras áreas.
- Desvincular de una línea no elimina el equipo si sigue vinculado a otras.
- Si se retira el último vínculo, el equipo físico puede desactivarse y deja de aparecer su QR operativo.
- El histórico no se destruye.

## Rondas
La identidad de una ronda de checklist es:
`tipo + fecha + turno + equipo físico + línea de revisión`.

Esto permite que la misma inyectora tenga, en el mismo turno, una ronda de Producción y otra de Mantenimiento sin duplicar la máquina.

## Dashboard
- **Equipos físicos** = IDs únicos de máquinas.
- **Puntos de revisión** = vínculos equipo × línea.
- Las rondas permanecen separadas por T1/T2/T3.
- Área y evidencia se derivan de la línea de la ronda, no del área de origen histórico del equipo.

## Migración
Los registros existentes de `machines.module_id` se conservan como relación de origen/compatibilidad para no romper histórico ni control de moldes.
La relación operativa nueva vive en `machine_module_links`.

No se consolidan automáticamente las máquinas duplicadas históricas de Mantenimiento porque la equivalencia puede ser ambigua. Gerencia podrá vincular la máquina física correcta y retirar el duplicado de futuras rondas, preservando su histórico.
