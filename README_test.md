# 🩺 Project Doctor — Comparativa de versiones

Tres versiones del mismo script adaptadas a cada stack.

---

## ¿Cuál usar?

| Proyecto | Script |
|---|---|
| Vite + Vitest (React/Vue) | `project-doctor.mjs` |
| MERN (MongoDB + Express + React + Node) | `project-doctor-mern.mjs` |
| TypeScript (Next.js, NestJS, React TS, etc.) | `project-doctor-ts.mjs` |

---

## Scripts en package.json

```json
"doctor":      "node project-doctor.mjs",
"doctor:fix":  "node project-doctor.mjs --fix",
"doctor:deep": "node project-doctor.mjs --deep --fix",
"doctor:ci":   "node project-doctor.mjs --ci"
```

Reemplaza `project-doctor.mjs` por la versión que corresponda.

---

## Flags (todos los scripts)

| Flag | Descripción |
|---|---|
| `--fix` | Aplica correcciones automáticas |
| `--deep` | Análisis profundo (deps circulares con madge) |
| `--ci` | Exit 1 si hay errores críticos (para CI/CD) |
| `--json` | Guarda `project-doctor-report.json` |
| `--skip-install` | No instala herramientas faltantes |

---

## Comparativa de checks

| Verificación | Vite | MERN | TypeScript |
|---|:---:|:---:|:---:|
| Deps sin uso (depcheck) | ✅ | ✅ | ✅ |
| Deps desactualizadas | ✅ | ✅ | ✅ |
| npm audit (seguridad) | ✅ | ✅ | ✅ |
| ESLint | ✅ | ✅ | ✅ |
| Prettier | ✅ | — | ✅ |
| Tests (Vitest) | ✅ | — | — |
| Tests (Jest + Supertest) | — | ✅ | — |
| Tests (Vitest o Jest) | — | — | ✅ |
| TypeScript tsc --noEmit | — | — | ✅ |
| tsconfig.json análisis | — | — | ✅ |
| Calidad de tipos (any, !) | — | — | ✅ |
| @types faltantes | — | — | ✅ |
| Estructura MERN | — | ✅ | — |
| .env / variables de entorno | — | ✅ | — |
| Mongoose / modelos | — | ✅ | — |
| Rutas Express | — | ✅ | — |
| Manejo de errores global | — | ✅ | — |
| Seguridad MERN (helmet, cors, rate-limit) | — | ✅ | — |
| Conexión MongoDB | — | ✅ | — |
| Deps circulares (--deep) | ✅ | — | ✅ |
| Duplicados npm dedupe | ✅ | — | — |
| Archivos grandes | ✅ | ✅ | ✅ |
| TODOs / FIXMEs | ✅ | ✅ | ✅ |
| Scripts recomendados | ✅ | ✅ | ✅ |
| .gitignore | ✅ | ✅ | ✅ |
| Husky / lint-staged | — | — | ✅ |
| .env.example | — | ✅ | — |
| Detección de framework | — | — | ✅ |

---

## Recomendaciones de mejora al proyecto base

El script original `project-doctor.mjs` es excelente. Estas son sugerencias:

### ✅ Lo que hace muy bien
- Auto-instalación de herramientas (depcheck, madge)
- Ignorar paquetes de tooling en depcheck (vite, vitest, etc.)
- Modo `--fix` no destructivo con confirmación visual
- Salida coloreada clara con iconos consistentes
- Modo `--ci` con exit codes correctos
- Reporte JSON exportable
- Verificación de `.gitignore` con auto-fix

### 💡 Mejoras sugeridas
1. **Agregar `--help`** — mostrar flags disponibles
2. **Modo `--quiet`** — solo mostrar errores, sin secciones informativas
3. **Caché de resultados** — guardar timestamp del último run y avisar si fue reciente
4. **Pre-commit hook** — agregar automáticamente como hook de Husky
5. **`.doctorignore`** — archivo de configuración para ignorar checks específicos
6. **Tiempo total** — mostrar cuánto tardó el análisis completo al final