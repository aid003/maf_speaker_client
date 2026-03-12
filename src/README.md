# FSD (Feature-Sliced Design)

Слои без **pages** и **processes** — маршруты и страницы живут в `app` (Next.js App Router).

| Слой      | Путь        | Назначение                          |
|-----------|-------------|-------------------------------------|
| **app**   | `app/`      | Роутинг, layout, страницы (Next.js) |
| **widgets** | `widgets/` | Крупные блоки для страниц           |
| **features** | `features/` | Действия пользователя, фичи      |
| **entities** | `entities/` | Бизнес-сущности                   |
| **shared** | `shared/`   | UI, утилиты, конфиг                 |

Импорты — только через public API (index) и алиас `@/`:  
`@/shared`, `@/entities`, `@/features`, `@/widgets`.
