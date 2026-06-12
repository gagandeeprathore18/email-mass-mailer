import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { decryptPassword } from '@/lib/encryption';
import { verifySmtpConnection } from '@/lib/smtp';
import { logActivity } from '@/lib/activityLogger';
import { RowDataPacket } from 'mysql2/promise';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const smtpId = parseInt(id, 10);
    if (isNaN(smtpId)) {
      return NextResponse.json({ error: 'Invalid SMTP ID' }, { status: 400 });
    }

    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT label, host, port, username, encrypted_password FROM smtp_accounts WHERE id = ?',
      [smtpId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'SMTP account not found' }, { status: 404 });
    }

    const smtp = rows[0];
    const password = decryptPassword(smtp.encrypted_password);

    let verificationResult;
    try {
      verificationResult = await verifySmtpConnection({
        host: smtp.host,
        port: Number(smtp.port),
        user: smtp.username,
        pass: password,
      });
    } catch (verifyError: any) {
      // SMTP Verification failed
      await db.query('UPDATE smtp_accounts SET is_verified = 0 WHERE id = ?', [smtpId]);
      await logActivity(adminUser.id, `Admin SMTP Connection Verification Failed for: ${smtp.label}`);
      return NextResponse.json({
        success: false,
        error: verifyError.message || 'SMTP Connection Test Failed.',
      });
    }

    if (verificationResult.success) {
      await db.query('UPDATE smtp_accounts SET is_verified = 1 WHERE id = ?', [smtpId]);
      await logActivity(adminUser.id, `Admin SMTP Connection Verification Succeeded for: ${smtp.label}`);
      return NextResponse.json({
        success: true,
        message: 'SMTP Verification successful!',
        warning: verificationResult.warning,
      });
    } else {
      await db.query('UPDATE smtp_accounts SET is_verified = 0 WHERE id = ?', [smtpId]);
      return NextResponse.json({
        success: false,
        error: 'SMTP Connection Test failed.',
      });
    }

  } catch (error: any) {
    console.error('SMTP Verify Route error:', error);
    return NextResponse.json({ error: 'Failed to verify SMTP connection: ' + error.message }, { status: 500 });
  }
}
