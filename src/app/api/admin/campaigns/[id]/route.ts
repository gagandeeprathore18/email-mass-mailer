import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { logActivity } from '@/lib/activityLogger';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const campaignId = parseInt(id, 10);
    if (isNaN(campaignId)) {
      return NextResponse.json({ error: 'Invalid Campaign ID' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be pause, resume, or cancel.' }, { status: 400 });
    }

    const [campaigns] = await db.query<RowDataPacket[]>(
      'SELECT subject, status FROM Campaigns WHERE id = ?',
      [campaignId]
    );

    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const campaign = campaigns[0];
    let newStatus = '';
    let logMessage = '';

    if (action === 'pause') {
      if (campaign.status !== 'queued' && campaign.status !== 'processing') {
        return NextResponse.json({ error: 'Only queued or processing campaigns can be paused.' }, { status: 400 });
      }
      newStatus = 'paused';
      logMessage = `Admin Paused Campaign: ${campaign.subject}`;
    } else if (action === 'resume') {
      if (campaign.status !== 'paused') {
        return NextResponse.json({ error: 'Only paused campaigns can be resumed.' }, { status: 400 });
      }
      newStatus = 'queued';
      logMessage = `Admin Resumed Campaign: ${campaign.subject}`;
    } else if (action === 'cancel') {
      if (campaign.status === 'completed' || campaign.status === 'failed' || campaign.status === 'cancelled') {
        return NextResponse.json({ error: 'Campaign already completed, failed, or cancelled.' }, { status: 400 });
      }
      newStatus = 'cancelled';
      logMessage = `Admin Cancelled Campaign: ${campaign.subject}`;
    }

    await db.query('UPDATE Campaigns SET status = ? WHERE id = ?', [newStatus, campaignId]);
    await logActivity(adminUser.id, logMessage);

    return NextResponse.json({ success: true, message: `Campaign status updated to ${newStatus}.` });
  } catch (error) {
    console.error('Admin PUT Campaign Error:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}
