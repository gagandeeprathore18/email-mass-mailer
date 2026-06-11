import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import db from '@/lib/db';
import { RowDataPacket } from 'mysql2/promise';

interface ChartRow extends RowDataPacket {
  date_str: string;
  day_name: string;
  sent_count: number;
}

interface SmtpStatusRow extends RowDataPacket {
  label: string;
  host: string;
  is_active: number;
  is_verified: number;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch last 7 days of delivery performance (sent count)
    // We construct a query to group by day for the last 7 days (including today)
    const [performanceRows] = await db.query<ChartRow[]>(
      `SELECT 
        DATE_FORMAT(cl.created_at, '%Y-%m-%d') as date_str,
        DAYNAME(cl.created_at) as day_name,
        COUNT(cl.id) as sent_count
       FROM Clients cl
       JOIN Campaigns c ON cl.campaign_id = c.id
       WHERE c.user_id = ? AND cl.status = 'sent' AND cl.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE_FORMAT(cl.created_at, '%Y-%m-%d'), DAYNAME(cl.created_at)
       ORDER BY DATE_FORMAT(cl.created_at, '%Y-%m-%d') ASC`,
      [user.id]
    );

    // Fill in missing days so we always have 7 bars (ending today)
    const daysData: { day: string; count: number; dateStr: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      
      const foundRow = performanceRows.find(r => r.date_str === dateStr);
      daysData.push({
        day: dayName,
        count: foundRow ? foundRow.sent_count : 0,
        dateStr
      });
    }

    // 2. Fetch overall metrics (Bounce rate & Peak time)
    const [overallCounts] = await db.query<RowDataPacket[]>(
      `SELECT 
        SUM(CASE WHEN cl.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN cl.status = 'sent' THEN 1 ELSE 0 END) as sent_count
       FROM Clients cl
       JOIN Campaigns c ON cl.campaign_id = c.id
       WHERE c.user_id = ?`,
      [user.id]
    );

    const totalSent = Number(overallCounts[0]?.sent_count || 0);
    const totalFailed = Number(overallCounts[0]?.failed_count || 0);
    const totalDelivered = totalSent + totalFailed;
    const bounceRate = totalDelivered > 0 ? ((totalFailed / totalDelivered) * 100).toFixed(2) : '0.00';

    // Fetch peak time
    const [peakTimeRow] = await db.query<RowDataPacket[]>(
      `SELECT HOUR(cl.created_at) as hr, COUNT(cl.id) as count
       FROM Clients cl
       JOIN Campaigns c ON cl.campaign_id = c.id
       WHERE c.user_id = ? AND cl.status = 'sent'
       GROUP BY HOUR(cl.created_at)
       ORDER BY count DESC
       LIMIT 1`,
      [user.id]
    );

    let peakTime = 'No data';
    if (peakTimeRow.length > 0) {
      const hr = peakTimeRow[0].hr;
      const startHr = hr.toString().padStart(2, '0');
      const endHr = ((hr + 2) % 24).toString().padStart(2, '0');
      peakTime = `${startHr}:00 – ${endHr}:00`;
    }

    // 3. Fetch SMTP Tunnel Statuses
    const [smtpRows] = await db.query<SmtpStatusRow[]>(
      `SELECT label, host, is_active, is_verified 
       FROM smtp_accounts 
       WHERE user_id = ?
       ORDER BY created_at ASC`,
      [user.id]
    );

    const smtpTunnels = smtpRows.map(row => {
      let status = 'Offline';
      if (row.is_active && row.is_verified) {
        status = 'Healthy';
      } else if (row.is_verified) {
        status = 'Idle';
      }
      return {
        label: row.label,
        host: row.host,
        status
      };
    });

    const healthyTunnels = smtpTunnels.filter(t => t.status === 'Healthy').length;
    const tunnelHealth = smtpTunnels.length > 0 ? Math.round((healthyTunnels / smtpTunnels.length) * 100) : 0;

    const todayCount = daysData[6]?.count || 0;
    const yesterdayCount = daysData[5]?.count || 0;
    let trendVal = 0;
    if (yesterdayCount > 0) {
      trendVal = Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);
    } else if (todayCount > 0) {
      trendVal = 100;
    }
    const sentTrend = trendVal >= 0 ? `+${trendVal}%` : `${trendVal}%`;

    const deliveryRate = totalDelivered > 0 ? ((totalSent / totalDelivered) * 100).toFixed(1) : '100.0';

    return NextResponse.json({
      success: true,
      deliveryPerformance: {
        chart: daysData,
        bounceRate: `${bounceRate}%`,
        peakTime,
        topRegion: smtpTunnels.length > 0 ? smtpTunnels[0].label : 'None'
      },
      smtpTunnels,
      summary: {
        totalSentCount: totalSent,
        deliveryRate: `${deliveryRate}%`,
        tunnelHealth: `${tunnelHealth}%`,
        sentTrend
      }
    });
  } catch (error) {
    console.error('Fetch dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
