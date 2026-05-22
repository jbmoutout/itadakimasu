import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Planner } from "@/lib/planner";
import anthropic from "@/app/lib/anthropic";
import { getUserId } from "@/lib/auth";

const planner = new Planner(anthropic);

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const result = await planner.resetHistory(userId);

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

    const usedRecipes = await prisma.weeklyPlanHistory.findMany({
      where: { userId },
      include: {
        recipe: {
          select: { id: true, title: true, image: true, url: true },
        },
      },
      orderBy: { planDate: "desc" },
    });

    const records = usedRecipes.map((record) => ({
      id: record.recipe.id,
      title: record.recipe.title,
      image: record.recipe.image,
      url: record.recipe.url,
      status: record.status,
      planDate: record.planDate,
    }));

    return NextResponse.json({
      usedRecipes: records,
      totalUsed: records.length,
    });
  } catch (error) {
    console.error("Error getting used recipes:", error);
    return NextResponse.json(
      { error: "Failed to get used recipes" },
      { status: 500 }
    );
  }
}