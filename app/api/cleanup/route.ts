import { NextResponse } from "next/server";
import { cleanupWeeklyPlanHistory } from "@/lib/weekly-plan-history";

export async function POST() {
  try {
    const cleanedCount = await cleanupWeeklyPlanHistory();
    
    return NextResponse.json({
      success: true,
      cleanedRecords: cleanedCount,
      message: `Cleaned up ${cleanedCount} old weekly plan history records`
    });
  } catch (error) {
    console.error("Cleanup failed:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to cleanup old records" 
      },
      { status: 500 }
    );
  }
}

// Allow GET for cron job calls
export async function GET() {
  return POST();
} 