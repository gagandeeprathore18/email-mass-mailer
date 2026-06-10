import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { verifySmtpConnection, createSmtpTransporter } from '@/lib/smtp';
import { RowDataPacket } from 'mysql2/promise';

interface UserSmtpRow extends RowDataPacket {
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
      'SELECT id, subject, body, status FROM Campaigns WHERE id = ? AND user_id = ?',
      [campaignId, user.id]
    );

    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaigns[0];

    // Verify test send was done (status should be 'testing')
    if (campaign.status !== 'testing') {
      return NextResponse.json(
        { error: 'You must successfully run a test send before executing bulk dispatch.' },
        { status: 400 }
      );
    }

    // 2. Fetch User SMTP configuration
    const [users] = await db.query<UserSmtpRow[]>(
      'SELECT smtp_host, smtp_port, smtp_email, smtp_pass FROM Users WHERE id = ?',
      [user.id]
    );

    if (users.length === 0) {
      return NextResponse.json({ error: 'User SMTP settings not found' }, { status: 404 });
    }
    const smtp = users[0];

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
  smtp: UserSmtpRow,
  clients: ClientRow[],
  subject: string,
  body: string
) {
  console.log(`Starting background bulk send for campaign ${campaignId} with ${clients.length} recipients.`);
  
  // Determine if we need to bypass TLS certificate validation for this mail server
  let rejectUnauthorized = true;
  try {
    const verification = await verifySmtpConnection({
      host: smtp.smtp_host,
      port: smtp.smtp_port,
      user: smtp.smtp_email,
      pass: smtp.smtp_pass,
    });
    rejectUnauthorized = verification.rejectUnauthorized;
  } catch (verifyErr) {
    console.error('SMTP connection pre-check failed during bulk dispatch:', verifyErr);
    // Default to relaxed TLS validation if connection fails on certificate mismatch
    rejectUnauthorized = false;
  }

  const transporter = createSmtpTransporter(
    {
      host: smtp.smtp_host,
      port: smtp.smtp_port,
      user: smtp.smtp_email,
      pass: smtp.smtp_pass,
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
        from: `"${smtp.smtp_email}" <${smtp.smtp_email}>`,
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
