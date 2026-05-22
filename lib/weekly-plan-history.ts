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

export async function cleanupWeeklyPlanHistory() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - WEEKLY_PLANNER_WEIGHTS.historyRetentionDays
    );

    try {
      const result = await prisma.weeklyPlanHistory.deleteMany({
        where: { createdAt: { lt: cutoffDate } },
      });
      console.log(`Cleaned up ${result.count} old weekly plan history records`);
      return result.count;
    } catch {
      console.log("WeeklyPlanHistory table may not exist yet, skipping cleanup");
      return 0;
    }
  } catch (error) {
    console.error("Error cleaning up weekly plan history:", error);
    return 0;
  }
}

export async function getRecipeHistory(
  userId: number
): Promise<RecipeHistory[]> {
  try {
    const lookbackDate = new Date();
    lookbackDate.setDate(
      lookbackDate.getDate() - WEEKLY_PLANNER_WEIGHTS.lookbackWeeks * 7
    );

    const history = await prisma.weeklyPlanHistory.findMany({
      where: { userId, planDate: { gte: lookbackDate } },
      orderBy: { planDate: "desc" },
      select: { recipeId: true, status: true, planDate: true },
    });

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

export function calculateRecipeWeights(
  recipeIds: number[],
  history: RecipeHistory[],
  starredRecipeIds: Set<number>
): RecipeWeight[] {
  const weights: RecipeWeight[] = [];
  const historyMap = new Map<number, RecipeHistory[]>();

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

    if (recipeHistory.length > 0) {
      const latestRecord = recipeHistory[0];

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
      weight += WEEKLY_PLANNER_WEIGHTS.neverUsed;
      reasons.push("Never used in weekly plans");
    }

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

  return weights.sort((a, b) => b.weight - a.weight);
}

export async function recordWeeklyPlanUsage(
  userId: number,
  recipeId: number,
  status: "accepted" | "rejected" | "suggested"
) {
  try {
    await prisma.weeklyPlanHistory.create({
      data: { userId, recipeId, status, planDate: new Date(), createdAt: new Date() },
    });
  } catch (error) {
    console.error(`Failed to record weekly plan usage: ${error}`);
  }
}

export async function resetWeeklyPlanHistory(userId: number) {
  try {
    const result = await prisma.weeklyPlanHistory.deleteMany({
      where: { userId },
    });
    return result.count;
  } catch (error) {
    console.error("Failed to reset weekly plan history:", error);
    return 0;
  }
}

export async function getUsedRecipes(userId: number) {
  try {
    const history = await prisma.weeklyPlanHistory.findMany({
      where: { userId },
      orderBy: { planDate: "desc" },
      include: {
        recipe: {
          select: { id: true, title: true, image: true, url: true },
        },
      },
    });

    return history.map((record) => ({
      id: record.recipe.id,
      title: record.recipe.title,
      image: record.recipe.image,
      url: record.recipe.url,
      status: record.status,
      planDate: record.planDate,
    }));
  } catch (error) {
    console.error("Failed to get used recipes:", error);
    return [];
  }
}
