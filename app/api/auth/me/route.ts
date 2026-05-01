import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = getUserId(request);
  return NextResponse.json({ userId });
}
