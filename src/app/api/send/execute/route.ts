import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2/promise';

interface CampaignRow extends RowDataPacket {
  id: number;
  subject: string;
  body: string;
  status: string;
  smtp_account_id: number | null;
}

interface SmtpAccountCheck extends RowDataPacket {
  id: number;
  user_id: number;
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

    // 2. Fetch specific SMTP configuration from smtp_accounts table to verify it exists and belongs to the user
    const [smtpAccounts] = await db.query<SmtpAccountCheck[]>(
      'SELECT id, user_id FROM smtp_accounts WHERE id = ?',
      [campaign.smtp_account_id]
    );

    if (smtpAccounts.length === 0) {
      return NextResponse.json({ error: 'SMTP account not found' }, { status: 404 });
    }
    const smtp = smtpAccounts[0];

    // Verify SMTP account assignment
    const [accessRows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM user_smtp_access WHERE user_id = ? AND smtp_account_id = ?',
      [user.id, campaign.smtp_account_id]
    );

    if (user.role !== 'admin' && accessRows.length === 0) {
      return NextResponse.json({ error: 'Unauthorized to use this SMTP account' }, { status: 403 });
    }

    // 3. Fetch count of pending/failed clients to ensure there is work to do
    const [clients] = await db.query<ClientRow[]>(
      "SELECT id FROM Clients WHERE campaign_id = ? AND status IN ('pending', 'failed')",
      [campaignId]
    );

    if (clients.length === 0) {
      return NextResponse.json(
        { error: 'No pending or failed recipients found for this campaign.' },
        { status: 400 }
      );
    }

    // Reset failed clients to pending so they are retried, and set status to queued
    await db.query(
      "UPDATE Clients SET status = 'pending' WHERE campaign_id = ? AND status = 'failed'",
      [campaignId]
    );

    await db.query(
      "UPDATE Campaigns SET status = 'queued', sent_count = 0, failed_count = 0, started_at = NULL, completed_at = NULL WHERE id = ?",
      [campaignId]
    );

    return NextResponse.json({
      success: true,
      message: 'Campaign queued successfully',
    });
  } catch (error) {
    console.error('Execute Send API error:', error);
    return NextResponse.json({ error: 'Failed to queue campaign' }, { status: 500 });
  }
}

