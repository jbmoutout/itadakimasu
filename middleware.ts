import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split(' ')[1];

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    return NextResponse.next();
  } catch (error) {
    return NextResponse.json({ error: `Invalid token ${error}` }, { status: 401 });
  }
}

export const config = {
  matcher: ['/api/add-recipe', '/api/generate-shopping-list', '/api/update-shopping-list', '/api/last-shopping-list', '/api/recipes'],
};