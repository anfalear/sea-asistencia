---
name: verify
description: Cómo verificar cambios de esta app (HTML+JS estático contra Supabase con login Google OAuth) en un navegador real sin credenciales.
---

# Verificar SEA Asistencia en el navegador

La app es estática (sin build). El login es Google OAuth contra Supabase, no
automatizable — la verificación se hace suplantando el cliente Supabase con un
mock que registra cada operación de BD.

## Receta

1. Servir el repo: `python -m http.server 8123 --directory <repo>` (en background).
2. Playwright (chromium): instalar `npm i playwright` en el scratchpad si no está
   (`npx playwright install chromium` — el navegador suele estar ya en
   `%LOCALAPPDATA%\ms-playwright`).
3. Interceptar los CDN antes de `page.goto`:
   - `**/cdn.jsdelivr.net/npm/@supabase/**` → mock de `window.supabase.createClient`
     (builder Proxy encadenable + thenable; `auth.onAuthStateChange` dispara
     `SIGNED_IN` con un usuario de prueba; la tabla `email_whitelist` debe
     devolver el email para pasar la lista blanca).
   - `**/cdn.jsdelivr.net/npm/xlsx/**` → `window.XLSX={utils:{}}`.
   - `**/cdn.jsdelivr.net/npm/chart.js` → stub de `window.Chart`.
4. El mock guarda cada operación en `window.__dbLog` ({table, mode, filters,
   payload}) — con eso se afirma "no escribió en la BD" o se inspecciona el
   payload insertado.
5. Ejemplo completo funcional: `mock_supabase.js` + `verify_registro.js`
   (sesión 2026-07-07, validación de puntajes 1-5 en registro.js).

## Gotchas

- `waitForSelector` sobre `<option>` necesita `{ state: 'attached' }` (Playwright
  las considera ocultas).
- Los toasts (`.toast.error` / `.toast.success`) viven ~3.5s; esperar ~3.9s entre
  casos para que no se mezclen.
- La fecha del registro es `todayISO()`; los datos del mock deben usar
  `new Date().toISOString().split('T')[0]` para que la asistencia "existente"
  coincida con la fecha precargada.
- `guardarAsistencia()` puede abrir `confirm()` si nadie está presente:
  registrar `page.on('dialog', d => d.accept())`.
