---

### 2. 📜 CHANGELOG.md

Crea este archivo en la raíz (`D:\APP\cronoapp\CHANGELOG.md`).

```markdown
# Changelog

Todos los cambios notables en el proyecto **ControlData** serán documentados en este archivo.

## [1.0.2] - 2025-12-04 (Sprint: Estabilización y Features Críticos)

### ✨ Agregado (Features)
* **Módulo de Ausencias (Novedades):**
    * Frontend: Formulario de registro de ausencias (`AbsenceManagementPage`).
    * Backend: Servicio `AbsenceService` y endpoint `manageAbsences`.
    * Regla de Negocio: Bloqueo de creación de ausencias si existen turnos solapados.
* **Geolocalización (Fichada):**
    * Implementada utilidad `getCurrentPosition` con manejo robusto de errores (timeout, permisos).
    * Integrada en `EmployeeDashboard` para obligar el envío de coordenadas GPS en `auditShift`.
* **Multi-tenancy (Filtrado por Empresa):**
    * Implementado `ClientContext` para manejar la empresa seleccionada globalmente.
    * Actualizado `useSchedulerDataFetcher` para filtrar empleados y objetivos según el `clientId`.
    * Actualizado el Backend (`EmployeeService`, `ClientService`) para soportar consultas filtradas.
* **Gestión de Nómina Avanzada:**
    * Formulario de alta de empleados con campos extendidos: DNI, Legajo, Dirección.
    * Vinculación obligatoria de Empleado a Empresa (`clientId`).
* **Diagnóstico:**
    * Nueva pantalla `/admin/status` para verificar la salud de los servicios del Backend en tiempo real.

### 🐛 Corregido (Bug Fixes)
* **Scheduler Duplication:** Solucionado bug donde los turnos se cargaban/asignaban 4 veces debido a múltiples instancias de `Draggable` (agregado `cleanup` en `useEffect`).
* **Error 500 en Backend (Boot Crash):**
    * Solucionado error de inyección de dependencias en NestJS.
    * Implementada "Estrategia de Contención": Interfaces movidas dentro de los servicios (`ClientService`, `AbsenceService`) para evitar errores de "Module not found" en tiempo de ejecución.
    * Agregado `import 'reflect-metadata'` en `index.ts`.
    * Corregido `main.ts` para usar `createApplicationContext` en lugar de `create` (evita levantar servidor HTTP en Cloud Functions).
* **Errores 404 en Frontend:**
    * Configurado `cleanUrls: true` en `firebase.json`.
    * Configurado `output: 'export'` en `next.config.ts` para generación estática correcta.
* **Navegación:** Corregido enlace de "Objetivos" en el Sidebar que apuntaba incorrectamente a "Clientes".
* **Borrado de Usuarios:** Ahora `deleteEmployee` elimina tanto el documento en Firestore como el usuario en Firebase Authentication.

### 🔧 Infraestructura
* **Runtime Upgrade:** Migración de Node.js 18 a **Node.js 20** en Cloud Functions.
* **Dependencias:**
    * Actualización de `firebase-functions` a v4.9.0 (para compatibilidad Gen 1 con Node 20).
    * Instalación de `jest` y `@testing-library` en el frontend.
* **CI/CD:** Establecido procedimiento de "Despliegue Nuclear" (limpieza de `lib`, `.next`, `out`) para evitar inconsistencias de caché.

### ⚠️ Cambios Importantes (Breaking Changes)
* La interfaz `IEmployee` ahora requiere obligatoriamente `clientId`.
* Los servicios del Backend ya no dependen de archivos de interfaz externos en `common/interfaces` para evitar errores de compilación en la nube.