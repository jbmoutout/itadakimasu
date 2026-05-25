import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { generateAlternatives } from "@/lib/weekly-planner";

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);

    const { rejectedRecipeId, currentWeeklyPlan } = await request.json();

    const result = await generateAlternatives(userId, rejectedRecipeId, currentWeeklyPlan);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating alternatives:", error);

    if (error instanceof Error && error.message === "No alternative recipes available") {
      return NextResponse.json(
        { error: "No alternative recipes available" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate alternatives" },
      { status: 500 }
    );
  }
}
