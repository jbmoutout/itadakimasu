import { prisma } from "@/lib/prisma";
import { WEEKLY_PLANNER_WEIGHTS } from "./weekly-planner-weights";

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
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - WEEKLY_PLANNER_WEIGHTS.historyRetentionDays
    );

    // Use raw SQL as fallback if model doesn't exist
    try {
      const result = await prisma.$executeRaw`
        DELETE FROM "WeeklyPlanHistory" 
        WHERE "createdAt" < ${cutoffDate}
      `;
      
      console.log(`Cleaned up ${result} old weekly plan history records`);
      return Number(result);
    } catch {
      console.log("WeeklyPlanHistory table may not exist yet, skipping cleanup");
      return 0;
    }
  } catch (error) {
    console.error("Error cleaning up weekly plan history:", error);
    // Don't throw error to avoid disrupting the main flow
    return 0;
  }
}

/**
 * Get recipe usage history for a user
 */
export async function getRecipeHistory(
  userId: number
): Promise<RecipeHistory[]> {
  try {
    const lookbackDate = new Date();
    lookbackDate.setDate(
      lookbackDate.getDate() - WEEKLY_PLANNER_WEIGHTS.lookbackWeeks * 7
    );

    // Use raw SQL as fallback if model doesn't exist
    const history = await prisma.$queryRaw<Array<{
      recipeId: number;
      status: string;
      planDate: Date;
    }>>`
      SELECT "recipeId", "status", "planDate"
      FROM "WeeklyPlanHistory"
      WHERE "userId" = ${userId}
        AND "planDate" >= ${lookbackDate}
      ORDER BY "planDate" DESC
    `;

    return history.map((record) => ({
      recipeId: record.recipeId,
      status: record.status as "accepted" | "rejected" | "suggested",
      planDate: record.planDate,
    }));
  } catch {
    console.log("WeeklyPlanHistory table may not exist yet, returning empty history");
    return [];
  }
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
  try {
    // Use raw SQL as fallback if model doesn't exist
    await prisma.$executeRaw`
      INSERT INTO "WeeklyPlanHistory" ("userId", "recipeId", "status", "planDate", "createdAt")
      VALUES (${userId}, ${recipeId}, ${status}, NOW(), NOW())
    `;
  } catch (error) {
    console.error(`Failed to record weekly plan usage: ${error}`);
    // Don't throw to avoid disrupting the main flow
  }
}

/**
 * Reset weekly plan history for a user
 */
export async function resetWeeklyPlanHistory(userId: number) {
  try {
    const result = await prisma.$executeRaw`
      DELETE FROM "WeeklyPlanHistory" WHERE "userId" = ${userId}
    `;
    return Number(result);
  } catch (error) {
    console.error("Failed to reset weekly plan history:", error);
    return 0;
  }
}

/**
 * Get all recipes that have been used in weekly plans
 */
export async function getUsedRecipes(userId: number) {
  try {
    const history = await prisma.$queryRaw<Array<{
      id: number;
      title: string;
      image: string | null;
      url: string;
      status: string;
      planDate: Date;
    }>>`
      SELECT r.id, r.title, r.image, r.url, wph.status, wph."planDate"
      FROM "WeeklyPlanHistory" wph
      JOIN "Recipe" r ON wph."recipeId" = r.id
      WHERE wph."userId" = ${userId}
      ORDER BY wph."planDate" DESC
    `;

    return history.map((record) => ({
      id: record.id,
      title: record.title,
      image: record.image,
      url: record.url,
      status: record.status,
      planDate: record.planDate,
    }));
  } catch (error) {
    console.error("Failed to get used recipes:", error);
    return [];
  }
}
