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

    // Run queries in parallel
    const [
      [usersCount],
      [activeUsersCount],
      [smtpCount],
      [activeSmtpCount],
      [campaignsCount],
      [campaignsSum]
    ] = await Promise.all([
      db.query<RowDataPacket[]>('SELECT COUNT(*) as total FROM Users WHERE role = "user"'),
      db.query<RowDataPacket[]>('SELECT COUNT(*) as total FROM Users WHERE is_active = 1 AND role = "user"'),
      db.query<RowDataPacket[]>('SELECT COUNT(*) as total FROM smtp_accounts'),
      db.query<RowDataPacket[]>('SELECT COUNT(*) as total FROM smtp_accounts WHERE is_active = 1'),
      db.query<RowDataPacket[]>('SELECT COUNT(*) as total FROM Campaigns'),
      db.query<RowDataPacket[]>('SELECT COALESCE(SUM(sent_count), 0) as sent, COALESCE(SUM(failed_count), 0) as failed, COALESCE(SUM(opened_count), 0) as opened FROM Campaigns')
    ]);

    const stats = {
      totalUsers: usersCount[0]?.total || 0,
      activeUsers: activeUsersCount[0]?.total || 0,
      totalSmtp: smtpCount[0]?.total || 0,
      activeSmtp: activeSmtpCount[0]?.total || 0,
      totalCampaigns: campaignsCount[0]?.total || 0,
      totalSent: Number(campaignsSum[0]?.sent || 0),
      totalFailed: Number(campaignsSum[0]?.failed || 0),
      totalOpened: Number(campaignsSum[0]?.opened || 0),
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Admin Stats API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
