import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { jwtVerify } from "jose";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    const userId = payload.userId as number;

    const { recipeId, rating } = await request.json();

    // Validate the rating value
    if (!Object.values(Rating).includes(rating)) {
      return NextResponse.json(
        { error: "Invalid rating value" },
        { status: 400 }
      );
    }

    const newRating = await prisma.rating.create({
      data: {
        recipeId,
        userId,
        rating,
      },
    });

    return NextResponse.json({ rating: newRating });
  } catch (error) {
    console.error("Error creating rating:", error);
    return NextResponse.json(
      { error: "Failed to create rating" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
