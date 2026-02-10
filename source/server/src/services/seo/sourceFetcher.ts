import Parser from 'rss-parser';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { YoutubeTranscript } from 'youtube-transcript';
import crypto from 'crypto';
import { prisma } from '../../db/client.js';

const rssParser = new Parser();

export async function fetchAllSources(digestId: string): Promise<number> {
  const sources = await prisma.seoSource.findMany({ where: { active: true } });
  let fetched = 0;

  for (const source of sources) {
    try {
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
        case 'podcast':
          results = await fetchPodcastFeed(source);
          break;
        default:
          console.warn(`[SourceFetcher] Unknown fetch method: ${source.fetchMethod} for source: ${source.name}`);
          continue;
      }

      const filtered = filterNewContent(results, 45);

      for (const item of filtered) {
        const contentHash = computeContentHash(item.content);

        const existing = await prisma.seoFetchResult.findFirst({
          where: { contentHash, digestId },
        });
        if (existing) continue;

        await prisma.seoFetchResult.create({
          data: {
            digestId,
            sourceId: source.id,
            url: item.url,
            title: item.title,
            content: item.content,
            contentHash,
            publishedAt: item.publishedAt,
          },
        });
        fetched++;
      }

      await prisma.seoSource.update({
        where: { id: source.id },
        data: { lastFetchedAt: new Date() },
      });
    } catch (error) {
      console.error(`[SourceFetcher] Failed to fetch source: ${source.name}`, error);
    }
  }

  return fetched;
}

export async function fetchRssSource(
  source: { url: string; name: string; fetchConfig: any }
): Promise<{ url: string; title: string; content: string; publishedAt?: Date }[]> {
  try {
    const feed = await rssParser.parseURL(source.url);
    return (feed.items || []).map((item) => ({
      url: item.link || source.url,
      title: item.title || 'Untitled',
      content: item.contentSnippet || item.content || item.summary || '',
      publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
    }));
  } catch (error) {
    console.error(`[SourceFetcher] RSS fetch failed for ${source.name}:`, error);
    return [];
  }
}

export async function fetchYouTubeChannel(
  source: { url: string; name: string; fetchConfig: any }
): Promise<{ url: string; title: string; content: string; publishedAt?: Date }[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[SourceFetcher] YOUTUBE_API_KEY not set, skipping YouTube source');
    return [];
  }

  try {
    const config = source.fetchConfig as { channelId?: string };
    const channelId = config?.channelId;
    if (!channelId) {
      console.warn(`[SourceFetcher] No channelId in fetchConfig for ${source.name}`);
      return [];
    }

    const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet&order=date&maxResults=10&type=video`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.items) return [];

    const results: { url: string; title: string; content: string; publishedAt?: Date }[] = [];
    for (const item of data.items) {
      const videoId = item.id.videoId;
      const description = item.snippet.description || '';

      let transcript = '';
      try {
        const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
        transcript = transcriptData.map((t: any) => t.text).join(' ');
      } catch {
        /* transcript unavailable */
      }

      let content = description;
      if (transcript) content += '\n\n--- VIDEO TRANSCRIPT ---\n' + transcript;

      results.push({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: item.snippet.title,
        content,
        publishedAt: new Date(item.snippet.publishedAt),
      });
    }

    return results;
  } catch (error) {
    console.error(`[SourceFetcher] YouTube fetch failed for ${source.name}:`, error);
    return [];
  }
}

export async function fetchRedditSubreddit(
  source: { url: string; name: string; fetchConfig: any }
): Promise<{ url: string; title: string; content: string; publishedAt?: Date }[]> {
  try {
    const config = source.fetchConfig as { subreddit?: string };
    const subreddit = config?.subreddit || source.url.replace(/.*r\//, '').replace(/\/$/, '');
    const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=20`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'TaskTrackerPro/1.0 SEO Intelligence Bot' },
    });
    const data = await res.json();

    if (!data?.data?.children) return [];

    return data.data.children
      .filter((child: any) => !child.data.stickied)
      .map((child: any) => ({
        url: `https://www.reddit.com${child.data.permalink}`,
        title: child.data.title,
        content: child.data.selftext || child.data.title,
        publishedAt: new Date(child.data.created_utc * 1000),
      }));
  } catch (error) {
    console.error(`[SourceFetcher] Reddit fetch failed for ${source.name}:`, error);
    return [];
  }
}

export async function fetchWebPage(
  source: { url: string; name: string; fetchConfig: any }
): Promise<{ url: string; title: string; content: string; publishedAt?: Date }[]> {
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'TaskTrackerPro/1.0 SEO Intelligence Bot' },
    });
    const html = await res.text();

    const dom = new JSDOM(html, { url: source.url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) return [];

    return [{
      url: source.url,
      title: article.title || source.name,
      content: article.textContent || '',
    }];
  } catch (error) {
    console.error(`[SourceFetcher] Webpage fetch failed for ${source.name}:`, error);
    return [];
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchPodcastFeed(
  source: { url: string; name: string; fetchConfig: any }
): Promise<{ url: string; title: string; content: string; publishedAt?: Date }[]> {
  try {
    const feed = await rssParser.parseURL(source.url);
    return (feed.items || []).map((item: any) => {
      const itunesSummary = item.itunes?.summary || '';
      const encodedContent = item['content:encoded'] ? stripHtml(item['content:encoded']) : '';
      const fallback = item.contentSnippet || item.content || '';

      const content = encodedContent || itunesSummary || fallback;

      return {
        url: item.link || source.url,
        title: item.title || 'Untitled Episode',
        content,
        publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
      };
    });
  } catch (error) {
    console.error(`[SourceFetcher] Podcast fetch failed for ${source.name}:`, error);
    return [];
  }
}

export function filterNewContent(
  results: { url: string; title: string; content: string; publishedAt?: Date }[],
  lookbackDays: number
): typeof results {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  return results.filter((item) => {
    if (!item.publishedAt) return true;
    return item.publishedAt >= cutoff;
  });
}

export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}
