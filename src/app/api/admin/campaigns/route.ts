import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2/promise';

export async function GET() {
  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [campaigns] = await db.query<RowDataPacket[]>(
      `SELECT c.id, c.subject, c.body, c.status, c.created_at, c.sent_count, c.failed_count, c.opened_count, c.scheduled_at,
              u.email as creator_email, u.name as creator_name,
              sa.label as smtp_label
       FROM Campaigns c
       JOIN Users u ON c.user_id = u.id
       LEFT JOIN smtp_accounts sa ON c.smtp_account_id = sa.id
       ORDER BY c.created_at DESC`
    );

    return NextResponse.json({ success: true, campaigns });
  } catch (error) {
    console.error('Admin GET Campaigns Error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}
