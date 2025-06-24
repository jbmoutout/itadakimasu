import { prisma } from "@/lib/prisma";
import { WEEKLY_PLANNER_WEIGHTS } from "./weekly-planner-weights";
import type { WeeklyPlanHistory, Recipe } from "@prisma/client";

export interface RecipeHistory {
  recipeId: number;
  status: "accepted" | "rejected" | "suggested";
  planDate: Date;
}

export interface RecipeWeight {
  recipeId: number;
  weight: number;
  reason: string;
}

/**
 * Clean up old weekly plan history records (older than 1 month)
 */
export async function cleanupWeeklyPlanHistory() {
  const cutoffDate = new Date();
  cutoffDate.setDate(
    cutoffDate.getDate() - WEEKLY_PLANNER_WEIGHTS.historyRetentionDays
  );

  const result = await prisma.weeklyPlanHistory.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`Cleaned up ${result.count} old weekly plan history records`);
  return result.count;
}

/**
 * Get recipe usage history for a user
 */
export async function getRecipeHistory(
  userId: number
): Promise<RecipeHistory[]> {
  const lookbackDate = new Date();
  lookbackDate.setDate(
    lookbackDate.getDate() - WEEKLY_PLANNER_WEIGHTS.lookbackWeeks * 7
  );

  const history = await prisma.weeklyPlanHistory.findMany({
    where: {
      userId,
      planDate: {
        gte: lookbackDate,
      },
    },
    orderBy: {
      planDate: "desc",
    },
  });

  return history.map((record: WeeklyPlanHistory) => ({
    recipeId: record.recipeId,
    status: record.status as "accepted" | "rejected" | "suggested",
    planDate: record.planDate,
  }));
}

/**
 * Calculate weights for recipes based on history and preferences
 */
export function calculateRecipeWeights(
  recipeIds: number[],
  history: RecipeHistory[],
  starredRecipeIds: Set<number>
): RecipeWeight[] {
  const weights: RecipeWeight[] = [];
  const historyMap = new Map<number, RecipeHistory[]>();

  // Group history by recipe ID
  history.forEach((record) => {
    if (!historyMap.has(record.recipeId)) {
      historyMap.set(record.recipeId, []);
    }
    historyMap.get(record.recipeId)!.push(record);
  });

  recipeIds.forEach((recipeId) => {
    let weight = 0;
    const reasons: string[] = [];
    const recipeHistory = historyMap.get(recipeId) || [];

    // Check if recipe has been used recently
    if (recipeHistory.length > 0) {
      const latestRecord = recipeHistory[0]; // Most recent

      switch (latestRecord.status) {
        case "accepted":
          weight += WEEKLY_PLANNER_WEIGHTS.recentlyAccepted;
          reasons.push("Recently accepted");
          break;
        case "rejected":
          weight += WEEKLY_PLANNER_WEIGHTS.recentlyRejected;
          reasons.push("Recently rejected");
          break;
        case "suggested":
          weight += WEEKLY_PLANNER_WEIGHTS.recentlySuggested;
          reasons.push("Recently suggested");
          break;
      }
    } else {
      // Recipe has never been used in weekly plans
      weight += WEEKLY_PLANNER_WEIGHTS.neverUsed;
      reasons.push("Never used in weekly plans");
    }

    // Add bonus for starred recipes
    if (starredRecipeIds.has(recipeId)) {
      weight += WEEKLY_PLANNER_WEIGHTS.starred;
      reasons.push("Starred recipe");
    }

    weights.push({
      recipeId,
      weight,
      reason: reasons.join(", "),
    });
  });

  return weights.sort((a, b) => b.weight - a.weight); // Sort by weight descending
}

/**
 * Record recipe usage in weekly plan history
 */
export async function recordWeeklyPlanUsage(
  userId: number,
  recipeId: number,
  status: "accepted" | "rejected" | "suggested"
) {
  return await prisma.weeklyPlanHistory.create({
    data: {
      userId,
      recipeId,
      status,
      planDate: new Date(),
    },
  });
}

/**
 * Reset weekly plan history for a user
 */
export async function resetWeeklyPlanHistory(userId: number) {
  return await prisma.weeklyPlanHistory.deleteMany({
    where: {
      userId,
    },
  });
}

/**
 * Get all recipes that have been used in weekly plans
 */
export async function getUsedRecipes(userId: number) {
  const history = await prisma.weeklyPlanHistory.findMany({
    where: {
      userId,
    },
    include: {
      recipe: {
        select: {
          id: true,
          title: true,
          image: true,
          url: true,
        },
      },
    },
    orderBy: {
      planDate: "desc",
    },
  });

  return history.map(
    (
      record: WeeklyPlanHistory & {
        recipe: Pick<Recipe, "id" | "title" | "image" | "url">;
      }
    ) => ({
      ...record.recipe,
      status: record.status,
      planDate: record.planDate,
    })
  );
}
