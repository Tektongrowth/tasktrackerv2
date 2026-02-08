import { prisma } from '../db/client.js';
import { fetchAllSources } from '../services/seo/sourceFetcher.js';
import { analyzeContent } from '../services/seo/aiAnalyzer.js';
import { fetchAllClientData } from '../services/seo/clientDataService.js';
import { deliverDigest } from '../services/seo/digestDelivery.js';
import { sendTelegramMessage } from '../services/telegram.js';

export async function runSeoIntelligencePipeline(options?: { force?: boolean }): Promise<void> {
  const settings = await prisma.seoSettings.findFirst();
  const force = options?.force ?? false;

  if (!force && !settings?.enabled) {
    console.log('[SEO Pipeline] Module disabled, skipping');
    return;
  }

  const now = new Date();
  const today = now.getDate();

  if (!force && settings && today !== settings.runDayOfMonth) {
    console.log(`[SEO Pipeline] Not run day (today: ${today}, configured: ${settings.runDayOfMonth}), skipping`);
    return;
  }

  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (!force) {
    const existingDigest = await prisma.seoDigest.findFirst({
      where: { period, status: { in: ['completed', 'delivering', 'analyzing', 'generating', 'fetching'] } },
    });

    if (existingDigest) {
      console.log(`[SEO Pipeline] Digest already exists for ${period}, skipping`);
      return;
    }
  }

  const jobRun = await prisma.scheduledJobRun.create({
    data: { jobName: 'seo_intelligence_pipeline', status: 'started' },
  });

  const digest = await prisma.seoDigest.create({
    data: { period, status: 'fetching' },
  });

  try {
    // Step 1: Fetch sources
    console.log('[SEO Pipeline] Step 1: Fetching sources...');
    const sourcesFetched = await fetchAllSources(digest.id);
    await prisma.seoDigest.update({
      where: { id: digest.id },
      data: { sourcesFetched, status: 'analyzing' },
    });
    console.log(`[SEO Pipeline] Fetched ${sourcesFetched} articles`);

    // Step 2: Fetch client data
    console.log('[SEO Pipeline] Step 2: Fetching client data...');
    await fetchAllClientData(digest.id);

    // Step 3: AI analysis
    console.log('[SEO Pipeline] Step 3: Analyzing content...');
    await prisma.seoDigest.update({
      where: { id: digest.id },
      data: { status: 'generating' },
    });

    const { recommendations, taskDrafts, sopDrafts } = await analyzeContent(digest.id);

    // Step 4: Store results
    console.log('[SEO Pipeline] Step 4: Storing results...');
    for (const rec of recommendations) {
      const created = await prisma.seoRecommendation.create({
        data: {
          digestId: digest.id,
          category: rec.category,
          title: rec.title,
          summary: rec.summary,
          details: rec.details,
          impact: rec.impact,
          confidence: rec.confidence,
          sourceCount: rec.citations.length,
        },
      });

      for (const citation of rec.citations) {
        await prisma.seoRecommendationCitation.create({
          data: {
            recommendationId: created.id,
            fetchResultId: citation.fetchResultId,
            sourceUrl: citation.sourceUrl,
            sourceName: citation.sourceName,
            excerpt: citation.excerpt,
          },
        });
      }
    }

    for (const draft of taskDrafts) {
      await prisma.seoTaskDraft.create({
        data: {
          digestId: digest.id,
          title: draft.title,
          description: draft.description,
          suggestedPriority: draft.suggestedPriority,
          suggestedDueInDays: draft.suggestedDueInDays,
        },
      });
    }

    for (const sop of sopDrafts) {
      await prisma.seoSopDraft.create({
        data: {
          digestId: digest.id,
          sopDocId: sop.sopDocId,
          sopTitle: sop.sopTitle,
          description: sop.description,
          beforeContent: sop.beforeContent,
          afterContent: sop.afterContent,
        },
      });
    }

    await prisma.seoDigest.update({
      where: { id: digest.id },
      data: {
        status: 'delivering',
        recommendationsGenerated: recommendations.length,
        taskDraftsCreated: taskDrafts.length,
        sopDraftsCreated: sopDrafts.length,
      },
    });

    // Step 5: Deliver
    console.log('[SEO Pipeline] Step 5: Delivering digest...');
    await deliverDigest(digest.id);

    await prisma.seoDigest.update({
      where: { id: digest.id },
      data: { status: 'completed', completedAt: new Date() },
    });

    await prisma.scheduledJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        details: {
          digestId: digest.id,
          sourcesFetched,
          recommendations: recommendations.length,
          taskDrafts: taskDrafts.length,
          sopDrafts: sopDrafts.length,
        },
      },
    });

    console.log(`[SEO Pipeline] Completed successfully for ${period}`);
  } catch (error) {
    console.error('[SEO Pipeline] Failed:', error);

    await prisma.seoDigest.update({
      where: { id: digest.id },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });

    await prisma.scheduledJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        details: { error: error instanceof Error ? error.message : String(error) },
      },
    });

    // Send failure alert via Telegram
    try {
      const settings = await prisma.seoSettings.findFirst();
      if (settings?.telegramChatId) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await sendTelegramMessage(
          settings.telegramChatId,
          `<b>SEO Pipeline Failed</b>\n\nPeriod: ${period}\nError: ${errorMsg}\n\nCheck the SEO Intelligence page to retry.`,
          { parseMode: 'HTML' }
        );
      }
    } catch (alertError) {
      console.error('[SEO Pipeline] Failed to send failure alert:', alertError);
    }
  }
}

export async function retryDigest(digestId: string): Promise<void> {
  const digest = await prisma.seoDigest.findUnique({
    where: { id: digestId },
    include: {
      recommendations: true,
      taskDrafts: true,
      sopDrafts: true,
    },
  });

  if (!digest) {
    throw new Error(`Digest ${digestId} not found`);
  }

  if (digest.status !== 'failed') {
    throw new Error(`Digest ${digestId} is not in failed state (status: ${digest.status})`);
  }

  // Infer which step failed from the data state
  const hasRecommendations = digest.recommendations.length > 0;
  const hasFetchResults = digest.sourcesFetched > 0;

  let resumeFrom: 'fetch' | 'analyze' | 'deliver';
  if (hasRecommendations) {
    resumeFrom = 'deliver';
  } else if (hasFetchResults) {
    resumeFrom = 'analyze';
  } else {
    resumeFrom = 'fetch';
  }

  console.log(`[SEO Pipeline] Retrying digest ${digestId} from step: ${resumeFrom}`);

  const jobRun = await prisma.scheduledJobRun.create({
    data: { jobName: 'seo_intelligence_pipeline', status: 'started' },
  });

  try {
    if (resumeFrom === 'fetch') {
      // Step 1: Fetch sources
      console.log('[SEO Pipeline Retry] Step 1: Fetching sources...');
      await prisma.seoDigest.update({
        where: { id: digestId },
        data: { status: 'fetching', errorMessage: null },
      });
      const sourcesFetched = await fetchAllSources(digestId);
      await prisma.seoDigest.update({
        where: { id: digestId },
        data: { sourcesFetched, status: 'analyzing' },
      });
      console.log(`[SEO Pipeline Retry] Fetched ${sourcesFetched} articles`);

      // Step 2: Fetch client data
      console.log('[SEO Pipeline Retry] Step 2: Fetching client data...');
      await fetchAllClientData(digestId);
    }

    if (resumeFrom === 'fetch' || resumeFrom === 'analyze') {
      // Step 3: AI analysis
      console.log('[SEO Pipeline Retry] Step 3: Analyzing content...');
      await prisma.seoDigest.update({
        where: { id: digestId },
        data: { status: 'generating', errorMessage: null },
      });

      const { recommendations, taskDrafts, sopDrafts } = await analyzeContent(digestId);

      // Step 4: Store results
      console.log('[SEO Pipeline Retry] Step 4: Storing results...');
      for (const rec of recommendations) {
        const created = await prisma.seoRecommendation.create({
          data: {
            digestId,
            category: rec.category,
            title: rec.title,
            summary: rec.summary,
            details: rec.details,
            impact: rec.impact,
            confidence: rec.confidence,
            sourceCount: rec.citations.length,
          },
        });

        for (const citation of rec.citations) {
          await prisma.seoRecommendationCitation.create({
            data: {
              recommendationId: created.id,
              fetchResultId: citation.fetchResultId,
              sourceUrl: citation.sourceUrl,
              sourceName: citation.sourceName,
              excerpt: citation.excerpt,
            },
          });
        }
      }

      for (const draft of taskDrafts) {
        await prisma.seoTaskDraft.create({
          data: {
            digestId,
            title: draft.title,
            description: draft.description,
            suggestedPriority: draft.suggestedPriority,
            suggestedDueInDays: draft.suggestedDueInDays,
          },
        });
      }

      for (const sop of sopDrafts) {
        await prisma.seoSopDraft.create({
          data: {
            digestId,
            sopDocId: sop.sopDocId,
            sopTitle: sop.sopTitle,
            description: sop.description,
            beforeContent: sop.beforeContent,
            afterContent: sop.afterContent,
          },
        });
      }

      await prisma.seoDigest.update({
        where: { id: digestId },
        data: {
          status: 'delivering',
          recommendationsGenerated: recommendations.length,
          taskDraftsCreated: taskDrafts.length,
          sopDraftsCreated: sopDrafts.length,
        },
      });
    }

    // Step 5: Deliver
    console.log('[SEO Pipeline Retry] Step 5: Delivering digest...');
    if (resumeFrom === 'deliver') {
      await prisma.seoDigest.update({
        where: { id: digestId },
        data: { status: 'delivering', errorMessage: null },
      });
    }
    await deliverDigest(digestId);

    await prisma.seoDigest.update({
      where: { id: digestId },
      data: { status: 'completed', completedAt: new Date() },
    });

    await prisma.scheduledJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        details: { digestId, retryFrom: resumeFrom },
      },
    });

    console.log(`[SEO Pipeline Retry] Completed successfully for digest ${digestId}`);
  } catch (error) {
    console.error('[SEO Pipeline Retry] Failed:', error);

    await prisma.seoDigest.update({
      where: { id: digestId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });

    await prisma.scheduledJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        details: { error: error instanceof Error ? error.message : String(error), retryFrom: resumeFrom },
      },
    });

    try {
      const settings = await prisma.seoSettings.findFirst();
      if (settings?.telegramChatId) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await sendTelegramMessage(
          settings.telegramChatId,
          `<b>SEO Pipeline Retry Failed</b>\n\nDigest: ${digestId}\nResumed from: ${resumeFrom}\nError: ${errorMsg}\n\nCheck the SEO Intelligence page to retry.`,
          { parseMode: 'HTML' }
        );
      }
    } catch (alertError) {
      console.error('[SEO Pipeline Retry] Failed to send failure alert:', alertError);
    }
  }
}
