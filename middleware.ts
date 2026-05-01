import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, errors } from 'jose';

export async function middleware(request: NextRequest) {
  const cookieToken = request.cookies.get('session')?.value;
  const headerToken = request.headers.get('authorization')?.split(' ')[1];
  const token = cookieToken ?? headerToken;

  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    const userId = payload.userId;
    if (typeof userId !== 'number') {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    const headers = new Headers(request.headers);
    headers.delete('x-user-id');
    headers.set('x-user-id', String(userId));

    return NextResponse.next({ request: { headers } });
  } catch (error: unknown) {
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
  matcher: ['/api/((?!auth/login|auth/signup).*)'],
};
