import './load-env';
import db from './src/lib/db';
import { verifySmtpConnection, createTransporter } from './src/lib/smtp';
import { decryptPassword } from './src/lib/encryption';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import crypto from 'crypto';

interface CampaignRow extends RowDataPacket {
  id: number;
  subject: string;
  body: string;
  status: string;
  smtp_account_id: number;
}

interface SmtpAccountRow extends RowDataPacket {
  id: number;
  host: string;
  port: number;
  username: string;
  encrypted_password: string;
  from_email: string;
  is_active: number;
  is_verified: number;
}

interface ClientRow extends RowDataPacket {
  id: number;
  email: string;
}

// Main polling loop delay
const POLL_INTERVAL_MS = 3000;

async function checkAndProcessQueue() {
  let connection;
  try {
    // 1. Fetch campaigns that are in 'queued' state
    const [queuedCampaigns] = await db.query<CampaignRow[]>(
      "SELECT id, subject, body, smtp_account_id FROM Campaigns WHERE status = 'queued' ORDER BY created_at ASC"
    );

    if (queuedCampaigns.length === 0) {
      return;
    }

    // Attempt to claim one campaign using concurrency lock
    for (const campaign of queuedCampaigns) {
      const [claimResult] = await db.query<ResultSetHeader>(
        "UPDATE Campaigns SET status = 'processing', started_at = NOW() WHERE id = ? AND status = 'queued'",
        [campaign.id]
      );

      // Concurrency lock: If another worker updated the status first, affectedRows is 0
      if (claimResult.affectedRows === 0) {
        console.log(`Campaign ${campaign.id} already claimed by another worker, skipping.`);
        continue;
      }

      console.log(`Worker claimed Campaign ${campaign.id}. Starting processing.`);
      await processCampaign(campaign);
      // We only process one campaign per poll cycle to spread load across worker cycles/instances
      break;
    }
  } catch (error) {
    console.error('Error in queue poller:', error);
  }
}

async function processCampaign(campaign: CampaignRow) {
  try {
    // 1. Fetch SMTP Account details
    const [smtpRows] = await db.query<SmtpAccountRow[]>(
      "SELECT host, port, username, encrypted_password, from_email, is_active, is_verified FROM smtp_accounts WHERE id = ?",
      [campaign.smtp_account_id]
    );

    if (smtpRows.length === 0) {
      throw new Error(`SMTP account ID ${campaign.smtp_account_id} not found.`);
    }

    const smtp = smtpRows[0];
    if (!smtp.is_active || !smtp.is_verified) {
      throw new Error(`SMTP account is inactive or unverified.`);
    }

    // 2. Fetch all pending clients
    const [clients] = await db.query<ClientRow[]>(
      "SELECT id, email FROM Clients WHERE campaign_id = ? AND status = 'pending' ORDER BY id ASC",
      [campaign.id]
    );

    if (clients.length === 0) {
      console.log(`Campaign ${campaign.id} has no pending clients.`);
      await db.query(
        "UPDATE Campaigns SET status = 'completed', completed_at = NOW() WHERE id = ?",
        [campaign.id]
      );
      return;
    }

    console.log(`Campaign ${campaign.id}: Processing ${clients.length} recipients.`);

    // 3. Establish transporter using TLS fallback check
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
    } catch (verifyErr: any) {
      console.warn(`SMTP pre-check warning for Campaign ${campaign.id}:`, verifyErr.message);
      rejectUnauthorized = false; // default to relaxed TLS
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

    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // 4. Send emails with throttling
    for (const client of clients) {
      try {
        const trackingId = crypto.randomUUID();
        
        // Save tracking ID in database
        await db.query("UPDATE Clients SET tracking_id = ? WHERE id = ?", [trackingId, client.id]);

        // Construct tracking pixel html
        const pixelHtml = `<img src="${appUrl}/api/track/open/${trackingId}" width="1" height="1" style="display:none;" />`;

        // Check if original campaign body is HTML
        const isHtml = campaign.body.includes('<') && campaign.body.includes('>');
        let finalHtml = '';

        if (isHtml) {
          if (campaign.body.toLowerCase().includes('</body>')) {
            finalHtml = campaign.body.replace(/<\/body>/i, `${pixelHtml}</body>`);
          } else {
            finalHtml = campaign.body + pixelHtml;
          }
        } else {
          const formattedBody = campaign.body.replace(/\n/g, '<br />');
          finalHtml = `<html><body>${formattedBody}${pixelHtml}</body></html>`;
        }

        await transporter.sendMail({
          from: `"${smtp.from_email}" <${smtp.from_email}>`,
          to: client.email,
          subject: campaign.subject,
          text: campaign.body, // original plain text fallback
          html: finalHtml,     // HTML version with tracking pixel
        });

        // Update client status in DB to 'sent'
        await db.query("UPDATE Clients SET status = 'sent' WHERE id = ?", [client.id]);

        // Increment campaign sent count
        await db.query("UPDATE Campaigns SET sent_count = sent_count + 1 WHERE id = ?", [campaign.id]);
      } catch (err: any) {
        console.error(`Failed to send email to ${client.email}:`, err.message);
        
        // Update client status in DB to 'failed'
        await db.query("UPDATE Clients SET status = 'failed' WHERE id = ?", [client.id]);

        // Increment campaign failed count
        await db.query("UPDATE Campaigns SET failed_count = failed_count + 1 WHERE id = ?", [campaign.id]);
      }

      // Throttling delay (e.g. 300ms)
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Close transporter connection pool
    transporter.close();

    // 5. Update campaign status to completed
    await db.query(
      "UPDATE Campaigns SET status = 'completed', completed_at = NOW() WHERE id = ?",
      [campaign.id]
    );
    console.log(`Campaign ${campaign.id} completed successfully!`);

  } catch (err: any) {
    console.error(`Fatal error in processing Campaign ${campaign.id}:`, err.message);
    await db.query(
      "UPDATE Campaigns SET status = 'failed', completed_at = NOW() WHERE id = ?",
      [campaign.id]
    );
  }
}

// Continuous loop wrapper
async function startWorker() {
  console.log('Queuvo Background Mail Worker daemon started.');
  while (true) {
    await checkAndProcessQueue();
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

startWorker().catch(err => {
  console.error('Fatal crash in Queuvo Background Worker:', err);
  process.exit(1);
});
