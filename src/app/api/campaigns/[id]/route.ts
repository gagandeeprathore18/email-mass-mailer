import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2/promise';

interface CampaignDetail extends RowDataPacket {
  id: number;
  subject: string;
  body: string;
  status: 'draft' | 'testing' | 'queued' | 'processing' | 'completed' | 'failed' | 'paused';
  created_at: Date;
  smtp_account_id?: number | null;
  smtp_label?: string | null;
  smtp_from_email?: string | null;
  sent_count: number;
  failed_count: number;
  started_at?: Date | null;
  completed_at?: Date | null;
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
              c.sent_count, c.failed_count, c.started_at, c.completed_at,
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

    const { subject, body } = await request.json();
    if ((subject === undefined || subject === null) && (body === undefined || body === null)) {
      return NextResponse.json({ error: 'Subject or body content is required.' }, { status: 400 });
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
    if (campaign.status === 'completed' || campaign.status === 'processing' || campaign.status === 'queued') {
      return NextResponse.json({ error: 'Cannot edit a campaign that is queued, processing, or completed.' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (subject !== undefined && subject !== null) {
      if (!subject.trim()) {
        return NextResponse.json({ error: 'Subject cannot be empty.' }, { status: 400 });
      }
      updates.push('subject = ?');
      params.push(subject.trim());
    }

    if (body !== undefined && body !== null) {
      if (!body.trim()) {
        return NextResponse.json({ error: 'Body cannot be empty.' }, { status: 400 });
      }
      updates.push('body = ?');
      params.push(body);
    }

    // Always reset status to 'draft'
    updates.push("status = 'draft'");
    params.push(campaignId);

    // Update campaign details
    await db.query(
      `UPDATE Campaigns SET ${updates.join(', ')} WHERE id = ?`,
      params
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
