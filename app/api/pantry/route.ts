import { prisma } from "@/lib/prisma"
import { normalizeQuantity, normalizeUnit } from "@/lib/ingredients"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const items = await prisma.pantryItem.findMany({
      include: {
        ingredient: true,
      },
      orderBy: [
        {
          expiryDate: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    })
    return NextResponse.json(items)
  } catch (error) {
    console.error("Failed to fetch pantry items:", error)
    return NextResponse.json({ error: "Failed to fetch pantry items" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ingredientId, quantity, unit, expiryDate } = body

    // Check if item already exists for this ingredient
    const existing = await prisma.pantryItem.findFirst({
      where: {
        ingredientId,
        userId: 1, // TODO: Get from auth
        unit: normalizeUnit(unit),
      },
    })

    if (existing) {
      // Update quantity if item exists with same unit
      const updatedItem = await prisma.pantryItem.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + normalizeQuantity(quantity),
          expiryDate: expiryDate || existing.expiryDate,
        },
        include: {
          ingredient: true,
        },
      })
      return NextResponse.json(updatedItem)
    }

    const item = await prisma.pantryItem.create({
      data: {
        ingredientId,
        quantity: normalizeQuantity(quantity),
        unit: normalizeUnit(unit),
        expiryDate,
        userId: 1, // TODO: Get from auth
      },
      include: {
        ingredient: true,
      },
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error("Failed to create pantry item:", error)
    return NextResponse.json({ error: "Failed to create pantry item" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = parseInt(searchParams.get("id") || "")

    await prisma.pantryItem.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete pantry item:", error)
    return NextResponse.json({ error: "Failed to delete pantry item" }, { status: 500 })
  }
} 