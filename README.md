# 🎮 Game Recommender

**Multiplayer game recommender for groups of friends, based on each member's Steam library.**

Each group member provides their SteamID. The app analyzes what each person plays (and for how long), builds a taste profile based on game *tags*, and returns a list of games the group **doesn't own yet** that match what everyone enjoys, within an optional per-member budget.

> 🔗 **Live demo:** _[game-recommender.marianonehuenlr.workers.dev](https://game-recommender.marianonehuenlr.workers.dev/)_ &nbsp;·&nbsp; the **"Ver ejemplo"** button on the home page opens a pre-built example group.
>
> ⏳ The backend runs on a free tier, so the first load may take up to a minute while the server wakes up.
>
> 🌐 The UI is currently in Spanish.

---

## The problem

Choosing what to play with several people is hard: everyone has different tastes, and nobody wants to buy a game the rest won't enjoy. Game Recommender automates that decision using real play data (hours played) instead of declared preferences.

## Features

- **Temporary groups** of 1 to 12 players, identified by a shareable access code (UUID). Groups expire after 24 hours.
- **Member validation before creating a group**: detects non-existent SteamIDs, private profiles and inaccessible libraries, and reports them in the UI.
- **Transparent group profile**: shows which of each member's games were taken into account and how much each member contributed to the group's tags (playtime is never exposed, for privacy).
- **Recommendations split into paid and free**, up to 100 of each, with score, reviews, price, shared tags and a link to the Steam store.
- **Optional per-member budget**: only games priced at or below it are recommended, so everyone in the group can afford them.
- **Multiplayer games only**, excluding games any member already owns and VR titles.

## How the algorithm works

1. **Individual profile.** Games with at least 5 hours played are considered, keeping the 20 most played. Each game's playtime is split across its tags (excluding generic ones like *Multiplayer* or *Co-op*, which say nothing about taste) and normalized into a per-tag preference vector.
2. **Group profile.** Member vectors are aggregated. Tags are ranked first by **how many members share them**, then by score, and the top 20 are kept. This favors what brings the group together over a single person's taste.
3. **Candidate generation (SQL).** A PostgreSQL query selects multiplayer games matching at least 3 group tags, with a good reputation (≥ 55% positive reviews, or no reviews), priced within the per-member budget and not VR, and keeps the top 300.
4. **Scoring.** For each candidate:

   ```
   score = Σ_tag ( group_score(tag) × IDF(tag) × normalized_tag_weight_in_game(tag) )
           + 0.15 × (positive review ratio) × confidence(review count)
   ```

   - **IDF**: rare tags weigh more than ubiquitous ones (*Indie*, *Action*), which would otherwise dominate every recommendation.
   - **Tag weight in game**: how strongly the Steam community associates that tag with the game, based on user votes.
   - **Confidence**: `min(log10(reviews + 1) / 5, 1)`, so a game with 10 perfect reviews doesn't outrank one with 50,000 very good ones.

## Notable technical decisions

| Topic | Decision |
|---|---|
| **Steam profile cache** | Name, avatar and library are stored in PostgreSQL with a 7-day TTL (configurable). If Steam fails transiently (network, 429, 5xx), the stale profile is served instead of breaking the experience. Private profiles are never cached. |
| **Performance** | The IDF denominator (`Tag.gameCount`) is precomputed by a script instead of counting the whole `GameTag` table on every request. The group profile and the IDF are resolved in parallel, and the profile is exposed on its own endpoint so it can be shown before recommendations finish. A read-only script measures each stage (`scripts/measure-recommendations.js`). |
| **Custom data pipeline** | The game catalog is built by scripts that consume the Steam API and Store, with tested discard rules (DLC, demos, unreleased games, invalid items). |
| **Input validation** | DTOs with `class-validator` and a global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`). |
| **Privacy** | Playtime and full libraries are never exposed; groups are ephemeral and there are no user accounts. |
| **Migrations** | Schema versioned with Prisma Migrations, plus a local → Supabase sync script with a prior backup and a confirmation at every step. |

## Tech stack

**Backend** — NestJS 11 · TypeScript · Prisma 7 (`pg` adapter) · PostgreSQL · Axios / Cheerio · Jest
**Frontend** — React 19 · Vite · TypeScript · Tailwind CSS 4 · shadcn/ui · TanStack Query · React Hook Form + Zod · React Router
**Infra** — PostgreSQL on Supabase · Frontend deployed as an SPA on Cloudflare (Workers Assets) · Data sources: Steam Web API, Steam Store and SteamSpy

## Architecture

```
┌──────────────┐   HTTPS   ┌────────────────────────────┐        ┌─────────────┐
│  React SPA   │ ────────► │  NestJS API                │ ─────► │ PostgreSQL  │
│  (Cloudflare)│           │  groups · steam ·          │        │ (Supabase)  │
└──────────────┘           │  recommendation · game     │        └─────────────┘
                           └────────────┬───────────────┘               ▲
                                        │ Steam Web API                 │ data-loading scripts
                                        ▼                               │ (games, tags, categories)
                                profiles and libraries  ────────────────┘
```

```
backend/src/modules/
├── groups/          # group creation and lookup, expiration, access code
├── steam/           # Steam clients, member validation, profile cache
├── recommendation/  # tag profiles, scoring and result building
├── game/            # game/tag access, candidates and IDF
└── steamspy/        # complementary data import
backend/src/scripts/ # data-loading pipeline (games, info, tags, categories, counts)
frontend/src/features/  # groups · home · recommendations (components + hooks per feature)
```

## API

| Method | Route | Description |
|---|---|---|
| `GET` | `/steam/validate-member/:steamId` | Checks that a profile exists and has an accessible library |
| `POST` | `/groups` | Creates a group (`name`, `budget?`, `memberSteamIds[]`) and returns its access code |
| `GET` | `/groups/:accessCode` | Group data (fails if expired) |
| `GET` | `/recommendations/:accessCode/profile` | Group profile: counted games and tags per member |
| `GET` | `/recommendations/:accessCode` | Paid and free recommendations |

## Running locally

**Requirements:** Node.js 20+, pnpm, PostgreSQL and a [Steam Web API key](https://steamcommunity.com/dev/apikey).

```bash
# Backend
cd backend
pnpm install
cp .env.example .env        # fill in DATABASE_URL and STEAM_API_KEY
pnpm prisma migrate deploy
pnpm prisma generate
pnpm start:dev              # http://localhost:3000

# Frontend (another terminal)
cd frontend
pnpm install
cp .env.example .env.local  # VITE_API_URL and (optional) VITE_EXAMPLE_ACCESS_CODE
pnpm dev
```

Backend environment variables: `DATABASE_URL`, `STEAM_API_KEY` and, optionally, `STEAM_PROFILE_CACHE_TTL_DAYS` (default 7).

**Populate the game catalog** (once, from `backend/`):

```bash
npx tsx src/scripts/populate-games.ts        # Steam app list
npx tsx src/scripts/populate-tags.ts         # tags
npx tsx src/scripts/populate-categories.ts   # categories (multiplayer, etc.)
npx tsx src/scripts/populate-games-info.ts   # price, reviews, tags per game
npx tsx src/scripts/compute-tag-counts.ts    # precomputation for the IDF
```

**Tests:** `pnpm test` (in `backend/`). They cover profile calculation, the Steam profile cache, member validation and the pipeline's discard rules.

## Possible improvements

- Weight by pairwise affinity between members, not just the group aggregate.
- Rate limiting and per-IP limits on group creation.
- End-to-end tests and CI with GitHub Actions.
- Periodic refresh of prices and reviews.

## Author

**Mariano Nehuén Lotero Rolón** — [GitHub](https://github.com/MarianoNLR)

---

_Personal portfolio project. Not affiliated with Valve or Steam._
