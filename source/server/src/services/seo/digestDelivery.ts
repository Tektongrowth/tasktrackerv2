import { prisma } from '../../db/client.js';
import { createDigestDocument } from './googleDocs.js';
import { sendTelegramMessage } from '../../services/telegram.js';

export async function deliverDigest(digestId: string): Promise<void> {
  const digest = await prisma.seoDigest.findUnique({
    where: { id: digestId },
    include: {
      recommendations: {
        include: { citations: true },
      },
    },
  });

  if (!digest) throw new Error(`Digest ${digestId} not found`);

  const settings = await prisma.seoSettings.findFirst();
  if (!settings) throw new Error('SEO settings not configured');

  let googleDocUrl: string | undefined;

  try {
    googleDocUrl = await createDigestDocument(
      {
        id: digest.id,
        period: digest.period,
        sourcesFetched: digest.sourcesFetched,
        recommendationsGenerated: digest.recommendationsGenerated,
        taskDraftsCreated: digest.taskDraftsCreated,
        sopDraftsCreated: digest.sopDraftsCreated,
      },
      digest.recommendations.map((r) => ({
        category: r.category,
        title: r.title,
        summary: r.summary,
        details: r.details,
        impact: r.impact,
        confidence: r.confidence,
        sourceCount: r.sourceCount,
        citations: r.citations.map((c) => ({
          sourceName: c.sourceName,
          sourceUrl: c.sourceUrl,
          excerpt: c.excerpt,
        })),
      })),
      settings.driveFolderId || undefined
    );

    await prisma.seoDigest.update({
      where: { id: digestId },
      data: { googleDocUrl },
    });
  } catch (error) {
    console.error('[DigestDelivery] Failed to create Google Doc:', error);
  }

  if (settings.telegramChatId) {
    try {
      const summary = buildTelegramSummary(digest, digest.recommendations, googleDocUrl);
      await sendTelegramMessage(settings.telegramChatId, summary, { parseMode: 'HTML' });
    } catch (error) {
      console.error('[DigestDelivery] Failed to send Telegram notification:', error);
    }
  }
}

export function buildTelegramSummary(
  digest: { period: string; sourcesFetched: number; recommendationsGenerated: number; taskDraftsCreated: number },
  recommendations: { category: string; title: string; impact: string; confidence: string }[],
  googleDocUrl?: string
): string {
  const highImpact = recommendations.filter((r) => r.impact === 'high');
  const verified = recommendations.filter((r) => r.confidence === 'verified');

  let msg = `<b>SEO Intelligence Report — ${digest.period}</b>\n\n`;
  msg += `Sources analyzed: ${digest.sourcesFetched}\n`;
  msg += `Recommendations: ${digest.recommendationsGenerated}\n`;
  msg += `High-impact: ${highImpact.length} | Verified: ${verified.length}\n`;
  msg += `Task drafts: ${digest.taskDraftsCreated}\n\n`;

  if (highImpact.length > 0) {
    msg += `<b>Top Recommendations:</b>\n`;
    for (const rec of highImpact.slice(0, 5)) {
      const badge = rec.confidence === 'verified' ? 'V' : 'E';
      msg += `[${badge}] ${rec.title}\n`;
    }
    msg += '\n';
  }

  if (googleDocUrl) {
    msg += `<a href="${googleDocUrl}">View Full Report</a>\n`;
  }

  msg += `\nReview task drafts in TaskTrackerPro to approve actions.`;

  return msg;
}
