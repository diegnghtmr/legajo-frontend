# frontend — Legajo UI

Interfaz de Legajo: selección de artículos, comparación de similitud con
sus trazas, cuatro dendrogramas con métricas y corte, benchmarks y exportación
del caso de estudio. Bilingüe ES/EN. Este archivo dice dónde está cada cosa y
cómo se trabaja aquí. Las reglas visuales viven en `../docs/DESIGN.md` y las de
producto en `../docs/` (PRD y TRD); nada de eso forma parte de este repositorio
ni se sube.

Si una herramienta busca `CLAUDE.md`, se le deja un puntero de una línea a este
archivo, nunca una copia.

## Primero

| Antes de tocar… | Leer |
|---|---|
| Un color, una fuente, un radio o un espaciado | `DESIGN.md`: el YAML del inicio y §9.2 (`@theme`). Nunca un valor hex en un componente |
| Un control, un filtro, una tabla o un formulario | `DESIGN.md` §7: patrón B, botones, formularios, tablas, gráficos, accesibilidad |
| Una pantalla | `DESIGN.md` §6: corpus, similitud, matriz DP, agrupamiento, caso de estudio, benchmarks |
| Qué muestra cada vista y cuándo está terminada | PRD HU-1.1..HU-1.6, HU-2.1..HU-2.3, HU-6.1 |
| Reglas técnicas de la interfaz | TRD §6.7 (FTR-UI) |
| Despliegue, `vercel.json`, `VITE_API_BASE_URL` | TRD §14 |
| Criterios técnicos de aceptación que tocan la interfaz | TRD §15: TAC-06, TAC-12, TAC-15, TAC-16, TAC-20 |

## Pila

| Componente | Decisión |
|---|---|
| Runtime | Node 24 LTS, Vite 8, React 19.2, TypeScript 5.9 |
| Estilos | Tailwind CSS 4 con `@tailwindcss/vite`: todo por `@theme` en CSS, sin `tailwind.config` |
| Componentes | shadcn/ui restilado con los tokens de `DESIGN.md` |
| Estado | Zustand para selección y estado de la interfaz; TanStack Query para el estado del servidor (`staleTime: Infinity`, el corpus es estático) |
| Tablas | TanStack Table |
| Enrutado | React Router 7 |
| Formularios y validación | react-hook-form 7, Zod 4, `@hookform/resolvers` |
| Visualización | D3 solo para dibujar (jerarquía, escalas, formas), Recharts para curvas de JMH, KaTeX para fórmulas |
| Internacionalización | i18next y react-i18next |
| Exportación | `@react-pdf/renderer` para el caso de estudio |
| Pruebas | Vitest y Testing Library; Playwright con axe para los flujos de extremo a extremo |
| Tipos de la API | `openapi-typescript` a partir del OpenAPI del backend |

## Mapa del repositorio

| Ruta | Qué va ahí | Qué no va ahí |
|---|---|---|
| `src/features/corpus/` | Lista y selección de artículos, botón de comparar con su motivo de bloqueo | Llamadas HTTP sueltas |
| `src/features/similarity/` | Control segmentado de familia, ids de algoritmo en mono, tabla de resultados, paneles de traza (DP, TF-IDF, Jaccard, embeddings) | Cálculo de similitud |
| `src/features/clustering/` | Selector de representación, cuatro dendrogramas, línea de corte, tira de métricas con líderes y salvedad | Cálculo de enlaces o métricas |
| `src/features/benchmarks/` | Curvas de JMH frente a la teoría, datos del arnés | — |
| `src/shared/` | Componentes reutilizables (`SegmentedControl`, `AlgoTextButton`, `FamilyStatus`, `ScoreBar`, `DpMatrix`, `Dendrogram`, `MetricTile`, `Panel`) y `types/api.ts` generado | Lógica de una sola feature |
| `src/infrastructure/` | Cliente HTTP (Axios, errores RFC 9457), i18n | Componentes |
| `src/index.css` | El bloque `@theme` que implementa `DESIGN.md` §9.2 | Colores sueltos |
| `e2e/` | Flujos A y B con Playwright y axe | Pruebas unitarias |
| `vercel.json` | Reescritura de toda ruta a `/index.html` | — |
| `.env.example` | `VITE_API_BASE_URL` documentada | Valores reales |

Regla de alcance: un componente usado por dos o más features va a `src/shared/`;
si lo usa una sola, se queda dentro de esa feature.

## Comandos

Definidos por el TRD, apéndice A; `package.json` confirma los nombres reales.
**Regla del autor: nada se prueba en el pc, se prueba en contenedores** (TRD
§14.2). `npm run dev` es la única excepción razonable (servidor de
desarrollo, no una comprobación); todo lo demás se ejecuta con los scripts de
`scripts/` sobre imágenes fijadas, nunca con `mise`/`npm`/`npx` del host.

| Para | Comando en contenedor |
|---|---|
| Desarrollo con proxy `/api` al backend en `localhost:8080` (host, no es una comprobación) | `npm run dev` |
| Instalar dependencias | `scripts/npm-in-docker.sh ci` |
| Regenerar los tipos desde el OpenAPI del backend | `scripts/npm-in-docker.sh run api:types` |
| Tipos | `scripts/npm-in-docker.sh run typecheck` |
| Lint | `scripts/npm-in-docker.sh run lint` |
| Formato | `scripts/npm-in-docker.sh run format:check` |
| Conformidad de tokens (sin hex fuera de `@theme`) | `scripts/npm-in-docker.sh run check:tokens` |
| Pruebas unitarias y cobertura | `scripts/npm-in-docker.sh run test:coverage` |
| Build de producción | `scripts/npm-in-docker.sh run build` |
| Extremo a extremo con axe (simulado, imagen oficial de Playwright) | `scripts/e2e-in-docker.sh` |
| Humo de la imagen (contra un contenedor ya corriendo) | `docker run --rm --network host -v "$(pwd)":/workspace:ro -w /workspace curlimages/curl:8.15.0 sh scripts/smoke-image.sh <base-url>` |

`scripts/npm-in-docker.sh` corre sobre `node:24-alpine` con el repositorio
montado y `node_modules` en un volumen Docker con nombre propio, para que el
contenedor nunca choque con un `node_modules` instalado en el host.
`scripts/e2e-in-docker.sh` usa la imagen oficial de Playwright que coincide
con la versión fijada de `@playwright/test`, con sus navegadores incluidos —
nunca Chromium del host ni una configuración temporal apuntando a él — y su
propio volumen de `node_modules` (musl/Alpine y glibc/Ubuntu no pueden
compartir binarios nativos). El detalle de cada decisión está comentado en la
cabecera del script correspondiente.

La CI falla si `src/shared/types/api.ts` no coincide con el OpenAPI publicado, si
un esquema Zod y los tipos generados discrepan en campos requeridos, si hay
valores hex fuera de `@theme`, si axe reporta violaciones AA en los flujos A y B,
o si la prueba de humo de la imagen (`image-smoke`, TRD §14.3) falla.

## Reglas que no se negocian

1. **`DESIGN.md` manda en lo visual.** Solo tokens de `@theme`: colores,
   tipografía, radios y espaciado. Ningún hex, ningún tamaño fuera de escala,
   ningún tema oscuro en v1.
2. **Patrón B.** Familia con control segmentado `All | Classic | AI` con
   semántica `radiogroup` y opciones `radio` con `aria-checked`; ids de
   algoritmo como texto mono seleccionable; punto de estado más etiqueta de
   texto en tablas; sin chips pastel como filtro principal; sin separadores `·`.
3. **La interfaz no calcula.** Similitud, enlaces, cortes y métricas vienen del
   backend; D3 solo dibuja a partir de la matriz de enlace y de `leafOrder`.
4. **Tipos generados, nunca editados.** `types/api.ts` sale de
   `npm run api:types`; los esquemas Zod validan las respuestas y los parámetros
   editables (representación, enlaces, corte `k`).
5. **Estado en su sitio.** Selección y conmutadores en Zustand; datos del
   servidor en TanStack Query; formularios editables en react-hook-form.
6. **Bilingüe sin romper el diseño.** Las cadenas de la interfaz cambian con
   i18n; el diseño y los tokens son idénticos en ES y EN; los ids de algoritmos
   y los términos del corpus no se traducen.
7. **Tablas y trazas completas.** La tabla de similitud muestra normalizado,
   valor crudo, tiempo en nanosegundos, marca `cached` y el indicador
   `degenerate`; la matriz DP se dibuja completa en una ventana desplazable con
   el camino óptimo visible y descarga CSV; las seis capacidades tienen panel de
   traza.
8. **Accesibilidad básica.** Anillo de foco visible en todo control, contraste
   AA en los pares de `DESIGN.md`, el color nunca es el único canal.

## Pruebas: primero la prueba

TDD estricto: rojo, verde, refactor.

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unitarias | Vitest y Testing Library | Construcción del dendrograma desde la matriz de enlace, resaltado del camino en `DpMatrix`, tienda de selección, control segmentado |
| Contrato | Zod frente a `types/api.ts` | Campos requeridos de cada respuesta |
| Extremo a extremo | Playwright y axe | Flujo A: seleccionar, comparar las seis capacidades, abrir una traza DP. Flujo B: cuatro enlaces, métricas, corte. Sin violaciones AA |
| Conformidad visual | lint de tokens | Cero valores hex fuera de `@theme` |

## Commits y pull requests

- Conventional Commits en inglés con alcance por feature o capa:
  `feat(similarity): …`, `fix(clustering): …`, `style(theme): …`,
  `test(e2e): …`, `chore(deps): …`. Sin atribución a IA.
- Una rama por unidad de trabajo. PR de hasta 400 líneas; si crece, se
  encadena (skill `chained-pr`).
- Cada PR lleva sus pruebas y, si tocó el contrato, los tipos regenerados.
- Skills: `skill-git-pr-conventional-commits`, `branch-pr`, `work-unit-commits`.

## Nunca

- Subir `.env`, claves, ni nada de `../docs/`.
- Escribir un hex, un tamaño de fuente o un espaciado fuera de `@theme`.
- Editar `src/shared/types/api.ts` a mano ni calcular métricas en el navegador.
- Traducir ids de algoritmos o términos del corpus.
- Introducir un tema oscuro, gradientes, glassmorphism o chips pastel como filtro.
- Cambiar un patrón de `DESIGN.md` desde el código: se cambia el documento primero.

## Siempre

- Leer `DESIGN.md` y TRD §6.7 antes de cualquier PR de interfaz.
- Cambiar tokens en el YAML de `DESIGN.md` y en `@theme` antes que en componentes.
- Escribir la prueba antes del código y correr `typecheck`, `lint`, `test` y `e2e` antes del commit, siempre con los comandos en contenedor de la tabla anterior.
- Mantener el mapa de este archivo al día cuando se mueve algo.

## Si algo no está claro

1. Este archivo.
2. `DESIGN.md` para lo visual; TRD §6.7 y las HU del PRD para el comportamiento.
3. `../AGENTS.md` del espacio de trabajo, para lo que cruza al backend.
4. Preguntar al autor. No se asume.
