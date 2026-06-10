import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super_secret_jwt_key_please_change_this_in_production'
);

export interface UserPayload {
  id: number;
  email: string;
  [key: string]: unknown;
}

export async function signToken(payload: UserPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserPayload;
  } catch (error) {
    return null;
  }
}

export async function getAuthenticatedUser(): Promise<UserPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch (e) {
    return null;
  }
}
