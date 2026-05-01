import { NextRequest, NextResponse } from "next/server";
import {
  resetWeeklyPlanHistory,
  getUsedRecipes,
} from "@/lib/weekly-plan-history";
import { getUserId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);

    const result = await resetWeeklyPlanHistory(userId);

    return NextResponse.json({
      message: "Weekly plan history reset successfully",
      deletedCount: result,
    });
  } catch (error) {
    console.error("Error resetting weekly plan history:", error);
    return NextResponse.json(
      { error: "Failed to reset weekly plan history" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);

    const usedRecipes = await getUsedRecipes(userId);

    return NextResponse.json({
      usedRecipes,
      totalUsed: usedRecipes.length,
    });
  } catch (error) {
    console.error("Error getting used recipes:", error);
    return NextResponse.json(
      { error: "Failed to get used recipes" },
      { status: 500 }
    );
  }
}
