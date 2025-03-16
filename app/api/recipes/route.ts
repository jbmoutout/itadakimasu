import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { normalizeQuantity, normalizeUnit, shouldIncludeIngredient } from '../../../lib/ingredients';
import { jwtVerify } from 'jose';
import { Prisma } from '@prisma/client';

const PAGE_SIZE = 12; // Number of recipes per page

export async function GET(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const search = searchParams.get('search') || '';

    let userId: number;
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
      userId = payload.userId as number;
      if (!userId) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Build the where clause for search
    const where: Prisma.RecipeWhereInput = {
      userId,
      ...(search ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          { description: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
          {
            ingredients: {
              some: {
                ingredient: {
                  name: { contains: search, mode: 'insensitive' as Prisma.QueryMode }
                }
              }
            }
          }
        ]
      } : {})
    };

    // Get total count for pagination
    const total = await prisma.recipe.count({ where });

    // Get paginated recipes
    const recipes = await prisma.recipe.findMany({
      where,
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
      orderBy: [
        { starred: 'desc' },
        { createdAt: 'desc' }
      ],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    // Add cache control headers
    const response = NextResponse.json({
      recipes,
      pagination: {
        total,
        pages: Math.ceil(total / PAGE_SIZE),
        currentPage: page,
        hasMore: page * PAGE_SIZE < total
      }
    });
    
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate');
    
    return response;
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
            ingredient: {
              include: {
                seasons: true
              }
            },
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