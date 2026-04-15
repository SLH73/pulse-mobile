# CONTEXT.md — Proyecto Pulse
> Documento de contexto completo del proyecto. Última actualización: abril 2026 — todas las mejoras del roadmap implementadas.
> Usar este fichero para onboarding de nuevos desarrolladores, continuación de sesiones con IA, y referencia técnica del estado del proyecto.

---

## 1. Qué es Pulse

Pulse es una app para adolescentes de 13–19 años que conecta a cada usuario con una persona real al día, elegida por compatibilidad de identidad profunda. No es una red social. No hay feed público, no hay métricas de vanidad, no hay publicidad.

**La promesa:** *Una conexión real al día. Eso es todo lo que necesitas para cambiar cómo una generación entiende la amistad.*

### Mecánica principal
- El usuario completa un onboarding de 5 preguntas emocionales (no un formulario de intereses)
- Cada día el usuario indica su estado emocional (escuchar / hablar / estar) antes de recibir su match
- Cada día a las 18:00 recibe una notificación push con su "Pulse del día" — una persona real con alta compatibilidad de identidad
- La conversación es efímera: desaparece en 72 horas si no se guarda el contacto
- Para guardar un contacto se necesitan al menos 3 mensajes — la profundidad se gana
- Si ambos guardan mutuamente → el chat se extiende 72h más (máximo 3 extensiones = 7 días), luego conexión permanente
- Cada semana se genera una "cápsula": una visualización abstracta única de las conversaciones de esa semana, compartible en redes
- Cada 90 días se muestra una "revisión de identidad" con 2 preguntas nuevas para actualizar el vector de matching

### Por qué es diferente
- Hinge resolvió el amor. Pulse resuelve la amistad adolescente.
- El estatus en Pulse no se gana siendo popular, se gana siendo profundo.
- La viralidad está integrada en el producto: las cápsulas semanales, el invite de alta fricción (3 palabras), los "Pulses compartidos" cuando dos conocidos se emparejan, y la tarjeta viral de conexión compartible.

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
| Moderación | Claude API (claude-haiku-4-5-20251001) | Moderación proactiva de mensajes en tiempo real |
| Notificaciones | Expo Notifications + Expo Push API | Push nativo iOS y Android sin configuración FCM/APNs directa |
| Suscripciones | RevenueCat | Gestión de Pulse Deep (4,99€/mes) |
| Panel parental | Next.js + Vercel | App web separada, gratuita |
| CI/CD | GitHub Actions + EAS Build | PR checks, deploy automático, builds firmados |
| Monitorización | Sentry + PostHog (EU) | Errores en tiempo real, funnel de producto |

---

## 3. Estructura del proyecto

```
C:\Users\slope\
├── pulse-mobile\                   # App React Native + Expo
│   ├── app\
│   │   ├── auth\                   # login.tsx, register.tsx
│   │   ├── onboarding\             # step0-4.tsx, _layout.tsx
│   │   ├── home\                   # index.tsx
│   │   ├── chat\                   # [id].tsx
│   │   ├── contacts\               # index.tsx
│   │   ├── capsule\                # index.tsx
│   │   ├── profile\                # index.tsx
│   │   ├── admin\                  # index.tsx (solo admin@pulseapp.es)
│   │   ├── legal\                  # privacy.tsx, terms.tsx
│   │   ├── mood.tsx                # Estado emocional diario
│   │   ├── review.tsx              # Revisión de identidad cada 90 días
│   │   ├── deep.tsx                # Pantalla de suscripción Pulse Deep
│   │   ├── index.tsx
│   │   └── _layout.tsx
│   ├── src\
│   │   ├── lib\
│   │   │   ├── supabase.ts
│   │   │   ├── moderation.ts       # Moderación con Claude API
│   │   │   ├── notifications.ts    # Registro de token push
│   │   │   └── revenuecat.ts       # Wrapper RevenueCat
│   │   └── ...
│   └── supabase\
│       └── functions\
│           └── notify-match\       # Edge Function: push tras generar match
│               └── index.ts
├── pulse-matching-engine\          # FastAPI en Railway
│   ├── main.py                     # Endpoints: /health /embed /match
│   ├── requirements.txt
│   └── Dockerfile
└── pulse-parental\                 # Next.js en Vercel
    └── app\
        ├── page.tsx
        ├── layout.tsx
        └── components\
            ├── LoginForm.tsx
            └── Dashboard.tsx
```

---

## 4. Base de datos — Schema completo

### Tablas

| Tabla | Propósito | RLS |
|---|---|---|
| `users` | Perfil del usuario | Solo el propio usuario |
| `identity_vectors` | Vector de identidad | Solo service_role |
| `daily_matches` | Match diario entre dos usuarios (TTL 72h extensible) | Solo participantes |
| `messages` | Mensajes efímeros (TTL 72h, borrado físico) | Solo participantes |
| `saved_contacts` | Contactos guardados | Solo el propio usuario |
| `weekly_capsules` | Resumen semanal | Solo el propio usuario |
| `invites` | Invitaciones con 3 palabras | Solo el invitador |
| `moderation_flags` | Reportes de moderación automática | Solo inserción propia |
| `waitlist` | Lista de espera landing page | Solo inserción |

### Columnas clave añadidas

**users:**
- `daily_mood` — listen / talk / rest (estado emocional del día)
- `mood_updated_at` — timestamp del último mood
- `last_identity_review` — fecha de última revisión de identidad (90 días)
- `expo_push_token` — token de notificaciones push del dispositivo
- `is_deep` — boolean: suscripción Pulse Deep activa
- `deep_since` — fecha de activación de Pulse Deep
- `deep_expires_at` — fecha de expiración de Pulse Deep
- `is_paused` — boolean: app pausada por padre/tutor
- `parental_email` — email del padre/tutor para panel parental
- `deletion_requested_at` — soft delete
- `is_junior` — generada: true si menor de 16

**daily_matches:**
- `saved_by_a` — boolean: user_a ha guardado
- `saved_by_b` — boolean: user_b ha guardado
- `mutual_save_count` — número de extensiones mutuas (máx 3)

### Funciones SQL

| Función | Propósito |
|---|---|
| `handle_mutual_save(match_id, user_id)` | Gestiona el guardado mutuo y extensión del chat |
| `increment_depth_score(user_id)` | Suma 1 punto de profundidad |
| `set_daily_mood(user_id, mood)` | Guarda el estado emocional del día |
| `complete_identity_review(user_id)` | Marca la revisión de identidad como completada |
| `get_admin_metrics()` | Agrega métricas para el dashboard admin |
| `save_push_token(user_id, token)` | Guarda el token push del dispositivo |
| `set_deep_status(user_id, is_deep, expires_at)` | Activa/desactiva Pulse Deep |
| `is_user_paused(user_id)` | Comprueba si el usuario está pausado |
| `get_today_match(user_id)` | Obtiene el match del día del usuario |

### Edge Functions

| Función | Propósito |
|---|---|
| `notify-match` | Envía notificación push via Expo API tras generar un match |
| `onboarding` | Genera y cifra el vector de identidad |
| `match` | Encuentra el mejor match del día |
| `messages` | Envía mensajes |
| `contacts` | Guarda contactos |
| `invites` | Gestiona invitaciones |

---

## 5. Matching engine — cómo funciona

### Pipeline de matching diario
1. POST /match para cada usuario
2. Carga vectores de candidatos desde Supabase
3. Scoring: cosine_similarity + geo_boost (misma ciudad) + mood_boost (moods complementarios listen↔talk)
4. Inserta match en `daily_matches`
5. Llama a Edge Function `notify-match` para ambos usuarios → push a las 18:00

### Mood boost
- `listen` ↔ `talk` → +0.10 al score de compatibilidad
- `rest` → neutral, sin boost ni penalización

### API del matching engine (Railway)
- URL: https://pulse-matching-engine-production.up.railway.app
- GitHub: https://github.com/SLH73/pulse-matching-engine

| Endpoint | Método | Propósito |
|---|---|---|
| `/health` | GET | Estado del servicio |
| `/embed` | POST | Genera vector de identidad |
| `/match` | POST | Encuentra el mejor match + envía push |

---

## 6. Pantallas implementadas

### (auth)
- `login.tsx` — email + password
- `register.tsx` — registro con verificación de edad y consentimiento parental

### Flujo de entrada (home)
El home comprueba en orden:
1. ¿Han pasado 90 días? → `/review` (revisión de identidad)
2. ¿Tiene mood de hoy? → `/mood` (estado emocional)
3. Todo OK → muestra el match del día

### Pantallas principales
- `mood.tsx` — 3 opciones: Necesito escuchar / Quiero hablar / Solo estar
- `review.tsx` — 2 preguntas nuevas cada 90 días para actualizar el vector
- `home/index.tsx` — match del día con badge de mood y timer real
- `chat/[id].tsx` — chat en tiempo real con moderación, extensión mutua, tarjeta viral
- `contacts/index.tsx` — lista de contactos guardados
- `capsule/index.tsx` — visualización SVG generativa semanal
- `profile/index.tsx` — DepthMeter, badge Deep, acceso a Pulse Deep, link admin
- `deep.tsx` — pantalla de suscripción Pulse Deep con RevenueCat
- `admin/index.tsx` — dashboard de métricas (solo admin@pulseapp.es)

---

## 7. Moderación

### Claude API (Haiku)
- Antes de enviar cada mensaje → llamada a Claude Haiku
- Analiza: toxicity, threat, sexually_explicit (scores 0.0–1.0)
- Score > 0.8 → mensaje bloqueado, banner rojo en el chat
- Score > 0.9 → además se inserta flag en `moderation_flags` para revisión manual
- Sin API key → moderación desactivada silenciosamente (modo dev)

### Variables de entorno
```
EXPO_PUBLIC_ANTHROPIC_KEY=sk-ant-...
```

---

## 8. Notificaciones push remotas

### Flujo
1. Al iniciar sesión → `registerPushToken()` pide permisos y guarda token en Supabase
2. Matching engine genera match → llama a Edge Function `notify-match`
3. Edge Function lee token de Supabase → envía push via Expo Push API
4. Usuario recibe: "Tu Pulse de hoy — Alguien te está esperando. Tienes 72h para conectar."

### Sin configuración adicional necesaria
Expo Push API actúa como intermediario de FCM/APNs. No requiere configurar Google Cloud ni Apple Developer para el MVP.

---

## 9. Monetización — Pulse Deep

### RevenueCat
- Proyecto: Pulse (ID: 185bf0ce)
- Entitlement: `pulse_deep`
- API key Android: `test_FJkNKIYCGitzQvcxpLOXansfcRY` (reemplazar por producción antes del lanzamiento)

### Beneficios Pulse Deep (4,99€/mes)
- Hasta 3 conexiones diarias
- Explicación de compatibilidad en el match
- Historial de cápsulas ilimitado
- Estadísticas avanzadas del DepthMeter
- Badge "Profundo" visible en el perfil

### Pendiente para producción
- Configurar producto `pulse_deep_monthly` en Google Play Console con precio 4,99€
- Vincular producto en RevenueCat dashboard
- Reemplazar API key test por producción

---

## 10. Panel parental

- URL: https://pulse-parental.vercel.app (pendiente dominio personalizado)
- GitHub: https://github.com/SLH73/pulse-parental
- Acceso: con el email que el menor introdujo como "email parental" al registrarse

### Muestra (sin revelar nombres ni mensajes)
- Nivel de profundidad 1-5
- Conexiones de la semana
- Contactos guardados
- Tendencia de bienestar social
- Botón para pausar la app del menor

---

## 11. Seguridad y compliance

### Moderación automática
- Claude API modera cada mensaje antes de enviarlo
- Flags automáticos para revisión manual si score > 0.9
- Registros retenidos 90 días para auditoría

### Compliance regulatorio
- COPPA (EE.UU.): verificación de edad, restricciones para <13
- DSA Art. 28 (Europa): consentimiento parental por email para <16
- GDPR: right to erasure, soft delete + purga en 30 días
- LOPD (España): DPO designado, ROPA registrado

---

## 12. Analytics — solo 5 eventos (privacidad estricta)

```
onboarding_started
onboarding_completed
match_received
conversation_started
contact_saved
```

IDs hasheados con SHA-256. Nunca contenido de mensajes ni datos identificables. Servidor europeo de PostHog.

---

## 13. Variables de entorno

### pulse-mobile (.env.local)
```
EXPO_PUBLIC_SUPABASE_URL=https://ynjszpegtmtemckwgovr.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_CG8y4ZhlRKyQSFRqH8Fw4A_kbUAw0xe
EXPO_PUBLIC_MATCHING_ENGINE_URL=https://pulse-matching-engine-production.up.railway.app
EXPO_PUBLIC_ANTHROPIC_KEY=sk-ant-...
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=test_FJkNKIYCGitzQvcxpLOXansfcRY
EXPO_PUBLIC_PROJECT_ID=0eeaa082-4aeb-47df-9699-f30d621983fb
```

### pulse-matching-engine (.env)
```
SERVICE_KEY=...
SUPABASE_URL=https://ynjszpegtmtemckwgovr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

### pulse-parental (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://ynjszpegtmtemckwgovr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_CG8y4ZhlRKyQSFRqH8Fw4A_kbUAw0xe
```

---

## 14. Credenciales y accesos

```
Supabase Project ID:      ynjszpegtmtemckwgovr
Supabase URL:             https://ynjszpegtmtemckwgovr.supabase.co
Supabase Publishable key: sb_publishable_CG8y4ZhlRKyQSFRqH8Fw4A_kbUAw0xe
Expo account:             pulse-app73
Expo Project ID:          0eeaa082-4aeb-47df-9699-f30d621983fb
GitHub usuario:           SLH73
RevenueCat Project ID:    185bf0ce
Admin email:              admin@pulseapp.es
Dispositivo de prueba:    Samsung Galaxy A32 5G
```

---

## 15. Estado actual del proyecto — abril 2026

### Completado — App mobile
- [x] Onboarding 5 preguntas con barra de progreso
- [x] Estado emocional diario (mood) antes del match
- [x] Revisión de identidad cada 90 días
- [x] Home con match real, stats, timer y badge de mood
- [x] Chat en tiempo real con Supabase Realtime
- [x] Moderación proactiva con Claude API
- [x] Extensión mutua del chat (72h x3 → permanente)
- [x] Tarjeta viral compartible en mutual save
- [x] Contactos reales desde saved_contacts
- [x] Cápsula semanal con visual generativo
- [x] Perfil con DepthMeter, badge Deep, InviteCard
- [x] Pantalla Pulse Deep con RevenueCat
- [x] Dashboard admin (solo admin@pulseapp.es)
- [x] Notificaciones push remotas via Expo Push API
- [x] Notificaciones locales diarias a las 18:00
- [x] Verificación de edad (13-19) en registro
- [x] Consentimiento parental menores de 14
- [x] Política de privacidad y términos completos
- [x] Botón eliminar cuenta con soft delete
- [x] Prueba bidireccional verificada entre test2 y test3

### Completado — Backend e infraestructura
- [x] Supabase con todas las tablas y RLS
- [x] 10+ funciones SQL implementadas
- [x] Edge Functions: notify-match + onboarding + match + messages + contacts + invites
- [x] Matching engine en Railway con boost de mood
- [x] Panel parental en Vercel
- [x] Landing page con lista de espera
- [x] RevenueCat configurado (entitlement pulse_deep)

### Pendiente antes del 1 de mayo
- [ ] Notificaciones push: probar en Samsung Galaxy A32 5G
- [ ] Llegar a 200 usuarios en lista de espera Madrid
- [ ] Configurar producto en Google Play Console para Pulse Deep
- [ ] Reemplazar API key test de RevenueCat por producción
- [ ] Activación del geofencing por ciudad
- [ ] Briefing al equipo de moderación

---

## 16. Métricas de North Star (primeros 6 meses)

| Métrica | Objetivo | Estado |
|---|---|---|
| D7 retention | >35% | Por medir |
| Tasa de contactos guardados | >30% de matches | Por medir |
| Invite rate | >30% de usuarios usan su invite semanal | Por medir |

---

## 17. Modelo de negocio

### Pulse Free (siempre gratis)
- 1 conexión diaria
- Conversaciones ilimitadas con contactos guardados
- Cápsulas semanales (últimas 4 semanas)
- 1 invite semanal

### Pulse Deep (4,99€/mes)
- Hasta 3 conexiones diarias
- Explicación de compatibilidad en el match
- Historial de cápsulas ilimitado
- Estadísticas avanzadas del DepthMeter
- Badge "Profundo" visible en el perfil

---

## 18. Datos del entorno de desarrollo

```
Máquina:        Windows (C:\Users\slope\)
Node.js:        v24.14.1
EAS CLI:        v18.6.0
Git:            v2.53.0.windows.2
GitHub:         https://github.com/SLH73/pulse-mobile (privado)
GitHub usuario: SLH73
Expo account:   pulse-app73
Project ID:     0eeaa082-4aeb-47df-9699-f30d621983fb
Dispositivo:    Samsung Galaxy A32 5G (Android)
App package:    com.pulseapp73.pulsemobile
AVG Antivirus:  añadir C:\Users\slope\ a exclusiones para evitar bloqueos npm
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

## 19. Comandos de uso frecuente

```bash
# App mobile
cd C:\Users\slope\pulse-mobile
npx expo start                    # Arrancar en local
git add . && git commit -m "..." && git push origin master

# Matching engine
cd C:\Users\slope\pulse-matching-engine
git add . && git commit -m "..." && git push origin master

# Panel parental
cd C:\Users\slope\pulse-parental
git add . && git commit -m "..." && git push origin master
# Deploy automático en Vercel al hacer push

# Edge Functions
npx supabase functions deploy notify-match --project-ref ynjszpegtmtemckwgovr
npx supabase login  # si pide autenticación

# Builds
eas build --platform android --profile staging
eas build:list
```

---

## 20. Contexto para continuar con IA

Si retomas este proyecto en una nueva sesión, proporciona este fichero completo al modelo y añade:

```
Estado actual: [describe qué acabas de hacer o qué quieres hacer]
Fichero activo: [ruta del fichero en el que estás trabajando]
Problema: [si hay un error, pégalo aquí completo]
```

El modelo tiene contexto completo del producto, arquitectura, stack, código y estado del proyecto con este fichero.
