# Itadakimasu — Context

Domain language for the meal-planning app: saving recipes, composing cooking
lists from them, and planning a week of meals. This file names the concepts so
code and reviews use the same words.

## Language

**Recipe**:
A saved dish, identified by its source URL, owning a set of recipe-ingredients
(each with a quantity and unit). Unique per user on `(url, userId)`.

**Ingredient**:
A normalized, shared ingredient entity (name, optional category, seasonality).
Referenced by recipes and saved lists; never owned by one of them.
_Avoid_: item, product.

**Saved List**:
A user's cooking/shopping list — a set of recipes plus the **Saved Ingredients**
aggregated from them. The thing the cooking screen renders and checks off.
_Avoid_: shopping list (overloaded with the legacy JSON `ShoppingList` model),
cart, basket.

**Saved Ingredient**:
One aggregated ingredient line on a Saved List, carrying a summed quantity, a
unit, a category, and a `checked` (checked-off-while-shopping) flag. A **derived
projection** of the list's recipes — not independently authored state.

**Aggregation**:
The rule that a Saved List's Saved Ingredients are recomputed from the full set
of its current recipes. One ingredient yields one Saved Ingredient row per list
`(savedListId, ingredientId)`; quantities sum within a unit, and an ingredient
appearing in multiple units collapses to a deterministic, quantity-blind winner
unit. Lives in `lib/saved-list-ingredients.ts` (pure) and
`lib/saved-list-recompute.ts` (persistence).
_Avoid_: merge (reserved for the client-side display collapse in
`SavedLists.tsx::mergeIngredients`, a separate presentation concern).

**Weekly Plan**:
A Claude-generated selection of recipes for the week, with a history of
`accepted` / `rejected` / `suggested` outcomes that weights future selections.
