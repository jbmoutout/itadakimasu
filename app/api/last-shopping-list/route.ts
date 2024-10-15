import { NextResponse } from 'next/server';
import prisma from '../../lib/prisma';

export async function GET() {
  try {
    const lastShoppingList = await prisma.shoppingList.findFirst({
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!lastShoppingList) {
      return NextResponse.json({ message: 'No shopping list found' }, { status: 404 });
    }

    return NextResponse.json({ shoppingList: lastShoppingList.data });
  } catch (error) {
    return NextResponse.json({ error: `Failed to fetch last shopping list ${error}` }, { status: 500 });
  }
}