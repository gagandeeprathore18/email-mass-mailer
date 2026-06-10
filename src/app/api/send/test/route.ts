import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { sendMailWithFallback } from '@/lib/smtp';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

interface UserSmtpRow extends RowDataPacket {
  email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_email: string;
  smtp_pass: string;
}

interface CampaignRow extends RowDataPacket {
  id: number;
  subject: string;
  body: string;
  status: string;
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

    // 1. Fetch user's SMTP configuration and account email
    const [users] = await db.query<UserSmtpRow[]>(
      'SELECT email, smtp_host, smtp_port, smtp_email, smtp_pass FROM Users WHERE id = ?',
      [user.id]
    );

    if (users.length === 0) {
      return NextResponse.json({ error: 'User SMTP settings not found' }, { status: 404 });
    }
    const smtpUser = users[0];

    // 2. Fetch campaign details
    const [campaigns] = await db.query<CampaignRow[]>(
      'SELECT id, subject, body, status FROM Campaigns WHERE id = ? AND user_id = ?',
      [campaignId, user.id]
    );

    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    const campaign = campaigns[0];

    // 3. Send test email to user's registered login email with TLS/SSL fallback
    const isHtml = campaign.body.includes('<') && campaign.body.includes('>');
    
    await sendMailWithFallback(
      {
        host: smtpUser.smtp_host,
        port: smtpUser.smtp_port,
        user: smtpUser.smtp_email,
        pass: smtpUser.smtp_pass,
      },
      {
        from: `"${smtpUser.smtp_email}" <${smtpUser.smtp_email}>`,
        to: smtpUser.email,
        subject: `[TEST] ${campaign.subject}`,
        text: isHtml ? undefined : campaign.body,
        html: isHtml ? campaign.body : undefined,
      }
    );

    // 4. Update campaign status to 'testing' if it was in 'draft'
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
