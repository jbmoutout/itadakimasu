export const WEEKLY_PLANNER_WEIGHTS = {
  // Recipe history weights (negative = avoid, positive = prefer)
  recentlyAccepted: -50, // Avoid recipes accepted in last 4 weeks
  recentlyRejected: -20, // Less likely to suggest recently rejected recipes
  recentlySuggested: -10, // Slight penalty for recently suggested but not acted on

  // Recipe preference weights
  starred: 10, // Bonus for starred recipes
  neverUsed: 30, // High priority for recipes never used in weekly plans

  // Seasonal and health weights (used in AI prompt scoring)
  seasonalBonus: 5, // Bonus for seasonal ingredients
  healthBonus: 3, // Bonus for healthy recipes

  // History settings
  historyRetentionDays: 30, // Keep history for 30 days (1 month)
  lookbackWeeks: 4, // Look back 4 weeks for recent usage

  // Fallback settings
  minRecipesForVariety: 5, // Minimum recipes needed before applying variety rules
  maxRecentlyUsedInFallback: 2, // Max recently used recipes to include in fallback
} as const;

export type WeeklyPlannerWeights = typeof WEEKLY_PLANNER_WEIGHTS;
