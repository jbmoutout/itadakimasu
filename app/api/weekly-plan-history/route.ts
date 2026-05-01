import { NextRequest, NextResponse } from "next/server";
import { recordWeeklyPlanUsage } from "@/lib/weekly-plan-history";
import { getUserId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { recipeId, status } = await request.json();

    if (!recipeId || !status) {
      return NextResponse.json(
        {
          error: "Recipe ID and status are required",
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
