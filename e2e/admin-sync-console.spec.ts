/**
 * E2E — Admin Sync Console (Story 9.6)
 *
 * TODO(9.6-E2E): Los tests están marcados con test.skip porque el proyecto no tiene
 * infraestructura de autenticación programática para E2E todavía. El único spec
 * existente (placeholder.spec.ts) no incluye helpers de login/session.
 *
 * Para habilitar estos tests se necesita UNA de las siguientes opciones:
 *   A) Crear un endpoint `/api/test/seed-admin-session` (solo en NODE_ENV=test)
 *      que retorne una cookie de sesión Firebase Admin firmada.
 *   B) Usar Firebase Auth REST API con email/password de usuario de prueba y
 *      setear el ID token en localStorage antes de navegar.
 *   C) Mockear el proxy de auth (src/proxy.ts) en modo E2E via env flag.
 *
 * Dependencia bloqueante: historia de infraestructura E2E auth (ver epics.md).
 */

import { test, expect } from '@playwright/test'

/**
 * Scenario A — Resolver conflicto LWW desde la UI de Sync Console
 *
 * Pre-condiciones:
 *   - Firestore tiene ≥2 docs en `paymentConflicts` con status='open'
 *   - Hay un doc en `payments` referenciado por al menos uno de los conflictos
 * Flujo:
 *   1. Login como admin
 *   2. Navegar a /admin/payments/sync-console → tab Conflictos
 *   3. Ver 2 rows en la tabla
 *   4. Click "Resolver" en el primer row
 *   5. Modal abre → seleccionar "Conservar Firestore" → submit
 *   6. Toast aparece con mensaje de éxito
 *   7. El row desaparece de la tabla (o se mueve a "Resueltos")
 */
test.skip('Scenario A: resolver conflicto LWW desde Sync Console', async ({ page }) => {
  // TODO: seed via Admin SDK fixture (e2e/fixtures/sync-console.ts)
  // const { conflictIds, paymentId } = await seedConflicts()

  // TODO: login programático como admin
  // await loginAsAdmin(page)

  await page.goto('/admin/payments/sync-console')

  // Navegar al tab Conflictos
  await page.getByRole('tab', { name: /conflictos/i }).click()

  // Verificar que hay filas en la tabla
  const rows = page.locator('table tbody tr')
  await expect(rows).toHaveCount(2)

  // Click en el primer botón Resolver
  await rows.first().getByRole('button', { name: /resolver/i }).click()

  // Modal debe abrirse
  await expect(page.getByRole('dialog')).toBeVisible()

  // Seleccionar "Conservar Firestore"
  await page.getByRole('radio', { name: /conservar firestore/i }).check()

  // Submit
  await page.getByRole('button', { name: /confirmar/i }).click()

  // Toast de éxito
  await expect(page.getByText(/conflicto resuelto/i)).toBeVisible()

  // El row desaparece
  await expect(rows).toHaveCount(1)

  // TODO: cleanup seeds
  // await deleteConflicts(conflictIds, paymentId)
})

/**
 * Scenario B — Export CSV desde la Cola de Push
 *
 * Pre-condiciones:
 *   - Firestore tiene ≥1 pago con odooSyncStatus='pending' (o usar seed del Scenario A)
 * Flujo:
 *   1. Login como admin
 *   2. Navegar a /admin/payments/sync-console → tab "Cola de push"
 *   3. Click "Exportar CSV"
 *   4. Capturar la descarga
 *   5. Verificar: Content-Type text/csv, filename con fecha, ≥2 líneas (header + 1 fila)
 */
test.skip('Scenario B: exportar CSV de cola de push', async ({ page }) => {
  // TODO: login programático como admin
  // await loginAsAdmin(page)

  await page.goto('/admin/payments/sync-console')

  // Navegar al tab Cola de push
  await page.getByRole('tab', { name: /cola de push|push queue/i }).click()

  // Capturar la descarga
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /exportar csv/i }).click()
  const download = await downloadPromise

  // Verificar nombre del archivo — debe tener formato sync-console-queue-YYYY-MM-DD.csv
  const filename = download.suggestedFilename()
  expect(filename).toMatch(/^sync-console-queue-\d{4}-\d{2}-\d{2}\.csv$/)

  // Verificar contenido — al menos header + 1 fila
  const path = await download.path()
  const { readFileSync } = await import('fs')
  const content = readFileSync(path!, 'utf-8')
  const lines = content.split('\n').filter(Boolean)
  expect(lines.length).toBeGreaterThanOrEqual(2)

  // Verificar que la primera línea es el header CSV esperado
  expect(lines[0]).toContain('ID')
})
