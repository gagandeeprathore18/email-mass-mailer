import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2/promise';

export async function POST(
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

    // Verify ownership and fetch status
    const [campaigns] = await db.query<RowDataPacket[]>(
      'SELECT id, status FROM Campaigns WHERE id = ? AND user_id = ?',
      [campaignId, user.id]
    );

    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaigns[0];
    
    // Only allow cancelling if status is draft or queued
    if (campaign.status !== 'draft' && campaign.status !== 'queued') {
      return NextResponse.json({ 
        error: 'Cannot cancel a campaign that is already processing, completed, or failed.' 
      }, { status: 400 });
    }

    // Set status to cancelled
    await db.query(
      "UPDATE Campaigns SET status = 'cancelled' WHERE id = ?",
      [campaignId]
    );

    return NextResponse.json({
      success: true,
      message: 'Campaign canceled successfully.'
    });

  } catch (error) {
    console.error('Cancel campaign API error:', error);
    return NextResponse.json({ error: 'Failed to cancel campaign.' }, { status: 500 });
  }
}
