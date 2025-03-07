import { prisma } from "@/lib/prisma"
import { normalizeQuantity, normalizeUnit } from "@/lib/ingredients"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const items = await prisma.gatheredItem.findMany({
      include: {
        ingredient: true,
        recipe: {
          select: {
            title: true,
          },
        },
      },
      orderBy: [
        {
          gathered: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    })
    return NextResponse.json(items)
  } catch (error) {
    console.error("Failed to fetch gathered items:", error)
    return NextResponse.json({ error: "Failed to fetch gathered items" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ingredientId, quantity, unit, recipeId } = body

    // Check if item already exists for this ingredient and recipe
    const existing = await prisma.gatheredItem.findFirst({
      where: {
        ingredientId,
        recipeId,
        userId: 1, // TODO: Get from auth
        gathered: false,
      },
    })

    if (existing) {
      // Update quantity if item exists
      const updatedItem = await prisma.gatheredItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + normalizeQuantity(quantity),
        },
        include: {
          ingredient: true,
          recipe: {
            select: {
              title: true,
            },
          },
        },
      })
      return NextResponse.json(updatedItem)
    }

    const item = await prisma.gatheredItem.create({
      data: {
        ingredientId,
        quantity: normalizeQuantity(quantity),
        unit: normalizeUnit(unit),
        recipeId,
        userId: 1, // TODO: Get from auth
      },
      include: {
        ingredient: true,
        recipe: {
          select: {
            title: true,
          },
        },
      },
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error("Failed to create gathered item:", error)
    return NextResponse.json({ error: "Failed to create gathered item" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, gathered } = body

    const item = await prisma.gatheredItem.update({
      where: { id },
      data: { gathered },
      include: {
        ingredient: true,
        recipe: {
          select: {
            title: true,
          },
        },
      },
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error("Failed to update gathered item:", error)
    return NextResponse.json({ error: "Failed to update gathered item" }, { status: 500 })
  }
} 