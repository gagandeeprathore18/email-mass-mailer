import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2/promise';

interface CampaignDetail extends RowDataPacket {
  id: number;
  subject: string;
  body: string;
  status: 'draft' | 'testing' | 'executed';
  created_at: Date;
  smtp_account_id?: number | null;
  smtp_label?: string | null;
  smtp_from_email?: string | null;
}

interface ClientSummary extends RowDataPacket {
  status: 'pending' | 'sent' | 'failed';
  count: number;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const campaignId = parseInt(id, 10);
    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
    }

    // Fetch the campaign belonging to current user with sending account label/email
    const [campaigns] = await db.query<CampaignDetail[]>(
      `SELECT c.id, c.subject, c.body, c.status, c.created_at, c.smtp_account_id,
              sa.label as smtp_label, sa.from_email as smtp_from_email
       FROM Campaigns c
       LEFT JOIN smtp_accounts sa ON c.smtp_account_id = sa.id
       WHERE c.id = ? AND c.user_id = ?`,
      [campaignId, user.id]
    );

    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Fetch client counts grouped by status
    const [statusCounts] = await db.query<ClientSummary[]>(
      'SELECT status, COUNT(*) as count FROM Clients WHERE campaign_id = ? GROUP BY status',
      [campaignId]
    );

    // Fetch sample clients
    const [clients] = await db.query<RowDataPacket[]>(
      'SELECT id, email, status, created_at FROM Clients WHERE campaign_id = ? ORDER BY id ASC LIMIT 150',
      [campaignId]
    );

    return NextResponse.json({
      success: true,
      campaign: campaigns[0],
      counts: statusCounts,
      clients,
    });
  } catch (error) {
    console.error('Fetch campaign detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign details' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const campaignId = parseInt(id, 10);
    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'Invalid campaign ID' }, { status: 400 });
    }

    const { body } = await request.json();
    if (body === undefined || body === null) {
      return NextResponse.json({ error: 'Body content is required.' }, { status: 400 });
    }

    // Verify ownership and execution status
    const [campaigns] = await db.query<CampaignDetail[]>(
      'SELECT id, status FROM Campaigns WHERE id = ? AND user_id = ?',
      [campaignId, user.id]
    );

    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaigns[0];
    if (campaign.status === 'executed') {
      return NextResponse.json({ error: 'Cannot edit a campaign that has already been executed.' }, { status: 400 });
    }

    // Update body and reset status to 'draft'
    await db.query(
      "UPDATE Campaigns SET body = ?, status = 'draft' WHERE id = ?",
      [body, campaignId]
    );

    return NextResponse.json({
      success: true,
      message: 'Campaign updated successfully.'
    });
  } catch (error) {
    console.error('Edit campaign body error:', error);
    return NextResponse.json({ error: 'Failed to update campaign body' }, { status: 500 });
  }
}
