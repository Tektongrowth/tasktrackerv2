import { prisma } from '../db/client.js';

export async function runSeoContentCleanup(): Promise<void> {
  const settings = await prisma.seoSettings.findFirst();
  const retentionMonths = settings?.retentionMonths ?? 6;

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

  const jobRun = await prisma.scheduledJobRun.create({
    data: { jobName: 'seo_content_cleanup', status: 'started' },
  });

  try {
    // Delete old fetch results (citations cascade via onDelete)
    const deletedFetchResults = await prisma.seoFetchResult.deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    // Delete old completed/failed digests (12 months)
    const digestCutoff = new Date();
    digestCutoff.setMonth(digestCutoff.getMonth() - 12);

    const deletedDigests = await prisma.seoDigest.deleteMany({
      where: {
        createdAt: { lt: digestCutoff },
        status: { in: ['completed', 'failed'] },
      },
    });

    console.log(`[SEO Cleanup] Deleted ${deletedFetchResults.count} fetch results, ${deletedDigests.count} old digests`);

    await prisma.scheduledJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        details: {
          deletedFetchResults: deletedFetchResults.count,
          deletedDigests: deletedDigests.count,
          retentionMonths,
        },
      },
    });
  } catch (error) {
    console.error('[SEO Cleanup] Failed:', error);
    await prisma.scheduledJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        details: { error: error instanceof Error ? error.message : String(error) },
      },
    });
  }
}
