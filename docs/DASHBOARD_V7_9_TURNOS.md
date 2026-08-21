# Dashboard V7.9 - rondas por turno

Regla de visualizacion aprobada para la preview:

- Con `Todos los turnos`, las rondas se muestran por separado como T1, T2 y T3. No se usa un gran denominador combinado como 51.
- Al filtrar un responsable, sus maquinas asignadas no se multiplican automaticamente por tres.
- Los turnos donde ese responsable tiene actividad se muestran con `cerradas / maquinas asignadas`.
- Los turnos sin actividad se muestran como `Sin actividad` y no se computan como rondas pendientes del responsable.
- Con un turno especifico seleccionado, la cobertura se calcula normalmente contra las maquinas asignadas en ese turno.
- Para Andres, los datos historicos actuales solo muestran actividad en T1; por eso la vista `Todos` debe presentar T1 y no un total de 39.

La asignacion formal de turno por usuario queda como mejora de modelo de datos posterior; esta version evita inferir una deuda de tres turnos cuando dicha asignacion no existe en `profiles`.
