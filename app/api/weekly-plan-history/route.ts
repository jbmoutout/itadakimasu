import { NextRequest, NextResponse } from "next/server";
import { recordWeeklyPlanUsage } from "@/lib/weekly-plan-history";

export async function POST(request: NextRequest) {
  try {
    const { userId, recipeId, status } = await request.json();

    if (!userId || !recipeId || !status) {
      return NextResponse.json(
        {
          error: "User ID, recipe ID, and status are required",
        },
        { status: 400 }
      );
    }

    if (!["accepted", "rejected", "suggested"].includes(status)) {
      return NextResponse.json(
        {
          error: "Status must be 'accepted', 'rejected', or 'suggested'",
        },
        { status: 400 }
      );
    }

    // Record the usage
    await recordWeeklyPlanUsage(userId, recipeId, status);

    return NextResponse.json({
      message: "Weekly plan history recorded successfully",
    });
  } catch (error) {
    console.error("Error recording weekly plan history:", error);
    return NextResponse.json(
      { error: "Failed to record weekly plan history" },
      { status: 500 }
    );
  }
}
