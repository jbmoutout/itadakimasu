import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: {
        name: "asc",
      },
    })
    return NextResponse.json(ingredients)
  } catch (error) {
    console.error("Failed to fetch ingredients:", error)
    return NextResponse.json({ error: "Failed to fetch ingredients" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, category, defaultUnit } = body

    // Check if ingredient already exists (case-insensitive)
    const existing = await prisma.ingredient.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    })

    if (existing) {
      return NextResponse.json(existing)
    }

    const ingredient = await prisma.ingredient.create({
      data: {
        name,
        category,
        defaultUnit,
      },
    })

    return NextResponse.json(ingredient)
  } catch (error) {
    console.error("Failed to create ingredient:", error)
    return NextResponse.json({ error: "Failed to create ingredient" }, { status: 500 })
  }
} 