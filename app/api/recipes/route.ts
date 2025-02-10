import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
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
      where: { userId: userId },
      include: {
        ingredients: {
          include: {
            ingredient: true  
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ recipes });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}