import { NextResponse } from 'next/server';
import {prisma} from '../../lib/prisma';
import { getUserId } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);

    const lastShoppingList = await prisma.shoppingList.findFirst({
      where: { userId: userId },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!lastShoppingList) {
      return NextResponse.json({ message: 'No shopping list found' }, { status: 404 });
    }

    return NextResponse.json({ shoppingList: lastShoppingList.data });
  } catch (error) {
    console.error('Error fetching last shopping list:', error);
    return NextResponse.json({ error: 'Failed to fetch last shopping list' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}