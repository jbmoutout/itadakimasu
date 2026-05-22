import { NextResponse } from "next/server";
import { Planner } from "@/lib/planner";
import anthropic from "@/app/lib/anthropic";

const planner = new Planner(anthropic);

export async function POST() {
  try {
    const cleanedCount = await planner.cleanupHistory();

    return NextResponse.json({
      success: true,
      cleanedRecords: cleanedCount,
      message: `Cleaned up ${cleanedCount} old weekly plan history records`,
    });
  } catch (error) {
    console.error("Cleanup failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to cleanup old records",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}