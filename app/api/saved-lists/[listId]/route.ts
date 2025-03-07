import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";

export async function GET(
  request: Request,
  { params }: { params: { listId: string } }
) {
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

    const listId = parseInt(params.listId);

    // Verify the list belongs to the user
    const savedList = await prisma.savedList.findFirst({
      where: {
        id: listId,
        userId,
      },
      include: {
        recipes: {
          include: {
            ingredients: {
              include: {
                ingredient: true,
              },
            },
          },
        },
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!savedList) {
      return NextResponse.json(
        { error: "List not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json(savedList);
  } catch (error) {
    console.error("Failed to fetch saved list:", error);
    return NextResponse.json(
      { error: "Failed to fetch saved list" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 