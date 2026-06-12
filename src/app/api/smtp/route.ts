import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2/promise';

interface SmtpAccountRow extends RowDataPacket {
  id: number;
  label: string;
  from_email: string;
  is_verified: boolean;
  is_active: boolean;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = '';
    let params: any[] = [];

    // Admins see all SMTP accounts, users see only assigned ones
    if (user.role === 'admin') {
      query = `SELECT id, label, from_email, is_verified, is_active 
               FROM smtp_accounts 
               ORDER BY created_at DESC`;
    } else {
      query = `SELECT sa.id, sa.label, sa.from_email, sa.is_verified, sa.is_active 
               FROM smtp_accounts sa
               JOIN user_smtp_access usa ON sa.id = usa.smtp_account_id
               WHERE usa.user_id = ? AND sa.is_active = 1
               ORDER BY sa.created_at DESC`;
      params.push(user.id);
    }

    const [smtpAccounts] = await db.query<SmtpAccountRow[]>(query, params);

    return NextResponse.json({ success: true, smtpAccounts });
  } catch (error) {
    console.error('Fetch SMTP accounts error:', error);
    return NextResponse.json({ error: 'Failed to fetch SMTP accounts' }, { status: 500 });
  }
}

import { verifySmtpConnection } from '@/lib/smtp';
import { encryptPassword } from '@/lib/encryption';
import { ResultSetHeader } from 'mysql2/promise';

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Regular users cannot add SMTP accounts
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { label, host, port, username, password, from_email } = await request.json();

    if (!label || !host || !port || !username || !password || !from_email) {
      return NextResponse.json(
        { error: 'All fields (label, host, port, username, password, from_email) are required.' },
        { status: 400 }
      );
    }

    const portNum = parseInt(port, 10);
    if (isNaN(portNum)) {
      return NextResponse.json({ error: 'Port must be a valid number.' }, { status: 400 });
    }

    // 1. Verify connection using dynamic TLS/SSL mismatch fallback
    try {
      await verifySmtpConnection({
        host,
        port: portNum,
        user: username,
        pass: password,
      });
    } catch (smtpError: any) {
      console.error('SMTP Setup verification failed:', smtpError);
      return NextResponse.json(
        { error: `SMTP verification failed: ${smtpError.message || 'Unable to connect to SMTP server'}` },
        { status: 400 }
      );
    }

    // 2. Encrypt password securely
    const encryptedPassword = encryptPassword(password);

    // 3. Save to database
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO smtp_accounts 
       (user_id, label, host, port, username, encrypted_password, from_email, is_verified, is_active, is_default, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 0, ?)`,
      [user.id, label, host, portNum, username, encryptedPassword, from_email, user.id]
    );

    return NextResponse.json({
      success: true,
      message: 'SMTP account verified and added successfully.',
      accountId: result.insertId,
    });
  } catch (error) {
    console.error('Add SMTP account error:', error);
    return NextResponse.json({ error: 'Failed to add SMTP account' }, { status: 500 });
  }
}
