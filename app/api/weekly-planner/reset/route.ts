import { NextRequest, NextResponse } from "next/server";
import {
  resetWeeklyPlanHistory,
  getUsedRecipes,
} from "@/lib/weekly-plan-history";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Reset the weekly plan history for the user
    const result = await resetWeeklyPlanHistory(userId);

    return NextResponse.json({
      message: "Weekly plan history reset successfully",
      deletedCount: result.count,
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get all recipes that have been used in weekly plans
    const usedRecipes = await getUsedRecipes(parseInt(userId));

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
