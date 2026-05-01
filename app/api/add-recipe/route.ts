import { NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { getUserId } from '@/lib/auth';


export async function POST(request: Request) {
  try {
    const userId = getUserId(request);

    const { url, title } = await request.json();

    // Check if the URL already exists for this user
    const existingRecipe = await prisma.recipe.findFirst({
      where: {
        url: url,
        userId: userId,
      }
    });

    if (existingRecipe) {
      return NextResponse.json({ 
        error: 'You have already saved this recipe',
        recipe: existingRecipe 
      }, { status: 400 });
    }

    const newRecipe = await prisma.recipe.create({
      data: {
        url: url,
        title: title,
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