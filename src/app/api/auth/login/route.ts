import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { RowDataPacket } from 'mysql2/promise';

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  password_hash: string;
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const [users] = await db.query<UserRow[]>(
      'SELECT id, email, password_hash FROM Users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const token = await signToken({ id: user.id, email: user.email });
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error('Login Route Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during login.' },
      { status: 500 }
    );
  }
}
