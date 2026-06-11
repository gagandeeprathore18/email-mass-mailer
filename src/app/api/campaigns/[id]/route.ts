import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

interface CampaignDetail extends RowDataPacket {
  id: number;
  subject: string;
  body: string;
  status: 'draft' | 'testing' | 'queued' | 'processing' | 'completed' | 'failed' | 'paused' | 'cancelled';
  created_at: Date;
  smtp_account_id?: number | null;
  smtp_label?: string | null;
  smtp_from_email?: string | null;
  sent_count: number;
  failed_count: number;
  started_at?: Date | null;
  completed_at?: Date | null;
  scheduled_at?: Date | null;
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
              c.sent_count, c.failed_count, c.started_at, c.completed_at, c.scheduled_at,
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

    // Fetch open counts
    const [openCountRows] = await db.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM Clients WHERE campaign_id = ? AND opened_at IS NOT NULL',
      [campaignId]
    );
    const openedCount = openCountRows[0].count;

    // Fetch sample clients with opened_at details
    const [clients] = await db.query<RowDataPacket[]>(
      'SELECT id, email, status, opened_at, created_at FROM Clients WHERE campaign_id = ? ORDER BY id ASC LIMIT 150',
      [campaignId]
    );

    // Fetch attachments
    const [attachments] = await db.query<RowDataPacket[]>(
      'SELECT id, file_name, file_path, file_size, mime_type, created_at FROM campaign_attachments WHERE campaign_id = ?',
      [campaignId]
    );

    return NextResponse.json({
      success: true,
      campaign: campaigns[0],
      counts: statusCounts,
      openedCount: Number(openedCount),
      clients,
      attachments,
    });
  } catch (error) {
    console.error('Fetch campaign detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign details' }, { status: 500 });
  }
}

export async function DELETE(
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

    // Verify ownership
    const [campaigns] = await db.query<RowDataPacket[]>(
      'SELECT id FROM Campaigns WHERE id = ? AND user_id = ?',
      [campaignId, user.id]
    );

    if (campaigns.length === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // 1. Delete physical files from disk
    const absoluteUploadDir = path.join(process.cwd(), 'uploads', `campaign_${campaignId}`);
    if (fs.existsSync(absoluteUploadDir)) {
      fs.rmSync(absoluteUploadDir, { recursive: true, force: true });
    }

    // 2. Delete database record (cascades client list and campaign_attachments)
    await db.query('DELETE FROM Campaigns WHERE id = ?', [campaignId]);

    return NextResponse.json({
      success: true,
      message: 'Campaign and all its files deleted successfully.'
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
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

    const { subject, body, scheduledAt } = await request.json();
    if (
      (subject === undefined || subject === null) && 
      (body === undefined || body === null) &&
      scheduledAt === undefined
    ) {
      return NextResponse.json({ error: 'Subject, body, or scheduledAt content is required.' }, { status: 400 });
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
    if (campaign.status === 'completed' || campaign.status === 'processing' || campaign.status === 'failed') {
      return NextResponse.json({ error: 'Cannot edit a campaign that is processing, completed, or failed.' }, { status: 400 });
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

    if (scheduledAt !== undefined) {
      if (scheduledAt === null || scheduledAt === '') {
        updates.push('scheduled_at = NULL');
      } else {
        const scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
          return NextResponse.json({ error: 'Invalid scheduled date and time.' }, { status: 400 });
        }
        if (scheduledDate.getTime() < Date.now() - 5000) {
          return NextResponse.json({ error: 'Cannot schedule campaigns in the past.' }, { status: 400 });
        }
        updates.push('scheduled_at = ?');
        params.push(scheduledDate);
      }
    }

    // Ensure status remains 'queued' if currently queued or if scheduling is set, otherwise 'draft'
    if (campaign.status === 'queued' || (scheduledAt !== undefined && scheduledAt !== null && scheduledAt !== '')) {
      updates.push("status = 'queued'");
    } else {
      updates.push("status = 'draft'");
    }
    
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
