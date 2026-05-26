import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import anthropic from "@/app/lib/anthropic";
import { getUserId } from "@/lib/auth";
import { createWeeklyPlanner } from "@/lib/weekly-planner";
import { ShoppingListCheckedIngredients } from "@/lib/checked-ingredient-source";

const planner = createWeeklyPlanner({
  prisma,
  anthropic,
  checkedIngredients: new ShoppingListCheckedIngredients(prisma),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const userId = getUserId(request);

    const result = await planner(userId);

    const processingTime = Date.now() - startTime;

    if ("fallback" in result) {
      return NextResponse.json({
        recipes: result.fallback,
        fallbackUsed: true,
        processingTime,
      });
    }

    return NextResponse.json({
      recipes: result.ok,
      processingTime,
    });
  } catch (error) {
    console.error("Error generating weekly plan:", error);

    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json(
        {
          error: "Request timed out. Please try again.",
          timeout: true,
          processingTime: Date.now() - startTime,
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate weekly plan" },
      { status: 500 }
    );
  }
}
