import { NextResponse } from 'next/server';
import {prisma} from '../../lib/prisma';
import { jwtVerify } from 'jose';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
      const userId = payload.userId as number;

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
      return NextResponse.json({ error: `Invalid token ${error}` }, { status: 401 });
    }
  } catch (error) {
    console.error('Error fetching last shopping list:', error);
    return NextResponse.json({ error: 'Failed to fetch last shopping list' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}