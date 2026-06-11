import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { verifySmtpConnection, createTransporter } from '@/lib/smtp';
import { decryptPassword } from '@/lib/encryption';
import { RowDataPacket } from 'mysql2/promise';

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

interface ClientRow extends RowDataPacket {
  id: number;
  email: string;
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

    // 1. Fetch Campaign details
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

    // Verify test send was done (status should be 'testing')
    if (campaign.status !== 'testing') {
      return NextResponse.json(
        { error: 'You must successfully run a test send before executing bulk dispatch.' },
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

    // Verify ownership
    if (smtp.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to use this SMTP account' }, { status: 403 });
    }

    // Verify active & verified status
    if (!smtp.is_active) {
      return NextResponse.json({ error: 'SMTP account is inactive' }, { status: 400 });
    }

    if (!smtp.is_verified) {
      return NextResponse.json({ error: 'SMTP account is not verified' }, { status: 400 });
    }

    // 3. Fetch all pending clients
    const [clients] = await db.query<ClientRow[]>(
      "SELECT id, email FROM Clients WHERE campaign_id = ? AND status = 'pending'",
      [campaignId]
    );

    if (clients.length === 0) {
      return NextResponse.json(
        { error: 'No pending recipients found for this campaign.' },
        { status: 400 }
      );
    }

    // 4. Trigger bulk send in background
    runBulkSendBackground(campaignId, smtp, clients, campaign.subject, campaign.body);

    return NextResponse.json({
      success: true,
      message: 'Bulk mailing execution started.',
      totalPending: clients.length,
    });
  } catch (error) {
    console.error('Execute Send API error:', error);
    return NextResponse.json({ error: 'Failed to initiate bulk sending' }, { status: 500 });
  }
}

// Background executor
async function runBulkSendBackground(
  campaignId: number,
  smtp: SmtpAccountRow,
  clients: ClientRow[],
  subject: string,
  body: string
) {
  console.log(`Starting background bulk send for campaign ${campaignId} with ${clients.length} recipients.`);
  
  // Determine if we need to bypass TLS certificate validation for this mail server
  let rejectUnauthorized = true;
  try {
    const passDecrypted = decryptPassword(smtp.encrypted_password);
    const verification = await verifySmtpConnection({
      host: smtp.host,
      port: smtp.port,
      user: smtp.username,
      pass: passDecrypted,
    });
    rejectUnauthorized = verification.rejectUnauthorized;
  } catch (verifyErr) {
    console.error('SMTP connection pre-check failed during bulk dispatch:', verifyErr);
    // Default to relaxed TLS validation if connection fails on certificate mismatch
    rejectUnauthorized = false;
  }

  const transporter = createTransporter(
    {
      host: smtp.host,
      port: smtp.port,
      username: smtp.username,
      encrypted_password: smtp.encrypted_password,
    },
    {
      rejectUnauthorized,
      pool: true,
    }
  );

  const isHtml = body.includes('<') && body.includes('>');

  for (const client of clients) {
    try {
      await transporter.sendMail({
        from: `"${smtp.from_email}" <${smtp.from_email}>`,
        to: client.email,
        subject: subject,
        text: isHtml ? undefined : body,
        html: isHtml ? body : undefined,
      });

      // Update client status in DB to 'sent'
      await db.query('UPDATE Clients SET status = ? WHERE id = ?', ['sent', client.id]);
    } catch (err) {
      console.error(`Failed to send email to ${client.email}:`, err);
      // Update client status in DB to 'failed'
      await db.query('UPDATE Clients SET status = ? WHERE id = ?', ['failed', client.id]);
    }

    // 300ms throttling between sends
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // Mark campaign status as 'executed'
  try {
    await db.query("UPDATE Campaigns SET status = 'executed' WHERE id = ?", [campaignId]);
    console.log(`Finished background bulk send for campaign ${campaignId}.`);
  } catch (dbErr) {
    console.error('Failed to update campaign status to executed:', dbErr);
  } finally {
    transporter.close();
  }
}
