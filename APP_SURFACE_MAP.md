# Itadakimasu App Surface Map

Snapshot of the current product surface, architecture, and supporting pipelines so work can resume quickly.

## Stack

- Next.js 14 App Router
- React client-heavy pages
- Prisma + PostgreSQL
- JWT auth via `jose`
- Anthropic Claude for extraction/planning
- Cheerio for metadata scraping
- Playwright for seasonal-data scraping
- Chrome extension for bookmark import

Key files:
- `app/page.tsx`
- `app/recipes/page.tsx`
- `app/weekly-planner/page.tsx`
- `prisma/schema.prisma`
- `lib/prisma.ts`
- `app/lib/anthropic.ts`

## Main Product Areas

### 1. Cooking / Saved Lists

Route:
- `/`

Files:
- `app/page.tsx`
- `app/components/shopping/SavedLists.tsx`

Purpose:
- Load the user's saved lists
- Show ingredients and recipes for the active list
- Let the user check off ingredients
- Let the user mark recipes as done / star them / remove them
- Suggest additional recipes based on ingredient overlap

Important behavior:
- Redirects to `/recipes` if there are no usable saved lists
- Optimistic ingredient check/uncheck in the UI
- Unstarred recipe removal shows a 5-second "Miam miam ?" rating prompt before final removal

### 2. Recipe Library

Route:
- `/recipes`

Files:
- `app/recipes/page.tsx`
- `app/components/recipes/RecipeCard.tsx`
- `app/components/recipes/AddRecipeForm.tsx`
- `app/components/layout/BottomOverlay.tsx`
- `app/components/common/DeleteConfirmationModal.tsx`

Purpose:
- Browse saved recipes
- Search recipes
- Infinite scroll through recipe pages
- Select multiple recipes
- Bulk add to list / star / delete
- Add recipe by URL
- Remove duplicate recipes

Important behavior:
- Search is debounced
- Pagination is server-backed
- Recipe selection drives the bottom action bar
- Add-by-URL creates a bare recipe row; enrichment is not automatically chained in the web flow

### 3. Weekly Planner

Route:
- `/weekly-planner`

Files:
- `app/weekly-planner/page.tsx`
- `app/components/recipes/WeeklyPlanner.tsx`

Purpose:
- Generate a 5-recipe weekly plan with Claude
- Show planner history
- Accept or reject planner suggestions
- Reset planner history

Important behavior:
- Accept writes planner history and adds the recipe to a saved list
- Reject writes planner history and regenerates the full plan
- There is also an alternatives API route, but the UI does not currently use it

### 4. Auth Shell

Files:
- `app/components/auth/AuthScreen.tsx`
- `app/components/auth/Login.tsx`
- `app/components/auth/Signup.tsx`

Purpose:
- Shared login/signup screen shown by main pages when no token is present

### 5. Shared Layout

Files:
- `app/layout.tsx`
- `app/components/layout/Header.tsx`
- `app/components/common/LoadingOverlay.tsx`

Purpose:
- Fixed header with nav to Cooking / Recipes / Weekly Planner
- Global page wrapper and loading UI

## Core User Journeys

### Auth

Flow:
1. User signs up or logs in
2. API returns JWT
3. Web app stores it in `localStorage`
4. Login screen also attempts to send the token to the Chrome extension

APIs:
- `POST /api/auth/signup`
- `POST /api/auth/login`

### Add Recipe From Web App

Flow:
1. User enters URL in `AddRecipeForm`
2. `app/recipes/page.tsx` calls `POST /api/add-recipe`
3. API creates a `Recipe` row with `url` and optional `title`

Note:
- Metadata extraction and ingredient extraction are not automatically chained in this flow

### Add Recipes To Saved List

Flow:
1. User selects recipes in `/recipes`
2. Bottom overlay calls `handleAddToList`
3. Page fetches `GET /api/saved-lists`
4. Page posts selected IDs to `POST /api/saved-lists`
5. Backend aggregates recipe ingredients into `SavedIngredient`
6. User is redirected back to `/`

### Cooking / List Completion

Flow:
1. `/` fetches `GET /api/saved-lists`
2. `SavedLists.tsx` renders ingredients + recipes
3. Ingredient toggle calls `PATCH /api/saved-lists`
4. Star calls `PATCH /api/recipes/[recipeId]/star`
5. Remove calls `DELETE /api/saved-lists/[listId]/recipes/[recipeId]`

### Weekly Planning

Flow:
1. User clicks Generate Plan
2. `POST /api/weekly-planner` builds planner context and asks Claude for 5 recipes
3. Accept calls `POST /api/weekly-plan-history` with `accepted`, then adds to saved list
4. Reject calls `POST /api/weekly-plan-history` with `rejected`, then regenerates the full plan

### Bookmark Import Via Chrome Extension

Flow:
1. Extension reads JWT from Chrome storage
2. Extension scans bookmarks bar for folder `MIAM`
3. It filters out URLs already present in the user's recipes
4. For each selected bookmark it runs:
   - `POST /api/add-recipe`
   - `POST /api/extract-ingredients`
   - `GET /api/preview-metadata?url=...&recipeId=...`

This is currently the only fully chained import/enrichment path.

## API Surface

### Auth

- `POST /api/auth/signup`
  - Body: `{ email, password }`
  - Creates user, hashes password, returns JWT

- `POST /api/auth/login`
  - Body: `{ email, password }`
  - Validates credentials, returns JWT

### Recipes

- `POST /api/add-recipe`
  - Body: `{ url, title? }`
  - Creates a bare recipe row

- `GET /api/recipes`
  - Query: `page`, `search`
  - Returns paginated recipes with nested ingredients

- `POST /api/recipes`
  - Body: `{ url, title, description, image, ingredients[] }`
  - Creates a fully enriched recipe + ingredients

- `DELETE /api/recipes/[recipeId]`
  - Deletes the recipe and its recipe-ingredient joins

- `PATCH /api/recipes/[recipeId]/star`
  - Toggles `recipe.starred`

- `POST /api/recipes/remove-duplicates`
  - Deduplicates a user's recipes by exact URL

- `POST /api/rating`
  - Legacy star-toggle route

### Saved Lists / Cooking

- `GET /api/saved-lists`
  - Returns up to 10 newest lists with recipes and ingredients

- `POST /api/saved-lists`
  - Body: `{ recipeIds, listId? }`
  - Creates a new list or appends recipes to an existing list

- `PATCH /api/saved-lists`
  - Body: `{ ingredientId, checked }`
  - Updates one saved ingredient's checked state

- `GET /api/saved-lists/[listId]`
  - Returns a single saved list with nested relations

- `POST /api/saved-lists/[listId]/recipes`
  - Body: `{ recipeIds }`
  - Adds recipes to an existing list

- `DELETE /api/saved-lists/[listId]/recipes/[recipeId]`
  - Removes one recipe from one saved list

### Weekly Planner

- `POST /api/weekly-planner`
  - Body: `{ userId }`
  - Generates a 5-recipe plan with Claude

- `POST /api/weekly-planner/alternatives`
  - Body: `{ rejectedRecipeId, currentWeeklyPlan }`
  - Generates 3 alternatives with Claude
  - Present but not used by the UI

- `POST /api/weekly-plan-history`
  - Body: `{ userId, recipeId, status }`
  - Records `accepted`, `rejected`, or `suggested`

- `POST /api/weekly-planner/reset`
  - Body: `{ userId }`
  - Deletes planner history

- `GET /api/weekly-planner/reset?userId=...`
  - Returns used recipes / planner history view data

### Ingredients / Metadata

- `POST /api/extract-ingredients`
  - Body: `{ recipeId }`
  - Fetches HTML, asks Claude for ingredients, persists normalized ingredients

- `GET /api/preview-metadata`
  - Query: `url`, optional `recipeId`
  - Scrapes metadata and optionally updates the recipe row

- `GET /api/ingredients`
  - Returns all ingredients

- `POST /api/ingredients`
  - Creates ingredient if it does not already exist

### Legacy JSON Shopping List APIs
- `GET /api/last-shopping-list` — **Deleted** (replaced by `SavedList → SavedIngredient`)
- `POST /api/update-shopping-list` — **Deleted** (replaced by `PATCH /api/saved-lists`)

## Data Model

Defined in `prisma/schema.prisma`.

### Main Models

- `User`
  - owns recipes, saved lists, weekly planner history

- `Recipe`
  - saved URL + metadata
  - unique per user on `(url, userId)`
  - has many `RecipeIngredient`
  - many-to-many with `SavedList`

- `Ingredient`
  - normalized ingredient entity
  - optional category/default unit/translated names
  - has season rows

- `RecipeIngredient`
  - join model carrying `quantity` and `unit`

- `SavedList`
  - user-owned cooking/shopping list

- `SavedIngredient`
  - aggregated ingredient attached to a saved list
  - carries quantity, unit, category, checked state

- `IngredientSeason`
  - ingredient to month mapping for seasonality

- `WeeklyPlanHistory`
  - stores `accepted`, `rejected`, `suggested`

- `ShoppingList`
  - legacy JSON blob model still partially referenced

## Supporting Pipelines

### 1. Ingredient Extraction Pipeline

Files:
- `app/api/extract-ingredients/route.ts`
- `app/api/extract-ingredients/extractor.ts`
- `lib/ingredients.ts`

Pipeline:
1. Fetch recipe HTML
2. Strip scripts/styles
3. Flatten text
4. Ask Claude for structured ingredient JSON
5. Filter excluded pantry staples
6. Upsert ingredients
7. Upsert recipe-ingredient joins

### 2. Metadata Pipeline

File:
- `app/api/preview-metadata/route.ts`

Pipeline:
1. Fetch target URL with custom user-agent
2. Parse OG/twitter/title/description/image tags
3. Special-case WPRM print pages via the "Go Back" URL
4. Optionally persist metadata onto the recipe

### 3. Weekly Planner Pipeline

Files:
- `app/api/weekly-planner/route.ts`
- `lib/weekly-plan-history.ts`
- `lib/weekly-planner-weights.ts`

Pipeline:
1. Load user recipes with ingredients + seasons
2. Load planner history
3. Load checked legacy shopping-list items
4. Compute weights
5. Ask Claude for 5 recipes
6. Store `suggested` history rows
7. Return formatted planner cards

Weights in `lib/weekly-planner-weights.ts`:
- recently accepted: `-50`
- recently rejected: `-20`
- recently suggested: `-10`
- never used: `+30`
- starred: `+10`

### 4. Seasonal Data Pipeline

Files:
- `scripts/scrape-mangerbouger.ts`
- `scripts/ingest-seasonal-data.ts`
- `scripts/seasonal-data.json`
- `scripts/scraped-seasonal-data.json`

Pipeline:
1. Scrape seasonal produce pages
2. Translate names with Claude
3. Upsert `Ingredient` and `IngredientSeason`
4. Persist JSON references

### 5. Ingredient Maintenance Scripts

Files:
- `scripts/refresh-all-ingredients.ts`
- `scripts/fix-missing-ingredients.ts`
- `scripts/clean-ingredients.ts`
- `scripts/clean-excluded-ingredients.ts`

## Chrome Extension Surface

Files:
- `chrome-extension/manifest.json`
- `chrome-extension/background.js`
- `chrome-extension/popup.js`
- `chrome-extension/popup.html`

Responsibilities:
- accept JWT from the web app
- persist JWT in Chrome storage
- find bookmarks under `MIAM`
- filter already imported recipes
- import selected bookmarks through the production API

## Cross-Cutting Architecture

### Auth Model

- Web app stores JWT in `localStorage`
- Pages manually attach `Authorization: Bearer ...`
- Middleware exists in `middleware.ts`, but only covers a small and partly outdated subset of API routes
- Some routes self-verify JWT
- Some routes trust `userId` from request body/query instead of authenticating it server-side

### State Management

- All state is local React state
- No global state library
- Parent pages own fetch/auth/loading state

### Navigation

- Fixed header nav across the main pages
- Several client-side redirects with `router.push()` based on app state

### Caching

- `/api/recipes` and `/api/saved-lists` set cache headers
- `/recipes` fetch also uses `force-cache` + `revalidate`

### Prisma Access

There are two Prisma singleton files:
- `lib/prisma.ts`
- `app/lib/prisma.ts`

Routes import both patterns inconsistently.

## Active vs Legacy Surface

### Clearly Active

- `/`
- `/recipes`
- `/weekly-planner`
- `SavedLists.tsx`
- `RecipeCard.tsx`
- `/api/saved-lists*`
- `/api/recipes*`
- `/api/add-recipe`
- `/api/weekly-planner`
- Chrome extension import flow

### Legacy / Partially Orphaned / Suspicious

- `app/components/shopping/ShoppingList.tsx` appears unused
- `app/components/recipes/RecipeList.tsx` appears unused
- `POST /api/rating` duplicates star-toggle behavior
- `POST /api/weekly-planner/alternatives` exists but is not wired into the UI
- `ShoppingList` table plus `/api/last-shopping-list` and `/api/update-shopping-list` look like an older JSON-based list system
- Weekly planner still reads checked ingredient context from legacy `ShoppingList`, not from current `SavedIngredient.checked`

## Important Structural Observations

1. The current app's main model is:
   - `Recipe -> SavedList -> SavedIngredient`

2. Older behavior still exists around a separate JSON `ShoppingList` model.

3. The extension import flow is more complete than the web add-by-URL flow because it chains:
   - recipe creation
   - ingredient extraction
   - metadata scraping

4. There is an architectural mismatch between:
   - current cooking/saved-list UX
   - planner context sourcing
   - legacy shopping-list APIs

## Good Next Review Angles

If resuming analysis later, the best next passes are:

1. Auth and trust boundary audit
2. UX/perf audit by surface
3. Current-vs-legacy cleanup map
4. Data integrity audit for saved-list aggregation and removal
5. Planner pipeline review, especially alternatives and checked-ingredient sourcing
