import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { sendMailWithFallback } from '@/lib/smtp';
import { decryptPassword } from '@/lib/encryption';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import path from 'path';

interface SmtpAccountRow extends RowDataPacket {
  id: number;
  user_id: number;
  host: string;
  port: number;
  username: string;
  encrypted_password: string;
  from_email: string;
  is_active: number | boolean;
  is_verified: number | boolean;
}

interface CampaignRow extends RowDataPacket {
  id: number;
  subject: string;
  body: string;
  status: string;
  smtp_account_id: number | null;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaignId } = await request.json();
    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    // 1. Fetch campaign details
    const [campaigns] = await db.query<CampaignRow[]>(
      'SELECT id, subject, body, status, smtp_account_id FROM Campaigns WHERE id = ? AND user_id = ?',
      [campaignId, user.id]
    );

    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    const campaign = campaigns[0];

    if (!campaign.smtp_account_id) {
      return NextResponse.json(
        { error: 'Campaign has no sending account configured' },
        { status: 400 }
      );
    }

    // 2. Fetch specific SMTP configuration from smtp_accounts table
    const [smtpAccounts] = await db.query<SmtpAccountRow[]>(
      'SELECT id, user_id, host, port, username, encrypted_password, from_email, is_active, is_verified FROM smtp_accounts WHERE id = ?',
      [campaign.smtp_account_id]
    );

    if (smtpAccounts.length === 0) {
      return NextResponse.json({ error: 'SMTP account not found' }, { status: 404 });
    }
    const smtp = smtpAccounts[0];

    // Verify SMTP account assignment, verification, and status
    const [accessRows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM user_smtp_access WHERE user_id = ? AND smtp_account_id = ?',
      [user.id, campaign.smtp_account_id]
    );

    if (user.role !== 'admin' && accessRows.length === 0) {
      return NextResponse.json({ error: 'Unauthorized to use this SMTP account' }, { status: 403 });
    }

    if (!smtp.is_active) {
      return NextResponse.json({ error: 'SMTP account is inactive' }, { status: 400 });
    }

    if (!smtp.is_verified) {
      return NextResponse.json({ error: 'SMTP account is not verified' }, { status: 400 });
    }

    // 3. Fetch user's registered login email to send the test email to
    const [users] = await db.query<RowDataPacket[]>(
      'SELECT email FROM Users WHERE id = ?',
      [user.id]
    );
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userEmail = users[0].email;

    // Fetch campaign attachments
    const [attachmentRows] = await db.query<RowDataPacket[]>(
      "SELECT file_name, file_path FROM campaign_attachments WHERE campaign_id = ?",
      [campaignId]
    );

    const attachments = attachmentRows.map(file => ({
      filename: file.file_name,
      path: path.join(process.cwd(), file.file_path)
    }));

    // 4. Send test email to user's registered login email with TLS/SSL fallback
    const isHtml = campaign.body.includes('<') && campaign.body.includes('>');
    const passDecrypted = decryptPassword(smtp.encrypted_password);
    
    await sendMailWithFallback(
      {
        host: smtp.host,
        port: smtp.port,
        user: smtp.username,
        pass: passDecrypted,
      },
      {
        from: `"${smtp.from_email}" <${smtp.from_email}>`,
        to: userEmail,
        subject: `[TEST] ${campaign.subject}`,
        text: isHtml ? undefined : campaign.body,
        html: isHtml ? campaign.body : undefined,
        attachments, // Campaign attachments
      }
    );


    // 5. Update campaign status to 'testing' if it was in 'draft'
    if (campaign.status === 'draft') {
      await db.query<ResultSetHeader>(
        "UPDATE Campaigns SET status = 'testing' WHERE id = ?",
        [campaignId]
      );
    }

    return NextResponse.json({ success: true, message: 'Test email sent successfully' });
  } catch (error: unknown) {
    console.error('Test Send API error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to send test email: ${msg}` }, { status: 500 });
  }
}
