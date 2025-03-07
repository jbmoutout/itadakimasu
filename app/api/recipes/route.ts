import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { normalizeQuantity, normalizeUnit, shouldIncludeIngredient } from '../../../lib/ingredients';
import { jwtVerify } from 'jose';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    const userId = payload.userId as number;

    const recipes = await prisma.recipe.findMany({
      where: {
        userId: userId,
      },
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    return NextResponse.json(recipes);
  } catch (error) {
    console.error('Failed to fetch recipes:', error);
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    const userId = payload.userId as number;

    const body = await request.json();
    const { url, title, description, image, ingredients } = body;

    // Filter out excluded ingredients and normalize quantities and units
    const validIngredients = ingredients
      ? ingredients
          .filter((ing: { name: string }) => shouldIncludeIngredient(ing.name))
          .map((ing: { name: string; quantity: number | string; unit: string }) => ({
            ...ing,
            name: ing.name.trim(),
            quantity: normalizeQuantity(ing.quantity),
            unit: normalizeUnit(ing.unit),
          }))
      : [];

    const recipe = await prisma.recipe.create({
      data: {
        url,
        title,
        description,
        image,
        userId: userId,
        ingredients: {
          create: await Promise.all(
            validIngredients.map(async (ing: { name: string; quantity: number; unit: string }) => {
              // Try to find existing ingredient first (case-insensitive)
              const existingIngredient = await prisma.ingredient.findFirst({
                where: {
                  name: {
                    equals: ing.name,
                    mode: 'insensitive',
                  },
                },
              });

              return {
                quantity: ing.quantity,
                unit: ing.unit,
                ingredient: {
                  connectOrCreate: {
                    where: {
                      id: existingIngredient?.id || -1,
                    },
                    create: {
                      name: ing.name,
                      defaultUnit: ing.unit,
                    },
                  },
                },
              };
            })
          ),
        },
      },
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    return NextResponse.json(recipe);
  } catch (error) {
    console.error('Failed to create recipe:', error);
    return NextResponse.json({ error: 'Failed to create recipe' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}