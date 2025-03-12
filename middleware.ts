import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, errors } from 'jose';

export async function middleware(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split(' ')[1];

  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    return NextResponse.next();
  } catch (error: unknown) {
    // Handle specific JWT errors
    if (error instanceof errors.JWTExpired) {
      return NextResponse.json({ error: 'Token has expired' }, { status: 401 });
    }
    if (error instanceof errors.JWTInvalid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }
}

export const config = {
  matcher: ['/api/add-recipe', '/api/generate-shopping-list', '/api/update-shopping-list', '/api/last-shopping-list', '/api/recipes'],
};