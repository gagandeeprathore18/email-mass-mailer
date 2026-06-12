import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2/promise';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [logs] = await db.query<RowDataPacket[]>(
      `SELECT al.id, al.action, al.created_at, u.email, u.name
       FROM activity_logs al
       JOIN Users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT 100`
    );

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('Admin Logs API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
  }
}
