# CONTEXT.md — Proyecto Pulse
> Documento de contexto completo del proyecto. Última actualización: abril 2026 — build Android instalado en dispositivo real.
> Usar este fichero para onboarding de nuevos desarrolladores, continuación de sesiones con IA, y referencia técnica del estado del proyecto.

---

## 1. Qué es Pulse

Pulse es una app para adolescentes de 13–19 años que conecta a cada usuario con una persona real al día, elegida por compatibilidad de identidad profunda. No es una red social. No hay feed público, no hay métricas de vanidad, no hay publicidad.

**La promesa:** *Una conexión real al día. Eso es todo lo que necesitas para cambiar cómo una generación entiende la amistad.*

### Mecánica principal
- El usuario completa un onboarding de 5 preguntas emocionales (no un formulario de intereses)
- Cada día a las 18:00 recibe una notificación con su "Pulse del día" — una persona real con alta compatibilidad de identidad
- La conversación es efímera: desaparece en 72 horas si no se guarda el contacto
- Para guardar un contacto se necesitan al menos 10 mensajes — la profundidad se gana
- Cada semana se genera una "cápsula": una visualización abstracta única de las conversaciones de esa semana, compartible en redes

### Por qué es diferente
- Hinge resolvió el amor. Pulse resuelve la amistad adolescente.
- El estatus en Pulse no se gana siendo popular, se gana siendo profundo.
- La viralidad está integrada en el producto: las cápsulas semanales, el invite de alta fricción (3 palabras), y los "Pulses compartidos" cuando dos conocidos se emparejan.

---

## 2. Stack técnico decidido

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | React Native + Expo | Un codebase para iOS y Android |
| Navegación | Expo Router (file-based) | Routing declarativo + deep linking |
| Estado global | Zustand + MMKV | Persistencia rápida sin AsyncStorage |
| Server state | React Query (TanStack) | Cache, optimistic updates, retry |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) | RLS granular, mensajería en tiempo real, sin infra propia |
| Edge Functions | Deno (TypeScript) | Runtime de Supabase, validación con Zod |
| Matching engine | Python + FastAPI (Railway) | Microservicio independiente, escalable |
| Embeddings | sentence-transformers (paraphrase-multilingual-mpnet-base-v2) | Multilingüe, 768 dimensiones |
| Índice ANN | FAISS IVFFlat | Matching aproximado a escala (>100 usuarios) |
| Privacidad diferencial | Mecanismo gaussiano (ε=0.5, δ=1e-5) | Protección de vectores de menores |
| Cifrado de vectores | Fernet (AES-128-CBC + HMAC-SHA256) | Vectores nunca en texto plano |
| CI/CD | GitHub Actions + EAS Build | PR checks, deploy automático, builds firmados |
| Monitorización | Sentry + PostHog (EU) | Errores en tiempo real, funnel de producto |
| Notificaciones | Expo Notifications + APNs + FCM | Push nativo en iOS y Android |

---

## 3. Estructura del monorepo

```
pulse/
├── turbo.json                          # Turborepo config
├── package.json                        # Workspaces raíz
├── .github/
│   └── workflows/
│       ├── pr.yml                      # Lint + type-check + tests en cada PR
│       ├── main.yml                    # Deploy en merge a main
│       └── release.yml                 # Build firmado + submit a stores
├── apps/
│   ├── mobile/                         # React Native + Expo
│   │   ├── app/                        # Expo Router (file-based)
│   │   │   ├── (auth)/                 # login.tsx, register.tsx
│   │   │   ├── (onboarding)/           # question/[step].tsx, complete.tsx
│   │   │   └── (app)/                  # home, chat/[matchId], contacts, capsule, profile
│   │   └── src/
│   │       ├── components/             # Avatar, StatCard, EmptyState, SectionHeader, DepthMeter, InviteCard, CapsuleVisual
│   │       ├── hooks/                  # useOnboarding, useMatch, useMessages, useMatchTimer, useContacts, useCapsules, useProfile
│   │       ├── stores/                 # session.ts (Zustand+MMKV), onboarding.ts
│   │       ├── lib/                    # supabase.ts, sentry.ts, analytics.ts
│   │       ├── theme/                  # tokens.ts, useTheme.ts
│   │       └── utils/                  # avatar.ts, date.ts
│   └── backend/
│       └── supabase/
│           ├── migrations/             # SQL versionado
│           ├── functions/              # Edge Functions Deno
│           │   ├── _shared/            # cors.ts, auth.ts, response.ts
│           │   ├── onboarding/         # POST — genera vector de identidad
│           │   ├── match/              # GET — match del día
│           │   ├── messages/           # POST — enviar mensaje
│           │   ├── contacts/           # POST — guardar contacto
│           │   └── invites/            # GET/POST — gestión de invites
│           └── config.toml
├── packages/
│   └── shared/
│       └── src/
│           ├── types/                  # user.ts, match.ts, message.ts, contact.ts, capsule.ts
│           ├── validators/             # onboarding.ts, message.ts (Zod schemas)
│           └── constants/             # questions.ts (las 5 preguntas), limits.ts
└── services/
    └── matching-engine/                # Microservicio Python (Railway)
        ├── app/
        │   ├── main.py                 # FastAPI app + lifespan
        │   ├── routers/                # embed.py, match.py, feedback.py, index.py
        │   └── core/                   # config.py, logging.py, security.py, crypto.py, privacy.py, supabase.py, embedder.py, scoring.py, faiss_index.py, cold_start.py
        ├── tests/                      # conftest.py, test_privacy.py, test_scoring.py, test_embedder.py, test_crypto.py
        ├── scripts/                    # evaluate_matching.py
        ├── Dockerfile
        ├── docker-compose.yml
        └── requirements.txt
```

---

## 4. Base de datos — Schema completo

### Tablas

| Tabla | Propósito | RLS |
|---|---|---|
| `users` | Perfil del usuario, edad, ciudad, consentimiento parental | Solo el propio usuario |
| `identity_vectors` | Vector de identidad cifrado con pgsodium | Solo service_role |
| `daily_matches` | Match diario entre dos usuarios (TTL 72h) | Solo participantes del match |
| `messages` | Mensajes efímeros (TTL 72h, borrado físico) | Solo participantes del match |
| `saved_contacts` | Contactos guardados tras conversación | Solo el propio usuario |
| `weekly_capsules` | Resumen semanal generado automáticamente | Solo el propio usuario |
| `invites` | Invitaciones con 3 palabras (1 por semana) | Solo el invitador |
| `moderation_flags` | Reportes de usuarios | Solo inserción propia |
| `compatibility_events` | Señales de comportamiento para reentrenamiento ML | Solo service_role |

### Jobs programados (pg_cron)
- `purge-expired-messages`: cada hora — borra físicamente mensajes con `expires_at < now()`
- `generate-weekly-capsules`: lunes a las 08:00 UTC — genera cápsulas para todos los usuarios activos

### Campos clave de seguridad
- `users.is_junior`: columna generada — true si el usuario tiene menos de 16 años
- `users.deleted_at`: soft delete — datos retenidos 30 días para auditoría, luego purga física
- `users.consent_status`: pending/approved/rejected — para menores de 16 en Europa (DSA Art. 28)
- `identity_vectors.vector_enc`: bytea cifrado con pgsodium — nunca texto plano
- `messages.expires_at`: TTL de 72 horas — borrado físico garantizado

---

## 5. Matching engine — cómo funciona

### Pipeline de onboarding
1. Usuario responde 5 preguntas en texto libre
2. Edge Function llama a `POST /embed` en el engine
3. El engine concatena respuestas con `[SEP]` y genera embedding con sentence-transformers (768 dimensiones)
4. Se aplica ruido gaussiano diferencial (ε=0.5, δ=1e-5) — protege la privacidad del vector
5. El vector se cifra con Fernet y se guarda en `identity_vectors` — nunca sale del servidor

### Pipeline de matching diario
1. Job diario a las 17:50 UTC llama a `POST /match` para cada usuario
2. El engine carga el vector del usuario y el pool de candidatos elegibles
3. Filtros duros: excluir matches recientes (30 días), restricción de edad (±2 años si alguno es junior)
4. Scoring: `cosine_similarity(user_vector, candidate_vector) + geo_boost(0.05 si misma ciudad)`
5. Estrategia adaptativa por tamaño del pool:
   - 0–9 usuarios: sin match (cold start — insuficiente)
   - 10–99 usuarios: búsqueda exhaustiva
   - 100+ usuarios: FAISS IVFFlat (ANN, recall ~95%)
6. El match se inserta en `daily_matches` y se dispara notificación push

### API del matching engine

| Endpoint | Método | Propósito |
|---|---|---|
| `/health` | GET | Estado del servicio e índice FAISS |
| `/embed` | POST | Genera y cifra el vector de identidad |
| `/match` | POST | Encuentra el mejor match del día |
| `/feedback` | POST | Señales de comportamiento (saved/ignored/long_session) |
| `/index/rebuild` | POST | Reconstruye el índice FAISS (cada 6h en producción) |

Autenticación: HMAC con `X-Service-Key` header — nunca JWT de usuario.

---

## 6. Pantallas implementadas

### (auth)
- `login.tsx` — email + password, redirect según estado de onboarding
- `register.tsx` — registro con verificación de edad y consentimiento parental para <16

### (onboarding)
- `question/[step].tsx` — OnboardingQuestionScreen con animaciones Reanimated, progreso visual, validación mínima 10 caracteres, submit al completar paso 5

### (app)
- `home.tsx` — match del día con perfil anónimo (depth_score, city, member_since), animación de entrada, estado vacío hasta las 18:00
- `chat/[matchId].tsx` — mensajes en tiempo real (Supabase Realtime), optimistic updates, contador de 72h con color urgente <6h, botón de guardar contacto tras 10 mensajes
- `contacts.tsx` — lista de contactos guardados con avatar generativo (color + símbolo determinista por user_id), último mensaje, pull-to-refresh, empty state
- `capsule.tsx` — visualización SVG abstracta única por seed, selector de semanas anteriores, stats, botón de share nativo, empty state primera semana
- `profile.tsx` — avatar generativo, DepthMeter animado con 5 niveles (Explorando/Conectando/Profundo/Muy profundo/Esencial), stats totales, editor de ciudad, InviteCard (3 palabras + share), cerrar sesión, solicitar datos (GDPR), eliminar cuenta con confirmación y soft delete

---

## 7. Componentes reutilizables

| Componente | Propósito |
|---|---|
| `Avatar` | Círculo con color HSL y símbolo deterministas por user_id |
| `StatCard` | Tarjeta de métrica con label y valor |
| `EmptyState` | Estado vacío con título, subtítulo y acción opcional |
| `SectionHeader` | Cabecera de sección con título y subtítulo opcional |
| `DepthMeter` | Barra de progreso animada con 5 niveles de profundidad |
| `InviteCard` | Formulario de invite con 3 palabras + share nativo |
| `CapsuleVisual` | SVG generativo único por seed (círculos = conversaciones, líneas = contactos) |
| `MessageBubble` | Burbuja de mensaje con estilo propio/ajeno |

---

## 8. Sistema de diseño

```typescript
// Paleta principal
purple400: "#7F77DD"   // Accent principal
teal400:   "#1D9E75"   // Success / depth positivo
gray900:   "#1A1A18"   // Texto oscuro

// Tokens
spacing: { xs:4, sm:8, md:16, lg:24, xl:40 }
radius:  { sm:8, md:12, lg:20, full:999 }
animation: { fast:200, normal:350, slow:600 }

// Tipografía
h1: { fontSize:28, fontWeight:"500" }
h2: { fontSize:22, fontWeight:"500" }
body: { fontSize:16, fontWeight:"400", lineHeight:24 }
sm:  { fontSize:13, fontWeight:"400", lineHeight:18 }
```

Dark mode automático vía `useColorScheme()` en todos los componentes.

---

## 9. Analytics y monitorización

### PostHog — solo 5 eventos (privacidad estricta)
```
onboarding_started       → al iniciar el onboarding
onboarding_completed     → al completar las 5 preguntas
match_received           → al recibir el match del día
conversation_started     → al enviar el primer mensaje
contact_saved            → al guardar un contacto
```

**Reglas de privacidad en analytics:**
- IDs de usuario hasheados con SHA-256 (nunca el ID real)
- Nunca trackear contenido de mensajes ni respuestas del onboarding
- Nunca enviar email ni datos identificables
- Servidor europeo de PostHog (GDPR)

### Sentry — errores en tiempo real
- Filtrar errores de red offline (esperados)
- Filtrar AbortError (cancelaciones del usuario)
- Nunca capturar breadcrumbs de input (podrían contener texto de mensajes)
- URLs sanitizadas (sin query params en reportes)

### Dashboard de métricas (scripts/metrics-dashboard.ts)
Actualización cada 30 segundos. Métricas monitorizadas:
- Total usuarios registrados y tasa de onboarding completo
- Matches generados hoy
- Conversaciones activas (últimas 24h)
- Tasa de guardado (objetivo: >30%)
- Flags de moderación pendientes (alerta si >3)
- Latencia del matching engine (alerta si >2000ms)

---

## 10. Seguridad y compliance

### Modelo de amenazas (STRIDE)
- **Spoofing**: verificación parental obligatoria para <16, restricción de edad ±2 años en matching
- **Tampering**: RLS en PostgreSQL — imposible acceder a datos de otro usuario
- **Repudiation**: `sender_id` inmutable, flags de moderación retenidos 90 días
- **Information Disclosure**: vectores cifrados con pgsodium, solo service_role puede leerlos
- **DoS**: rate limiting en Edge Functions (1 request/minuto por usuario), 1 match por día
- **Elevation of Privilege**: JWT RS256 validado por Supabase, service key nunca toca el cliente

### Compliance regulatorio
- **COPPA** (EE.UU.): verificación de edad, restricciones para <13
- **DSA Art. 28** (Europa): consentimiento parental por email para <16
- **GDPR**: right to erasure implementado, soft delete + purga en 30 días, datos anonimizados en analytics
- **LOPD** (España): DPO designado, ROPA registrado

### Cifrado
- En tránsito: TLS 1.3 forzado, certificate pinning en la app (react-native-ssl-pinning)
- En reposo: pgsodium para columnas sensibles, Fernet para vectores en el engine
- Borrado verificable: soft delete de usuarios + purga física a 30 días

---

## 11. Scripts de operaciones

| Script | Propósito |
|---|---|
| `scripts/verify-integration.ts` | Verifica que las 3 capas están conectadas (10 checks) |
| `scripts/security-audit.ts` | Auditoría de seguridad OWASP Mobile Top 10 adaptada |
| `scripts/seed-team.ts` | Crea los 4 usuarios del equipo en staging |
| `scripts/metrics-dashboard.ts` | Dashboard de métricas en tiempo real (actualiza cada 30s) |
| `scripts/evaluate_matching.py` | Evalúa la calidad del matching con métricas proxy |
| `scripts/generate-assets.js` | Genera assets placeholder (icon, splash) |

---

## 12. Variables de entorno

### apps/mobile (.env.staging / .env.production)
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_MATCHING_ENGINE_URL
EXPO_PUBLIC_SENTRY_DSN
EXPO_PUBLIC_POSTHOG_KEY
EXPO_PUBLIC_ENV
EXPO_PUBLIC_PROJECT_ID
```

### apps/backend (Supabase Secrets)
```
MATCHING_ENGINE_URL
MATCHING_ENGINE_KEY
```

### services/matching-engine (.env.local)
```
SERVICE_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY         # Fernet key en base64
DP_EPSILON=0.5
DP_DELTA=0.00001
MODEL_NAME=paraphrase-multilingual-mpnet-base-v2
```

---

## 13. CI/CD

### PR workflow (pr.yml)
- Lint con Biome
- Type-check con tsc
- Tests unitarios con Jest (cobertura mínima 80%)
- Tests Python con pytest (cobertura mínima 85%)
- Comentario automático con reporte de cobertura en el PR

### Main workflow (main.yml)
- Todo lo anterior + tests de integración
- Deploy de Edge Functions a Supabase
- Build de staging con EAS

### Release workflow (release.yml)
- Build de producción firmado para iOS y Android
- Submit automático a App Store y Google Play con EAS Submit
- Tag de versión automático
- Deploy de Edge Functions a producción

---

## 14. Métricas de North Star (primeros 6 meses)

| Métrica | Objetivo | Estado |
|---|---|---|
| D7 retention | >35% | Por medir |
| Tasa de contactos guardados | >30% de matches | Por medir |
| Invite rate | >30% de usuarios usan su invite semanal | Por medir |

### Señales para Serie A
- 500.000 MAU con D30 retention >35%
- NPS >70
- Al menos una ciudad con densidad suficiente para demostrar efecto de red
- Primeras señales de conversión a Pulse Deep (3–4%)

---

## 15. Modelo de negocio

### Pulse Free (siempre gratis)
- 1 conexión diaria
- Conversaciones ilimitadas con contactos guardados
- Cápsulas semanales
- 1 invite semanal

### Pulse Deep (~4,99€/mes)
- Hasta 3 conexiones diarias
- Audio efímero en conversaciones
- Preguntas guiadas avanzadas
- Pulse del mundo (conexiones fuera de tu ciudad)

### Estimación con 10M MAU
- 8% conversión → 800.000 usuarios de pago
- 800.000 × 4,99€ = ~48M€ ARR
- ARPU blended: ~4,80€/mes
- LTV estimado (retención 18 meses): ~86€/usuario de pago

---

## 16. Equipo y roles

| Rol | Responsabilidad | Stack |
|---|---|---|
| Perfil 1 — Fullstack / Tech Lead | Monorepo, backend, navegación, CI/CD | React Native, Supabase, Deno, GitHub Actions |
| Perfil 2 — ML Engineer | Matching engine, embeddings, privacidad diferencial | Python, FastAPI, sentence-transformers, FAISS |
| Perfil 3 — Mobile Engineer | Pantallas de contactos, cápsula, perfil | React Native, Reanimated, react-native-svg |
| Perfil 4 — Founder / Product & Ops | Legal, compliance, primeros usuarios, inversores | — |

---

## 17. Estado actual del proyecto

### Completado
- Concepto de producto y propuesta de valor
- Arquitectura completa (ADRs documentados)
- Schema de base de datos con RLS en todas las tablas
- 5 Edge Functions implementadas y testeadas
- Matching engine completo con FAISS, privacidad diferencial y cifrado
- Frontend completo: todas las pantallas del MVP
- Sistema de diseño con dark mode
- CI/CD configurado
- Scripts de integración, auditoría y monitorización

### Completado — Semana 9 (dispositivo real)
- [x] Node.js v24.14.1 instalado en Windows
- [x] EAS CLI v18.6.0 instalado
- [x] Git v2.53.0 instalado en Windows
- [x] Cuenta Expo creada — username: **pulse-app73**
- [x] Proyecto vinculado — ID: **0eeaa082-4aeb-47df-9699-f30d621983fb**
- [x] Project URL: https://expo.dev/accounts/pulse-app73/projects/pulse-mobile
- [x] GitHub: https://github.com/SLH73/pulse-mobile (privado)
- [x] Expo Go instalado en Samsung Galaxy A32 5G
- [x] Servidor local con `npx expo start` funcionando

### MVP visual completo — todas las pantallas funcionando
- [x] Onboarding 5 preguntas con barra de progreso y validación
- [x] Home con match simulado, stats, contador 72h y botón de conversación
- [x] Chat con burbujas de mensajes propios y ajenos
- [x] Contactos con avatares generativos y lista
- [x] Cápsula semanal con visual generativo y selector de semanas
- [x] Perfil con DepthMeter animado, stats y acciones

### Completado — Backend conectado
- [x] Cuenta Supabase creada — proyecto: pulse-mobile
- [x] Project ID: ynjszpegtmtemckwgovr
- [x] Project URL: https://ynjszpegtmtemckwgovr.supabase.co
- [x] Publishable key: sb_publishable_CG8y4ZhlRKyQSFRqH8Fw4A_kbUAw0xe
- [x] Tablas creadas: users, daily_matches, messages, saved_contacts
- [x] RLS activado en todas las tablas
- [x] Autenticación email funcionando (confirm email desactivado para dev)
- [x] Registro → Onboarding → datos guardados en tabla users ✓
- [x] Cliente Supabase en src/lib/supabase.ts
- [x] Variables de entorno en .env.local

### Próximo paso — datos reales
- [x] Chat en tiempo real con Supabase Realtime ✓
- [x] Match del día real entre dos usuarios reales ✓
- [x] Contactos reales desde tabla saved_contacts ✓
- [x] Botón "Guardar" en chat funcional ✓
- [x] increment_depth_score función en Supabase ✓
- [x] Notificaciones locales diarias a las 18:00 ✓
- [ ] Notificaciones push remotas (servidor → móvil)
- [x] Prueba del equipo completada ✓ — chat bidireccional verificado entre test2 y test3
- [x] Matching engine desplegado en Railway ✓
  - URL: https://pulse-matching-engine-production.up.railway.app
  - GitHub: https://github.com/SLH73/pulse-matching-engine

### Problema resuelto — Expo Go
- Expo Go no cargaba → móvil y ordenador estaban en redes WiFi diferentes
- Solución: conectar ambos a la misma red WiFi

### Credenciales Supabase
```
Project ID:      ynjszpegtmtemckwgovr
URL:             https://ynjszpegtmtemckwgovr.supabase.co
Publishable key: sb_publishable_CG8y4ZhlRKyQSFRqH8Fw4A_kbUAw0xe
Organización:    Pulse App
Plan:            Free
```

### Problemas resueltos durante el setup
- AVG bloqueaba escritura de package-lock.json → mover proyecto a C:\Users\Javi\proyectos\ y añadir a exclusiones de AVG
- react-native-reanimated 3.x incompatible con react-native 0.81.5 → eliminar del build base, añadir al integrar código Pulse
- npm ci fallaba en EAS → .npmrc con legacy-peer-deps=true
- App crasheaba al arrancar → añadir app/_layout.tsx y app/index.tsx mínimos
- react-native-worklets-core instalado como dependencia de reanimated → también eliminado del build base

### Pendiente — Semanas 10–12
- Lista de espera de 200 usuarios en ciudad piloto (Madrid)
- Activación del geofencing por ciudad
- Reclutamiento de primeros usuarios
- Briefing al equipo de moderación
- Análisis de métricas D1 y D7
- Decisión de expansión o iteración

### Datos del entorno de desarrollo (Windows)
```
Máquina:        Windows (C:\Users\Javi\proyectos\pulse-mobile)
Node.js:        v24.14.1
EAS CLI:        v18.6.0
Git:            v2.53.0.windows.2
GitHub:         https://github.com/SLH73/pulse-mobile (privado)
GitHub usuario: SLH73
Expo account:   pulse-app73
Project ID:     0eeaa082-4aeb-47df-9699-f30d621983fb
Dispositivo:    Samsung Galaxy A32 5G (Android)
App package:    com.pulseapp73.pulsemobile
AVG Antivirus:  añadir C:\Users\Javi\proyectos a exclusiones para evitar bloqueos npm
```

### Cómo continuar desde otro PC
```bash
git clone https://github.com/SLH73/pulse-mobile.git
cd pulse-mobile
npm install --legacy-peer-deps
npm install -g eas-cli
eas login  # usuario: pulse-app73
eas build --platform android --profile preview --non-interactive
```

---

## 18. Comandos de uso frecuente

```bash
# Arrancar entorno local completo
npm run dev                              # Turbo dev en todos los workspaces
supabase start                           # Base de datos local
docker-compose up                        # Matching engine local

# Base de datos
supabase db reset                        # Reset completo con seed
supabase migration new nombre            # Nueva migration
supabase db push                         # Aplicar migrations a staging

# Tests
npx turbo test                           # Todos los tests
pytest services/matching-engine/tests/   # Solo tests del engine
npx ts-node scripts/verify-integration.ts # Verificación E2E

# Builds
eas build --platform android --profile staging    # APK para Android
eas build --platform ios --profile staging        # Build para iOS
eas build:list                                    # Ver builds activos

# Operaciones
npx ts-node scripts/security-audit.ts   # Auditoría de seguridad
npx ts-node scripts/metrics-dashboard.ts # Dashboard en tiempo real
python scripts/evaluate_matching.py      # Calidad del matching

# Deploy
supabase functions deploy                # Deploy Edge Functions
railway up                               # Deploy matching engine
```

---

## 19. Decisiones de arquitectura (ADRs resumen)

| ADR | Decisión | Razón principal |
|---|---|---|
| ADR-001 | Supabase sobre Firebase | RLS granular, migraciones SQL auditables, pgsodium nativo |
| ADR-002 | On-device ML para updates | El comportamiento del usuario nunca sale del dispositivo |
| ADR-003 | Mensajería propia sobre Stream/Sendbird | Control total del ciclo de vida, sin tercer procesador de datos de menores |
| ADR-004 | FAISS IVFFlat para escalado | Matching aproximado O(log n) con recall >95% |
| ADR-005 | Verificación parental por email | Mecanismo legalmente defendible ante AEPD sin fricción extrema |

---

## 20. Contexto para continuar con IA

Si retomas este proyecto en una nueva sesión, proporciona este fichero completo al modelo y añade:

```
Estado actual: [describe qué acabas de hacer o qué quieres hacer]
Fichero activo: [ruta del fichero en el que estás trabajando]
Problema: [si hay un error, pégalo aquí completo]
```

El modelo tiene contexto completo del producto, arquitectura, stack, código y estado del proyecto con este fichero.
