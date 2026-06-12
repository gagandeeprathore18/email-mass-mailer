import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2/promise';

interface UserProfileRow extends RowDataPacket {
  id: number;
  email: string;
  smtp_host: string;
  smtp_email: string;
  smtp_port: number;
  role: 'admin' | 'user';
  name: string | null;
}

export async function GET() {
  try {
    const tokenUser = await getAuthenticatedUser();
    if (!tokenUser) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const [users] = await db.query<UserProfileRow[]>(
      'SELECT id, email, smtp_host, smtp_email, smtp_port, role, name FROM Users WHERE id = ?',
      [tokenUser.id]
    );

    if (users.length === 0) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: users[0],
    });
  } catch (error) {
    console.error('Fetch me route error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
