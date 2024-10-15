import { NextResponse } from 'next/server';
import {prisma} from '../../lib/prisma';

export async function POST(request: Request) {
  try {
    const updatedShoppingList = await request.json();

    const lastShoppingList = await prisma.shoppingList.findFirst({
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!lastShoppingList) {
      return NextResponse.json({ error: 'No shopping list found' }, { status: 404 });
    }

    const updatedList = await prisma.shoppingList.update({
      where: { id: lastShoppingList.id },
      data: { data: updatedShoppingList }
    });

    return NextResponse.json({ success: true, shoppingList: updatedList.data });
  } catch (error) {
    console.error('Error updating shopping list:', error);
    return NextResponse.json({ error: 'Failed to update shopping list' }, { status: 500 });
  }
}