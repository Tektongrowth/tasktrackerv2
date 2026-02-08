import { prisma } from '../../db/client.js';

interface SourceSeed {
  name: string;
  url: string;
  tier: 'tier_1' | 'tier_2' | 'tier_3';
  category: string;
  fetchMethod: string;
  fetchConfig?: Record<string, unknown>;
}

const sources: SourceSeed[] = [
  // Tier 1 — Google Official
  { name: 'Google Search Central Blog', url: 'https://developers.google.com/search/blog/feed/atom', tier: 'tier_1', category: 'General SEO', fetchMethod: 'rss' },
  { name: 'Google Ads Changelog', url: 'https://ads.google.com/home/resources/changelog/', tier: 'tier_1', category: 'Meta Ads', fetchMethod: 'webpage' },
  { name: 'Google Maps Platform Blog', url: 'https://cloud.google.com/blog/products/maps-platform/rss', tier: 'tier_1', category: 'Maps', fetchMethod: 'rss' },
  { name: 'GBP Help Center', url: 'https://support.google.com/business/answer/9292476', tier: 'tier_1', category: 'GBP', fetchMethod: 'webpage' },
  { name: 'Local Service Ads Help', url: 'https://support.google.com/localservices/', tier: 'tier_1', category: 'LSA', fetchMethod: 'webpage' },

  // Tier 2 — Industry Experts
  { name: 'Whitespark Blog', url: 'https://whitespark.ca/blog/feed/', tier: 'tier_2', category: 'GBP', fetchMethod: 'rss' },
  { name: 'BrightLocal Blog', url: 'https://www.brightlocal.com/blog/feed/', tier: 'tier_2', category: 'GBP', fetchMethod: 'rss' },
  { name: 'Sterling Sky Blog', url: 'https://sterlingsky.ca/feed/', tier: 'tier_2', category: 'GBP', fetchMethod: 'rss' },
  { name: 'Near Media', url: 'https://nearmedia.co/feed/', tier: 'tier_2', category: 'General SEO', fetchMethod: 'rss' },
  { name: 'Local Search Forum', url: 'https://www.localsearchforum.com/forums/-/index.rss', tier: 'tier_2', category: 'GBP', fetchMethod: 'rss' },
  { name: 'Moz Local SEO', url: 'https://moz.com/blog/feed', tier: 'tier_2', category: 'General SEO', fetchMethod: 'rss' },
  { name: 'Search Engine Journal', url: 'https://www.searchenginejournal.com/feed/', tier: 'tier_2', category: 'General SEO', fetchMethod: 'rss' },
  { name: 'Search Engine Land', url: 'https://searchengineland.com/feed', tier: 'tier_2', category: 'General SEO', fetchMethod: 'rss' },
  { name: 'Joy Hawkins YouTube', url: 'https://www.youtube.com/c/JoyHawkins', tier: 'tier_2', category: 'GBP', fetchMethod: 'youtube', fetchConfig: { channelId: 'UCZIMOb3JBU6VA6lsM5v7sYw' } },
  { name: 'Darren Shaw YouTube', url: 'https://www.youtube.com/@DarrenShaw', tier: 'tier_2', category: 'GBP', fetchMethod: 'youtube', fetchConfig: { channelId: 'UCaLMc8Z4WKe3r0btl2EUQSA' } },
  { name: 'LocalU', url: 'https://localu.org/feed/', tier: 'tier_2', category: 'GBP', fetchMethod: 'rss' },
  { name: 'Mike Blumenthal', url: 'https://blumenthals.com/blog/feed/', tier: 'tier_2', category: 'GBP', fetchMethod: 'rss' },

  // Tier 3 — Community / Supporting
  { name: 'Reddit r/SEO', url: 'https://www.reddit.com/r/SEO/', tier: 'tier_3', category: 'General SEO', fetchMethod: 'reddit', fetchConfig: { subreddit: 'SEO' } },
  { name: 'Reddit r/LocalSEO', url: 'https://www.reddit.com/r/LocalSEO/', tier: 'tier_3', category: 'GBP', fetchMethod: 'reddit', fetchConfig: { subreddit: 'LocalSEO' } },
  { name: 'Reddit r/GoogleAds', url: 'https://www.reddit.com/r/GoogleAds/', tier: 'tier_3', category: 'Meta Ads', fetchMethod: 'reddit', fetchConfig: { subreddit: 'GoogleAds' } },
  { name: 'Yelp Business Blog', url: 'https://business.yelp.com/blog/', tier: 'tier_3', category: 'Yelp', fetchMethod: 'webpage' },
  { name: 'Nextdoor Business Blog', url: 'https://business.nextdoor.com/blog', tier: 'tier_3', category: 'Nextdoor', fetchMethod: 'webpage' },
  { name: 'Angi Pro Blog', url: 'https://www.angi.com/pro/blog/', tier: 'tier_3', category: 'Angi', fetchMethod: 'webpage' },
  { name: 'Thumbtack Pro Blog', url: 'https://www.thumbtack.com/blog/', tier: 'tier_3', category: 'Thumbtack', fetchMethod: 'webpage' },
  { name: 'Search Engine Roundtable', url: 'https://www.seroundtable.com/feed', tier: 'tier_3', category: 'General SEO', fetchMethod: 'rss' },
];

export async function seedSeoSources(): Promise<void> {
  console.log('[Seed] Seeding SEO sources...');

  // Create default settings if not exists
  const existingSettings = await prisma.seoSettings.findFirst();
  if (!existingSettings) {
    await prisma.seoSettings.create({
      data: {
        enabled: false,
        runDayOfMonth: 1,
        tokenBudget: 100000,
      },
    });
    console.log('[Seed] Created default SeoSettings');
  }

  for (const source of sources) {
    const existing = await prisma.seoSource.findFirst({
      where: { name: source.name },
    });

    if (!existing) {
      await prisma.seoSource.create({
        data: {
          name: source.name,
          url: source.url,
          tier: source.tier,
          category: source.category,
          fetchMethod: source.fetchMethod,
          fetchConfig: (source.fetchConfig || {}) as any,
        },
      });
      console.log(`[Seed] Created source: ${source.name}`);
    }
  }

  console.log(`[Seed] SEO sources seeding complete (${sources.length} sources)`);
}
