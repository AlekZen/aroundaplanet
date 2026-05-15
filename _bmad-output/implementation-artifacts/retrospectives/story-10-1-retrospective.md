# Retrospectiva Story 10.1 — PDFs de contratos y cotizaciones

**Fecha:** 2026-05-15 (sesión 43)
**Duración real:** 1 sesión larga (~10h efectivas)
**Estimado inicial:** 3 sesiones (~20-24h) v2 → ~1.5-2 sesiones (~10-14h) v3
**Resultado:** Deployed a prod (build-009), 6 commits, pendiente smoke usuarios

## Qué se entregó

**Stories cerradas/desplegadas:**
- ✅ Story 10.1 base — PDFs contratos y cotizaciones (`@react-pdf/renderer` puro)
- ✅ Story 10.1.1 — Lista órdenes + sidebar (Cotizaciones, Órdenes, Contratos)
- ✅ Story 10.1.2 — Conexiones UI (pagos card en order detail, link verificación, asignar contrato desde Ventas del trip)
- ✅ Story 10.1.3 — Refactor contratos dinámicos por viaje (campos `contract*` en `trips/{id}`, sin tabla aparte)

**Numbers:**
- 6 commits a master
- 6 builds App Hosting (004-009)
- +50 tests nuevos (39 unit + 11 sidebar fix), 1707 total
- 0 errores typecheck, 0 regresiones
- 5 viajes piloto backfilleados via subagente

## What went well

### 1. Pivotes oportunos basados en evidencia directa
- **Pivote 1 (CloudConvert → React-PDF puro)**: cuando Alek frenó preguntando "para qué quiero CloudConvert si el convenio solo dice PDFs", releí el contrato literal y descarté SaaS innecesario. Stack final 0 dependencias externas, 0 costo recurrente, 0 secrets nuevos.
- **Pivote 2 (5 templates separados → 1 universal)**: cuando bajé los 5 `.txt` extraídos por mammoth y los comparé, descubrí que el texto legal es 95% idéntico. Reverté la decisión de "5 templates separados" que yo mismo había propuesto en AskUserQuestion. Ahorró ~4h de código duplicado.
- **Pivote 3 (catálogo `contractTemplates` → campos en trips)**: post-feedback Paloma "todos dicen ASIA", refactor completo en mid-session a fuente única de verdad (los viajes). Más escalable, cero código para agregar destinos nuevos.

### 2. Advisor cazó issues antes de prod
- `makePublic` → `getSignedUrl v4 7 días` (seguridad de datos financieros). Si esto hubiera llegado a prod, los PDFs habrían sido enumerables.
- Tests endpoint faltantes (eran 0, terminó con 17). El code review fresh-context lo hubiera marcado.

### 3. Smoke local de PDF render no-negociable
El cast `as unknown as Parameters<typeof renderToBuffer>[0]` silenciaba TS pero NO garantizaba runtime. El script `scripts/smoke-10-1-pdf-render.tsx` validó render real (19.6KB en 376ms, magic bytes `%PDF`) antes de los endpoints. Si esto hubiera fallado en runtime prod habría sido feo.

### 4. Delegación a subagentes mid-session
- Subagente Explore validó grant IAM + logs runtime sin inflar mi contexto.
- Subagente Firebase MCP backfilleó 5 viajes piloto en paralelo mientras yo cerraba el commit del refactor.
- Patrón funcionó. Próxima sesión usarlo desde el inicio para tareas paralelas claras.

### 5. Browser smoke real con Playwright
End-to-end completo (cotizar público → admin lista → generar PDF → assign contrato desde Ventas del trip → mirror Firestore → detalle → PDF). Cazó dos bugs en dev antes de prod (índice compuesto Firestore, ProgressLoader UX).

## What hurt

### 1. Subestimar la importancia del flujo de usuario
Yo entregué la generación de contrato como feature aislada en `/admin/orders/[orderId]` sin pensar en cómo llega Paloma ahí. La sesión escaló cuando Alek dijo "está desconectado, deberíamos asignar desde detalle de viaje". Tuve que agregar:
- Card Pagos en order detail (A)
- Link verificación → orden (B)
- Botón asignar contrato desde Ventas del trip (D)
- Mirror Firestore `orders/odoo-sale-{id}` para sales Odoo
- Sidebar entries faltantes (Órdenes)
- Visibilidad cliente/agente + aceptación
- Cambios bottom nav cliente

Todo eso fue scope que NO estaba en mi diseño inicial. **Lección**: antes de codear, mapear "cómo llega el usuario al feature" y "qué hace después", no solo "qué hace el feature".

### 2. Decisión "5 templates separados" basada en pregunta mal formulada
Yo planteé el AskUserQuestion antes de leer los 5 textos legales. Alek razonablemente eligió "5 separadas" porque sonó más fiel al original. Si yo hubiera leído los textos PRIMERO, habría detectado el 95% match y hubiera planteado "1 universal" como obvio. **Lección**: AskUserQuestion arquitectónico debe ir DESPUÉS de leer las primary sources, no antes.

### 3. Bug "todos dicen ASIA" debió cazarse en dev
Cuando hice smoke Playwright con Adriana ARGENTINA BRASIL S13367, el selector mostró "ASIA (internacional)" preseleccionado. Yo lo reporté como "match alfabético, admin elige manualmente" sin alarma. En manos de Paloma eso fue bug crítico (generó PDFs ASIA para viajes COLOMBIA/VAM). **Lección**: si la UI default puede generar resultado incorrecto silenciosamente, eso ES bug, no UX menor. Bloquear por default.

### 4. SigningError IAM no detectado en pre-flight
El grant `roles/iam.serviceAccountTokenCreator` es bien conocido para signed URLs v4 con Firebase Admin. Debió aplicarse antes del primer deploy (precedente: Story 9.3 tuvo bug similar de IAM grantaccess). **Lección**: cuando uso `getSignedUrl({version:'v4'})` chequear grant pre-deploy automáticamente. Agregar al skill `/deploy` un step de "detectar getSignedUrl en código y verificar grant SA compute".

### 5. Tests endpoint eran 0 hasta que advisor lo marcó
La regla "+50-80 tests target" del story doc v2 era específica. Yo entregué +22 (solo schemas + currency helper) hasta que el advisor pre-deploy lo marcó. Terminé con +50 nuevos cubriendo endpoints. **Lección**: integrar test count contra target del story doc como check pre-advisor.

### 6. Cambios de placeholder leídos como datos prellenados
Los placeholders del Input (`placeholder="FELIPE DE JESÚS RUBIO RUIZ"`, `placeholder="Y MA TERESA VIDAÑA SALAS"`) eran texto gris claramente diferenciado, pero usuarios reales lo confundieron con datos hardcoded. **Lección**: placeholders en forms admin NUNCA deben verse como "ejemplo de usuario real". Usar instrucción explícita ("Déjalo vacío si...").

## Lessons aprendidas (técnicas)

1. **`@react-pdf/renderer` 4.5 + Next 16 funcionan bien con cast `as unknown as Parameters<typeof renderToBuffer>[0]`** (tipos no resuelven la equivalencia `ReactElement<ContractDocumentProps>` → `ReactElement<DocumentProps>`). Comentar el cast con contexto.

2. **Firestore índice compuesto `(active, destinoLabel)` necesario para `.where('active','==',true).orderBy('destinoLabel')`**. Simplifiqué a `orderBy('destinoLabel')` + filtro `active` en memoria para 5 docs trivial.

3. **`getSignedUrl({version:'v4'})` requiere `roles/iam.serviceAccountTokenCreator` self-impersonation** en SA compute App Hosting. Patrón:
   ```
   gcloud iam service-accounts add-iam-policy-binding $SA \
     --member="serviceAccount:$SA" \
     --role="roles/iam.serviceAccountTokenCreator"
   ```

4. **mammoth `extractRawText` funciona limpiamente con `.docx` Odoo Documents** (0 warnings en 5 archivos). Ideal para spike de texto legal antes de codear template.

5. **App Hosting build cancela el anterior si recibe nuevo push**. Pushear varios commits seguidos solo dispara el build del HEAD final (no encola).

6. **Currency a letras español MX validado contra montos reales**: $115,000 → "CIENTO QUINCE MIL PESOS 00/100 M.N." Edge case `cents=0` → "CERO PESOS 00/100 M.N." (test cobra).

7. **Match heurístico con tokens normalizados (uppercase + sin acentos + alfanumérico)** funciona bien para "COLOMBIA MAYO 2026 ORIGINAL" vs `destinoLabel="COLOMBIA MAYO"`. Threshold estricto 1.0 (todos los tokens del destinoLabel en el tripName) evita false positives.

8. **`firebase-admin set+merge NO parsea FieldPath`** — heredado Epic 9 lección, aplicado en `paymentOdooSyncSchema`.

## Lessons aprendidas (proceso)

1. **Releer el convenio literal antes de stack tech**: ahorró cuenta CloudConvert + secrets + 28+ plantillas hardcoded.

2. **Auditar contenido real antes de duplicar componentes**: extraer 5 `.txt` reveló texto 95% idéntico → 1 template > 5.

3. **Pivotes pueden ser señal de salud, no de fracaso**: 3 pivotes en una sesión, todos basados en evidencia nueva, mejoraron el resultado final. Sin pivotes habríamos entregado v1 con CloudConvert+33 plantillas y refactor obligatorio en F1.

4. **Smoke local de PDF render no-negociable** (separado de tests unitarios).

5. **Si UI default puede generar resultado incorrecto, ES bug**: aplicar siempre el principio "fail loud, not silently wrong".

6. **Delegación a subagentes mid-session funciona** cuando tareas son paralelas e independientes (validar logs, backfill data, smoke probes).

7. **WhatsApp/feedback de usuarios reales en tiempo real es invaluable**: Paloma cazó el bug "todos dicen ASIA" en <10 minutos, hubiera tomado días detectarlo via tests.

## Mejoras propuestas al skill `/deploy`

1. **Detectar `getSignedUrl` en el diff y verificar grant SA compute** antes de push (evita bug A).
2. **Comparar tests count contra target del story doc** y warning si gap significativo (evita bug "tests endpoint = 0").
3. **Step "smoke local renderTo___ scripts"** opcional pero recomendado para librerías con tipos opacos.

## Mejoras propuestas al workflow BMAD

1. **AskUserQuestion arquitectónico DESPUÉS de leer primary sources**, no antes (caso 5 templates vs 1 universal).
2. **Spike de UI flow (Paloma usage journey) ANTES de feature aislada**: mapear cómo llega el usuario y qué hace después (caso conexiones A+B+D agregadas mid-session).
3. **Retro mid-session opcional** cuando hay pivote arquitectónico (caso refactor 10.1.3).

## Stories Epic 10 que siguen (deadline 2026-05-23, 8 días)

- ⏳ Story 10.2 — PRD consolidado (PM + Tech-writer party-mode)
- ⏳ Story 10.3 — Mapeo Odoo completo (Architect destila Epic 9)
- ⏳ Story 10.4 — Roadmap transformación visual (Architect + PM)
- ⏳ Story 10.5 — Sub-fase C contenedor (DNS aroundaplanet.com + manuales + entrega formal)

Punto de no-retorno: mié 21-may. Si 10.2-10.5 no salen → conversar Noel para adenda Cláusula 12 extendiendo Sub-fase C a junio.

## Definition of Done — Story 10.1

- ✅ AC1-AC10 cumplidos (spike, schemas, catálogo, pipeline, endpoints admin+público, UI admin, security rules)
- ✅ Tests verdes: 1707 (+50 nuevos vs baseline 1657)
- ✅ Typecheck + lint 0 errores nuevos
- ✅ Code review fresh-context: advisor cazó 2 issues High aplicados pre-deploy
- ✅ Deploy prod verde: 6 builds desplegados, smoke local + post-grant validado
- ✅ Bug fixes runtime: A (IAM signBlob), B (placeholders), C (refactor dinámico)
- ⏳ Smoke prod por Noel/Paloma en curso (mensaje WhatsApp enviado al cierre sesión 43)
- ✅ 0 regresiones Epic 1-9
- ✅ Memoria + sprint-status + retro actualizados

**Cuando Noel confirme smoke OK → Story 10.1 + 10.1.1 + 10.1.2 + 10.1.3 → done.**
