# 🔧 Llave10 — Sistema de Gestión para Talleres
**by Axentia** · v1.0

Sistema integral para talleres mecánicos con arquitectura SaaS/On-Premise.

## ⚡ Configuración rápida

### 1. Configura Supabase
Abre `js/supabase.js` y reemplaza:
```js
const SUPABASE_URL = 'https://jzomiywgrnpflakblnlh.supabase.co';
const SUPABASE_KEY = 'TU_ANON_KEY_AQUI'; // Settings → API → anon public
```

### 2. Publica en GitHub Pages
1. Sube esta carpeta a un repositorio en GitHub
2. Ve a **Settings → Pages → Source: Deploy from branch → main**
3. Tu sistema estará en: `https://tuusuario.github.io/llave10`

### 3. Primer acceso
- Email: `admin@llave10.com`
- Contraseña: cualquiera (se configura en el primer acceso)

## 📦 Módulos incluidos
| Módulo | Descripción |
|---|---|
| Dashboard | Kanban de órdenes + métricas |
| Órdenes | 8 estados: Borrador → Diagnóstico → Aprobación → Progreso → Pago → Cerrado |
| Clientes & Vehículos | Gestión completa con historial |
| Inventario | Stock con alertas de mínimo |
| Facturas | NCF físico (B01-B15) + e-CF electrónico (e31-e34) |
| Cuentas por Cobrar | Pagos parciales y seguimiento |
| Reportes | Exportación CSV, métricas gerenciales |
| Asistente IA | Integrado con Claude API |
| Usuarios & Roles | Super Admin, Gerente, Secretaria, Mecánico |

## 🗄️ Base de datos
- **Motor:** PostgreSQL vía Supabase
- **Proyecto:** `axrepuesto` (jzomiywgrnpflakblnlh)
- **Tablas:** clientes, vehiculos, repuestos, ordenes, facturas, secuencias, config, usuarios, roles, cuentas_cobrar, pagos

## 🔒 Roles
| Rol | Acceso |
|---|---|
| Super Admin | Todo el sistema |
| Gerente | Todo el taller |
| Secretaria | Clientes, facturación, cobros |
| Mecánico | Solo actualizar estado de órdenes |
