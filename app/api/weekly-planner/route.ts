import { NextRequest, NextResponse } from "next/server";
import { Planner } from "@/lib/planner";
import anthropic from "@/app/lib/anthropic";
import { getUserId } from "@/lib/auth";

const planner = new Planner(anthropic);

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const result = await planner.generatePlan(userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating weekly plan:", error);

    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json(
        {
          error: "Request timed out. Please try again.",
          timeout: true,
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