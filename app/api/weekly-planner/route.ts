import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { generateWeeklyPlan } from "@/lib/weekly-planner";

const FUNCTION_TIMEOUT = 25000;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const userId = getUserId(request);

    const checkTimeout = () => {
      if (Date.now() - startTime > FUNCTION_TIMEOUT) {
        throw new Error("Function timeout approaching");
      }
    };

    checkTimeout();

    const result = await generateWeeklyPlan(userId);

    checkTimeout();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating weekly plan:", error);

    if (error instanceof Error && error.message === "No recipes found") {
      return NextResponse.json({ error: "No recipes found" }, { status: 404 });
    }

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
