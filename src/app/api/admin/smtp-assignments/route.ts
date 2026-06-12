import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { logActivity } from '@/lib/activityLogger';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export async function GET() {
  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all SMTP assignments
    const [assignments] = await db.query<RowDataPacket[]>(
      `SELECT usa.id, usa.user_id, usa.smtp_account_id, u.email as user_email, u.name as user_name, sa.label as smtp_label, sa.from_email as smtp_from
       FROM user_smtp_access usa 
       JOIN Users u ON usa.user_id = u.id 
       JOIN smtp_accounts sa ON usa.smtp_account_id = sa.id
       ORDER BY usa.created_at DESC`
    );

    // Fetch all users and SMTP accounts for assignment selectors
    const [users] = await db.query<RowDataPacket[]>('SELECT id, email, name FROM Users WHERE role = "user" AND is_active = 1');
    const [smtpAccounts] = await db.query<RowDataPacket[]>('SELECT id, label, from_email FROM smtp_accounts WHERE is_active = 1');

    return NextResponse.json({
      success: true,
      assignments,
      users,
      smtpAccounts
    });
  } catch (error) {
    console.error('Admin GET SMTP Access Error:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, smtpAccountId } = body;

    if (!userId || !smtpAccountId) {
      return NextResponse.json({ error: 'User and SMTP Account are required.' }, { status: 400 });
    }

    // Check if duplicate assignment exists
    const [existing] = await db.query<RowDataPacket[]>(
      'SELECT id FROM user_smtp_access WHERE user_id = ? AND smtp_account_id = ?',
      [userId, smtpAccountId]
    );

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Assignment already exists.' }, { status: 400 });
    }

    // Get user and smtp labels for logging
    const [
      [userRow],
      [smtpRow]
    ] = await Promise.all([
      db.query<RowDataPacket[]>('SELECT email FROM Users WHERE id = ?', [userId]),
      db.query<RowDataPacket[]>('SELECT label FROM smtp_accounts WHERE id = ?', [smtpAccountId])
    ]);

    if (!userRow[0] || !smtpRow[0]) {
      return NextResponse.json({ error: 'User or SMTP Account not found.' }, { status: 404 });
    }

    const [result] = await db.query<ResultSetHeader>(
      'INSERT INTO user_smtp_access (user_id, smtp_account_id) VALUES (?, ?)',
      [userId, smtpAccountId]
    );

    await logActivity(
      adminUser.id,
      `Admin Assigned SMTP Account: ${smtpRow[0].label} to User: ${userRow[0].email}`
    );

    return NextResponse.json({
      success: true,
      assignmentId: result.insertId,
      message: 'SMTP account assigned successfully.'
    });
  } catch (error) {
    console.error('Admin POST SMTP Access Error:', error);
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
  }
}
