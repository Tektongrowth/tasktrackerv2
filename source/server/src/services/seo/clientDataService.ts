import { prisma } from '../../db/client.js';

export async function fetchGbpInsights(
  clientId: string,
  locationId: string,
  period: string
): Promise<Record<string, unknown>> {
  // GBP Performance API integration
  // Requires Google Business Profile API access via service account
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    console.warn('[ClientData] GOOGLE_SERVICE_ACCOUNT_KEY not set, skipping GBP insights');
    return {};
  }

  try {
    const { google } = await import('googleapis');
    const key = JSON.parse(Buffer.from(keyJson, 'base64').toString('utf-8'));
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/business.manage'],
    });

    const mybusiness = google.mybusinessbusinessinformation({ version: 'v1', auth });

    // Fetch basic location data as a health check
    const location = await mybusiness.locations.get({
      name: `locations/${locationId}`,
      readMask: 'name,title',
    });

    return {
      locationName: location.data.title || locationId,
      dataSource: 'gbp',
      period,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[ClientData] GBP fetch failed for client ${clientId}:`, error);
    return { error: 'GBP fetch failed', dataSource: 'gbp' };
  }
}

export async function fetchGoogleAdsMetrics(
  clientId: string,
  customerId: string,
  period: string
): Promise<Record<string, unknown>> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const managerCustomerId = process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!developerToken || !managerCustomerId || !refreshToken) {
    console.warn('[ClientData] Google Ads credentials not configured, skipping');
    return {};
  }

  try {
    // Google Ads API via REST
    const { google } = await import('googleapis');
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyJson) return {};

    const key = JSON.parse(Buffer.from(keyJson, 'base64').toString('utf-8'));
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/adwords'],
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const query = `
      SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros,
        segments.date
      FROM customer
      WHERE segments.date DURING LAST_30_DAYS
    `;

    const response = await fetch(
      `https://googleads.googleapis.com/v15/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'developer-token': developerToken,
          'login-customer-id': managerCustomerId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );

    const data = await response.json();

    if (data.results) {
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalConversions = 0;
      let totalCostMicros = 0;

      for (const row of data.results) {
        totalImpressions += parseInt(row.metrics?.impressions || '0');
        totalClicks += parseInt(row.metrics?.clicks || '0');
        totalConversions += parseFloat(row.metrics?.conversions || '0');
        totalCostMicros += parseInt(row.metrics?.costMicros || '0');
      }

      return {
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
        cost: totalCostMicros / 1_000_000,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : '0',
        cpc: totalClicks > 0 ? (totalCostMicros / 1_000_000 / totalClicks).toFixed(2) : '0',
        dataSource: 'google_ads',
        period,
      };
    }

    return { dataSource: 'google_ads', period, noData: true };
  } catch (error) {
    console.error(`[ClientData] Google Ads fetch failed for client ${clientId}:`, error);
    return { error: 'Google Ads fetch failed', dataSource: 'google_ads' };
  }
}

export async function fetchAllClientData(digestId: string): Promise<number> {
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { gbpLocationId: { not: null } },
        { googleAdsCustomerId: { not: null } },
      ],
    },
  });

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let insightsCreated = 0;

  for (const client of clients) {
    if (client.gbpLocationId) {
      const metrics = await fetchGbpInsights(client.id, client.gbpLocationId, period);
      if (Object.keys(metrics).length > 0) {
        await prisma.seoClientInsight.create({
          data: {
            digestId,
            clientId: client.id,
            dataSource: 'gbp',
            metrics: metrics as any,
            period,
          },
        });
        insightsCreated++;
      }
    }

    if (client.googleAdsCustomerId) {
      const metrics = await fetchGoogleAdsMetrics(client.id, client.googleAdsCustomerId, period);
      if (Object.keys(metrics).length > 0) {
        await prisma.seoClientInsight.create({
          data: {
            digestId,
            clientId: client.id,
            dataSource: 'google_ads',
            metrics: metrics as any,
            period,
          },
        });
        insightsCreated++;
      }
    }
  }

  return insightsCreated;
}

export async function buildClientContext(digestId: string): Promise<string> {
  const insights = await prisma.seoClientInsight.findMany({
    where: { digestId },
    include: { client: true },
  });

  if (insights.length === 0) return '';

  let context = 'CLIENT DATA CONTEXT:\n';
  for (const insight of insights) {
    context += `\nClient: ${insight.client.name} (${insight.dataSource})\n`;
    context += `Metrics: ${JSON.stringify(insight.metrics)}\n`;
  }

  return context;
}
