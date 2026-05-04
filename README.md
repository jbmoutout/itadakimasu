This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### With Docker (recommended)

Requires [OrbStack](https://orbstack.dev/) or Docker Desktop.

```bash
docker compose up -d
```

This starts a PostgreSQL database and the Next.js dev server with hot reload. The app is available at [http://localhost:3000](http://localhost:3000).

Your `.env` file is read automatically for `ANTHROPIC_API_KEY`. Database credentials are self-contained within the Docker network.

| Command | Description |
|---|---|
| `docker compose up -d` | Start Postgres + dev server |
| `docker compose exec app sh` | Shell into the container |
| `docker compose logs -f app` | Tail app logs |
| `docker compose down` | Stop everything |
| `docker compose down -v` | Stop + wipe DB data |

### Coding agents

The Docker image comes with [opencode](https://opencode.ai) and [mattpocock/skills](https://github.com/mattpocock/skills) pre-installed.

```bash
docker compose exec app sh   # shell into the container
opencode                      # launch the coding agent
```

opencode is configured to use **Qwen 3.5 9B** via OpenRouter (see `opencode.json`). Add your `OPENROUTER_API_KEY` to `.env` — see `.env.example`.

### Without Docker

```bash
npm install
npm run dev
```

Requires a PostgreSQL database configured via `DATABASE_URL` in `.env`.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

### Weekly Planner
- **AI-Powered Meal Planning**: Uses Claude AI to select 5 optimal recipes for the week
- **Smart Criteria**: Prioritizes healthy, seasonal (France-based), and ingredient-efficient recipes
- **Interactive Selection**: Accept or reject individual recipes with alternative suggestions
- **Seasonal Awareness**: Highlights ingredients currently in season
- **Ingredient Efficiency**: Optimizes for shared ingredients across multiple recipes
- **User Preferences**: Considers starred/favorite recipes in recommendations

### Recipe Management
- **Recipe Collection**: Save and organize recipes from the web
- **Ingredient Extraction**: Automatic ingredient parsing with AI
- **Seasonal Tracking**: Track which ingredients are in season
- **Shopping Lists**: Generate organized shopping lists from selected recipes

### Shopping & Cooking
- **Saved Lists**: Create and manage multiple shopping lists
- **Ingredient Tracking**: Check off ingredients as you shop
- **Recipe Integration**: Link recipes to shopping lists
- **Progress Tracking**: Monitor cooking progress

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **AI**: Claude (Anthropic SDK)
- **UI**: Tailwind CSS, Radix UI, Lucide icons
- **Auth**: JWT (jose / jsonwebtoken)
- **Deploy**: Vercel
