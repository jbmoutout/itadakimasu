import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    const userId = payload.userId as number;
    

    const { url } = await request.json();

    // Check if the URL already exists in the database
    const existingRecipe = await prisma.recipe.findFirst({
      where: {
        url: url,
      }
    });

    if (existingRecipe) {
        console.error('Recipe with this URL already exists');
        return NextResponse.json({ error: 'Recipe with this URL already exists' }, { status: 400 });
    }

    const newRecipe = await prisma.recipe.create({
      data: {
        url: url,
        userId: userId,
      },
    });

    return NextResponse.json({ success: true, recipe: newRecipe });
  } catch (error) {
    console.error('Failed to add recipe:', error);
    return NextResponse.json({ error: 'Failed to add recipe. Please check your database connection.' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}