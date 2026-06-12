import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { encryptPassword } from '@/lib/encryption';
import { logActivity } from '@/lib/activityLogger';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export async function GET() {
  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [smtpAccounts] = await db.query<RowDataPacket[]>(
      'SELECT id, label, host, port, username, from_email, is_verified, is_active, daily_limit, emails_sent_today, created_at FROM smtp_accounts ORDER BY created_at DESC'
    );

    return NextResponse.json({ success: true, smtpAccounts });
  } catch (error) {
    console.error('Admin GET SMTP Error:', error);
    return NextResponse.json({ error: 'Failed to fetch SMTP accounts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { label, host, port, username, password, fromEmail } = body;

    if (!label || !host || !port || !username || !password || !fromEmail) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    const portNum = parseInt(port, 10);
    if (isNaN(portNum)) {
      return NextResponse.json({ error: 'Invalid port number.' }, { status: 400 });
    }

    const encryptedPassword = encryptPassword(password);

    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO smtp_accounts (user_id, label, host, port, username, encrypted_password, from_email, is_active, is_verified, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
      [adminUser.id, label, host, portNum, username, encryptedPassword, fromEmail, adminUser.id]
    );

    await logActivity(adminUser.id, `Admin Created SMTP Account: ${label} (${fromEmail})`);

    return NextResponse.json({
      success: true,
      smtpAccountId: result.insertId,
      message: 'SMTP account created successfully.'
    });
  } catch (error) {
    console.error('Admin POST SMTP Error:', error);
    return NextResponse.json({ error: 'Failed to create SMTP account' }, { status: 500 });
  }
}
