import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isAuthenticated } from '../middleware/auth.js';
import { runSeoIntelligencePipeline, retryDigest } from '../jobs/seoIntelligence.js';
import { applyDraftSopEdit, createSopDocument, listSopDocuments } from '../services/seo/googleDocs.js';
import { fetchRssSource, fetchYouTubeChannel, fetchRedditSubreddit, fetchWebPage } from '../services/seo/sourceFetcher.js';
import { seedSeoSources } from '../services/seo/seedSeoSources.js';
import { buildAnalysisPrompt, callClaudeApi, parseRecommendations } from '../services/seo/aiAnalyzer.js';

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// All SEO routes require authentication and admin access
router.use(isAuthenticated);
router.use(requireAdmin);

// ============ Digests ============

router.get('/digests', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [digests, total] = await Promise.all([
      prisma.seoDigest.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.seoDigest.count(),
    ]);

    res.json({ digests, total });
  } catch (error) {
    console.error('[SEO Routes] Failed to list digests:', error);
    res.status(500).json({ error: 'Failed to list digests' });
  }
});

router.get('/digests/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const digest = await prisma.seoDigest.findUnique({
      where: { id },
      include: {
        recommendations: {
          include: { citations: true, taskDrafts: true },
        },
      },
    });

    if (!digest) {
      return res.status(404).json({ error: 'Digest not found' });
    }

    res.json(digest);
  } catch (error) {
    console.error('[SEO Routes] Failed to get digest:', error);
    res.status(500).json({ error: 'Failed to get digest' });
  }
});

router.post('/digests/run', async (_req: Request, res: Response) => {
  try {
    // Run pipeline asynchronously with force flag (bypasses day check + enabled check)
    runSeoIntelligencePipeline({ force: true }).catch((error) => {
      console.error('[SEO Routes] Manual pipeline run failed:', error);
    });

    res.json({ message: 'Pipeline triggered', status: 'running' });
  } catch (error) {
    console.error('[SEO Routes] Failed to trigger pipeline:', error);
    res.status(500).json({ error: 'Failed to trigger pipeline' });
  }
});

router.post('/digests/:id/retry', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const digest = await prisma.seoDigest.findUnique({ where: { id } });

    if (!digest) {
      return res.status(404).json({ error: 'Digest not found' });
    }

    if (digest.status !== 'failed') {
      return res.status(400).json({ error: 'Only failed digests can be retried' });
    }

    retryDigest(id).catch((error) => {
      console.error('[SEO Routes] Retry pipeline run failed:', error);
    });

    res.json({ message: 'Retry initiated' });
  } catch (error) {
    console.error('[SEO Routes] Failed to retry digest:', error);
    res.status(500).json({ error: 'Failed to retry digest' });
  }
});

// ============ Task Drafts ============

router.get('/digests/:id/task-drafts', async (req: Request, res: Response) => {
  try {
    const digestId = req.params.id as string;
    const drafts = await prisma.seoTaskDraft.findMany({
      where: { digestId },
      include: { recommendation: true },
      orderBy: { createdAt: 'asc' },
    });

    res.json(drafts);
  } catch (error) {
    console.error('[SEO Routes] Failed to get task drafts:', error);
    res.status(500).json({ error: 'Failed to get task drafts' });
  }
});

router.post('/task-drafts/:id/approve', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { projectId, assigneeIds, dueDate } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const draft = await prisma.seoTaskDraft.findUnique({ where: { id } });
    if (!draft) {
      return res.status(404).json({ error: 'Task draft not found' });
    }

    if (draft.status !== 'pending') {
      return res.status(400).json({ error: 'Draft already processed' });
    }

    const dueDateValue = dueDate
      ? new Date(dueDate)
      : new Date(Date.now() + draft.suggestedDueInDays * 24 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          projectId,
          title: draft.title,
          description: draft.description,
          priority: draft.suggestedPriority as any,
          dueDate: dueDateValue,
        },
      });

      if (assigneeIds && assigneeIds.length > 0) {
        for (const userId of assigneeIds) {
          await tx.taskAssignee.create({
            data: { taskId: task.id, userId },
          });
        }
      }

      const updatedDraft = await tx.seoTaskDraft.update({
        where: { id },
        data: { status: 'approved', taskId: task.id, reviewedAt: new Date() },
      });

      return { task, draft: updatedDraft };
    });

    res.json(result);
  } catch (error) {
    console.error('[SEO Routes] Failed to approve task draft:', error);
    res.status(500).json({ error: 'Failed to approve task draft' });
  }
});

router.post('/task-drafts/:id/reject', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const draft = await prisma.seoTaskDraft.findUnique({ where: { id } });

    if (!draft) {
      return res.status(404).json({ error: 'Task draft not found' });
    }

    const updated = await prisma.seoTaskDraft.update({
      where: { id },
      data: { status: 'rejected', reviewedAt: new Date() },
    });

    res.json(updated);
  } catch (error) {
    console.error('[SEO Routes] Failed to reject task draft:', error);
    res.status(500).json({ error: 'Failed to reject task draft' });
  }
});

router.post('/task-drafts/bulk-approve', async (req: Request, res: Response) => {
  try {
    const { ids, projectId } = req.body;

    if (!ids || !Array.isArray(ids) || !projectId) {
      return res.status(400).json({ error: 'ids array and projectId are required' });
    }

    const approved: any[] = [];

    for (const draftId of ids) {
      const draft = await prisma.seoTaskDraft.findUnique({ where: { id: draftId } });
      if (!draft || draft.status !== 'pending') continue;

      const dueDate = new Date(Date.now() + draft.suggestedDueInDays * 24 * 60 * 60 * 1000);

      const task = await prisma.$transaction(async (tx) => {
        const t = await tx.task.create({
          data: {
            projectId,
            title: draft.title,
            description: draft.description,
            priority: draft.suggestedPriority as any,
            dueDate,
          },
        });

        await tx.seoTaskDraft.update({
          where: { id: draftId },
          data: { status: 'approved', taskId: t.id, reviewedAt: new Date() },
        });

        return t;
      });

      approved.push(task);
    }

    res.json({ approved });
  } catch (error) {
    console.error('[SEO Routes] Failed to bulk approve:', error);
    res.status(500).json({ error: 'Failed to bulk approve task drafts' });
  }
});

// ============ SOP Drafts ============

router.get('/digests/:id/sop-drafts', async (req: Request, res: Response) => {
  try {
    const digestId = req.params.id as string;
    const drafts = await prisma.seoSopDraft.findMany({
      where: { digestId },
      include: {
        recommendation: true,
        templateSet: {
          include: {
            templates: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, title: true, sortOrder: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(drafts);
  } catch (error) {
    console.error('[SEO Routes] Failed to get SOP drafts:', error);
    res.status(500).json({ error: 'Failed to get SOP drafts' });
  }
});

router.post('/sop-drafts/:id/apply', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const draft = await prisma.seoSopDraft.findUnique({ where: { id } });

    if (!draft) {
      return res.status(404).json({ error: 'SOP draft not found' });
    }

    if (draft.status !== 'pending') {
      return res.status(400).json({ error: 'SOP draft already processed' });
    }

    if (draft.draftType === 'new') {
      const settings = await prisma.seoSettings.findFirst();
      if (!settings?.sopFolderId) {
        return res.status(400).json({ error: 'SOP folder not configured in settings' });
      }

      const docUrl = await createSopDocument(draft.sopTitle, draft.afterContent, settings.sopFolderId);

      if (draft.templateSetId) {
        await prisma.templateSet.update({
          where: { id: draft.templateSetId },
          data: { strategyDocUrl: docUrl },
        });
      }

      const updated = await prisma.seoSopDraft.update({
        where: { id },
        data: { status: 'applied', appliedAt: new Date(), sopDocId: docUrl },
      });

      res.json(updated);
    } else {
      await applyDraftSopEdit(draft.sopDocId, draft.afterContent, draft.description);

      const updated = await prisma.seoSopDraft.update({
        where: { id },
        data: { status: 'applied', appliedAt: new Date() },
      });

      res.json(updated);
    }
  } catch (error) {
    console.error('[SEO Routes] Failed to apply SOP draft:', error);
    res.status(500).json({ error: 'Failed to apply SOP draft' });
  }
});

router.post('/sop-drafts/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const updated = await prisma.seoSopDraft.update({
      where: { id },
      data: { status: 'dismissed' },
    });

    res.json(updated);
  } catch (error) {
    console.error('[SEO Routes] Failed to dismiss SOP draft:', error);
    res.status(500).json({ error: 'Failed to dismiss SOP draft' });
  }
});

router.post('/sop-drafts/:id/edit', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { afterContent } = req.body;

    if (!afterContent || typeof afterContent !== 'string') {
      return res.status(400).json({ error: 'afterContent is required' });
    }

    const draft = await prisma.seoSopDraft.findUnique({ where: { id } });
    if (!draft) {
      return res.status(404).json({ error: 'SOP draft not found' });
    }

    if (draft.status !== 'pending') {
      return res.status(400).json({ error: 'Can only edit pending drafts' });
    }

    const updated = await prisma.seoSopDraft.update({
      where: { id },
      data: { afterContent },
    });

    res.json(updated);
  } catch (error) {
    console.error('[SEO Routes] Failed to edit SOP draft:', error);
    res.status(500).json({ error: 'Failed to edit SOP draft' });
  }
});

// ============ Settings ============

router.get('/settings', async (_req: Request, res: Response) => {
  try {
    let settings = await prisma.seoSettings.findFirst();
    if (!settings) {
      settings = await prisma.seoSettings.create({
        data: { enabled: false, runDayOfMonth: 1, tokenBudget: 100000 },
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('[SEO Routes] Failed to get settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

router.patch('/settings', async (req: Request, res: Response) => {
  try {
    const { enabled, runDayOfMonth, telegramChatId, driveFolderId, sopFolderId, tokenBudget } = req.body;
    let settings = await prisma.seoSettings.findFirst();

    if (!settings) {
      settings = await prisma.seoSettings.create({
        data: { enabled: false, runDayOfMonth: 1, tokenBudget: 100000 },
      });
    }

    const updated = await prisma.seoSettings.update({
      where: { id: settings.id },
      data: {
        ...(enabled !== undefined && { enabled }),
        ...(runDayOfMonth !== undefined && { runDayOfMonth }),
        ...(telegramChatId !== undefined && { telegramChatId }),
        ...(driveFolderId !== undefined && { driveFolderId }),
        ...(sopFolderId !== undefined && { sopFolderId }),
        ...(tokenBudget !== undefined && { tokenBudget }),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[SEO Routes] Failed to update settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ============ Sources ============

router.get('/sources', async (_req: Request, res: Response) => {
  try {
    const sources = await prisma.seoSource.findMany({
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    });
    res.json(sources);
  } catch (error) {
    console.error('[SEO Routes] Failed to list sources:', error);
    res.status(500).json({ error: 'Failed to list sources' });
  }
});

router.post('/sources', async (req: Request, res: Response) => {
  try {
    const { name, url, tier, category, fetchMethod, fetchConfig } = req.body;
    const source = await prisma.seoSource.create({
      data: {
        name,
        url,
        tier: tier || 'tier_3',
        category: category || 'general',
        fetchMethod: fetchMethod || 'rss',
        fetchConfig: fetchConfig || {},
      },
    });
    res.json(source);
  } catch (error) {
    console.error('[SEO Routes] Failed to create source:', error);
    res.status(500).json({ error: 'Failed to create source' });
  }
});

router.patch('/sources/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, url, tier, category, fetchMethod, fetchConfig, active } = req.body;

    const source = await prisma.seoSource.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(url !== undefined && { url }),
        ...(tier !== undefined && { tier }),
        ...(category !== undefined && { category }),
        ...(fetchMethod !== undefined && { fetchMethod }),
        ...(fetchConfig !== undefined && { fetchConfig }),
        ...(active !== undefined && { active }),
      },
    });

    res.json(source);
  } catch (error) {
    console.error('[SEO Routes] Failed to update source:', error);
    res.status(500).json({ error: 'Failed to update source' });
  }
});

router.delete('/sources/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.seoSource.delete({ where: { id } });
    res.json({ message: 'Source deleted' });
  } catch (error) {
    console.error('[SEO Routes] Failed to delete source:', error);
    res.status(500).json({ error: 'Failed to delete source' });
  }
});

// Test a single source fetch without running the full pipeline
router.post('/sources/:id/test', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const source = await prisma.seoSource.findUnique({ where: { id } });

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    let results: { url: string; title: string; content: string; publishedAt?: Date }[] = [];

    switch (source.fetchMethod) {
      case 'rss':
        results = await fetchRssSource(source);
        break;
      case 'youtube':
        results = await fetchYouTubeChannel(source);
        break;
      case 'reddit':
        results = await fetchRedditSubreddit(source);
        break;
      case 'webpage':
        results = await fetchWebPage(source);
        break;
      default:
        return res.status(400).json({ error: `Unknown fetch method: ${source.fetchMethod}` });
    }

    res.json({
      source: source.name,
      method: source.fetchMethod,
      articlesFound: results.length,
      articles: results.slice(0, 5).map((r) => ({
        title: r.title,
        url: r.url,
        contentPreview: r.content.substring(0, 200),
        publishedAt: r.publishedAt,
      })),
    });
  } catch (error) {
    console.error('[SEO Routes] Source test failed:', error);
    res.status(500).json({ error: 'Source test failed', details: error instanceof Error ? error.message : String(error) });
  }
});

// Seed sources (re-run safe)
router.post('/sources/seed', async (_req: Request, res: Response) => {
  try {
    await seedSeoSources();
    const count = await prisma.seoSource.count();
    res.json({ message: 'Sources seeded', totalSources: count });
  } catch (error) {
    console.error('[SEO Routes] Seed failed:', error);
    res.status(500).json({ error: 'Seed failed' });
  }
});

// List SOP documents from Google Drive
router.get('/sop-documents', async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.seoSettings.findFirst();
    if (!settings?.sopFolderId) {
      return res.json({ documents: [], message: 'SOP folder not configured' });
    }

    const documents = await listSopDocuments(settings.sopFolderId);
    res.json({ documents });
  } catch (error) {
    console.error('[SEO Routes] Failed to list SOP documents:', error);
    res.status(500).json({ error: 'Failed to list SOP documents' });
  }
});

// Pipeline job history
router.get('/job-history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const jobs = await prisma.scheduledJobRun.findMany({
      where: { jobName: 'seo_intelligence_pipeline' },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
    res.json(jobs);
  } catch (error) {
    console.error('[SEO Routes] Failed to get job history:', error);
    res.status(500).json({ error: 'Failed to get job history' });
  }
});

// Diagnostic endpoint — shows latest digest details for debugging
router.get('/debug/latest', async (_req: Request, res: Response) => {
  try {
    const digests = await prisma.seoDigest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: {
        recommendations: { take: 2 },
        taskDrafts: { take: 2 },
        sopDrafts: { take: 2 },
        _count: {
          select: { recommendations: true, taskDrafts: true, sopDrafts: true },
        },
      },
    });

    const fetchResultCounts = await Promise.all(
      digests.map(d => prisma.seoFetchResult.count({ where: { digestId: d.id } }))
    );

    const jobs = await prisma.scheduledJobRun.findMany({
      where: { jobName: { startsWith: 'seo' } },
      orderBy: { startedAt: 'desc' },
      take: 5,
    });

    res.json({
      digests: digests.map((d, i) => ({
        id: d.id,
        period: d.period,
        status: d.status,
        errorMessage: d.errorMessage,
        sourcesFetched: d.sourcesFetched,
        fetchResultsInDb: fetchResultCounts[i],
        recommendationsGenerated: d.recommendationsGenerated,
        taskDraftsCreated: d.taskDraftsCreated,
        sopDraftsCreated: d.sopDraftsCreated,
        actualCounts: d._count,
        sampleRecommendations: d.recommendations,
        createdAt: d.createdAt,
        completedAt: d.completedAt,
      })),
      recentJobs: jobs,
    });
  } catch (error) {
    console.error('[SEO Routes] Debug failed:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Debug: test AI analysis on a small sample of articles
router.get('/debug/test-analysis', async (_req: Request, res: Response) => {
  try {
    // Grab the latest digest's fetch results (just 5 to keep it cheap)
    const latestDigest = await prisma.seoDigest.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!latestDigest) {
      return res.json({ error: 'No digests found' });
    }

    const fetchResults = await prisma.seoFetchResult.findMany({
      where: { digestId: latestDigest.id },
      include: { source: true },
      take: 5,
    });

    if (fetchResults.length === 0) {
      return res.json({ error: 'No fetch results found', digestId: latestDigest.id });
    }

    const articles = fetchResults.map((fr) => ({
      id: fr.id,
      url: fr.url,
      title: fr.title,
      content: fr.content.substring(0, 2000),
      sourceName: fr.source.name,
      sourceTier: fr.source.tier,
      category: fr.source.category,
    }));

    const settings = await prisma.seoSettings.findFirst();
    const prompt = buildAnalysisPrompt(articles, settings);

    const rawResponse = await callClaudeApi(prompt.userPrompt, prompt.systemPrompt);
    const parsed = parseRecommendations(rawResponse, articles);

    res.json({
      digestId: latestDigest.id,
      articlesUsed: articles.length,
      promptLength: prompt.userPrompt.length,
      rawResponseLength: rawResponse.length,
      rawResponsePreview: rawResponse.substring(0, 2000),
      parsedRecommendations: parsed.length,
      parsed: parsed.slice(0, 2),
    });
  } catch (error) {
    console.error('[SEO Debug] Test analysis failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

export default router;
