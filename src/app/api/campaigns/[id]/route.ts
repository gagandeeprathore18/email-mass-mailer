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

    // Fetch the campaign belonging to current user
    const [campaigns] = await db.query<CampaignDetail[]>(
      'SELECT id, subject, body, status, created_at FROM Campaigns WHERE id = ? AND user_id = ?',
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
