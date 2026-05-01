import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: { listId: string } }
) {
  try {
    const userId = getUserId(request);

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