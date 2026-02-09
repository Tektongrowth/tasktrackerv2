import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../../db/client.js';

const anthropic = new Anthropic();

interface ArticleForAnalysis {
  id: string;
  url: string;
  title: string;
  content: string;
  sourceName: string;
  sourceTier: string;
  category: string;
}

interface ParsedRecommendation {
  category: string;
  title: string;
  summary: string;
  details: string;
  impact: string;
  confidence: string;
  citations: { fetchResultId: string; sourceUrl: string; sourceName: string; excerpt: string }[];
}

interface ParsedTaskDraft {
  title: string;
  description: string;
  suggestedPriority: string;
  suggestedDueInDays: number;
  recommendationIndex: number;
}

interface ParsedSopDraft {
  sopDocId: string;
  sopTitle: string;
  description: string;
  beforeContent: string;
  afterContent: string;
  recommendationIndex: number;
}

export async function analyzeContent(digestId: string): Promise<{
  recommendations: ParsedRecommendation[];
  taskDrafts: ParsedTaskDraft[];
  sopDrafts: ParsedSopDraft[];
}> {
  const fetchResults = await prisma.seoFetchResult.findMany({
    where: { digestId },
    include: { source: true },
  });

  if (fetchResults.length === 0) {
    return { recommendations: [], taskDrafts: [], sopDrafts: [] };
  }

  const articles: ArticleForAnalysis[] = fetchResults.map((fr) => ({
    id: fr.id,
    url: fr.url,
    title: fr.title,
    content: fr.content.substring(0, 2000),
    sourceName: fr.source.name,
    sourceTier: fr.source.tier,
    category: fr.source.category,
  }));

  const settings = await prisma.seoSettings.findFirst();

  // Chunk articles into batches of 20 to avoid truncated responses
  const BATCH_SIZE = 20;
  const allRecommendations: ParsedRecommendation[] = [];

  console.log(`[AIAnalyzer] Analyzing ${articles.length} articles in batches of ${BATCH_SIZE} for digest ${digestId}`);

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(articles.length / BATCH_SIZE);

    console.log(`[AIAnalyzer] Processing batch ${batchNum}/${totalBatches} (${batch.length} articles)`);

    const prompt = buildAnalysisPrompt(batch, settings);
    const response = await callClaudeApi(prompt.userPrompt, prompt.systemPrompt);
    const batchRecs = parseRecommendations(response, batch);

    console.log(`[AIAnalyzer] Batch ${batchNum}: ${batchRecs.length} recommendations`);
    allRecommendations.push(...batchRecs);
  }

  const recommendations = allRecommendations;
  console.log(`[AIAnalyzer] Total: ${recommendations.length} recommendations from ${articles.length} articles`);

  const taskDrafts = await generateTaskDrafts(recommendations);
  console.log(`[AIAnalyzer] Generated ${taskDrafts.length} task drafts`);
  const sopDrafts = await generateSopSuggestions(recommendations);
  console.log(`[AIAnalyzer] Generated ${sopDrafts.length} SOP drafts`);

  return { recommendations, taskDrafts, sopDrafts };
}

export function buildAnalysisPrompt(
  articles: ArticleForAnalysis[],
  settings: any
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are an expert Local SEO analyst specializing in the landscape, hardscape, and outdoor living contractor industry. Your goal is to maximize qualified, high-ticket leads for agency clients.

INDUSTRY CONTEXT:
- Clients are landscape, hardscape, and outdoor living contractors
- Services: patios, outdoor kitchens, retaining walls, landscape design, hardscape installation
- Target: homeowners looking for $10K-$100K+ outdoor living projects
- Lead channels: Google Business Profile, Google Maps, Local Service Ads, Meta Ads, Yelp, Nextdoor, Angi, Thumbtack

SOURCE TIER WEIGHTING:
- Tier 1 (Google official sources): Highest authority. Changes here are confirmed.
- Tier 2 (Industry experts like Whitespark, BrightLocal, Sterling Sky): High authority. Trusted analysis.
- Tier 3 (Community sources like Reddit, blogs): Supporting evidence only.

CONSENSUS RULES:
- 2+ sources mentioning the same change/trend = "verified" (high confidence)
- 1 source only = "emerging" (medium confidence)
- Tier 1 source alone = can be "verified" (Google official word is sufficient)

CATEGORIES: GBP, Maps, LSA, Meta Ads, Yelp, Nextdoor, Angi, Thumbtack, General SEO, Industry Trends

You MUST respond with valid JSON only. No markdown, no explanations outside JSON.`;

  const articlesSummary = articles.map((a, i) =>
    `[${i}] SOURCE: ${a.sourceName} (${a.sourceTier}) | CATEGORY: ${a.category}\nTITLE: ${a.title}\nURL: ${a.url}\nCONTENT: ${a.content}\n`
  ).join('\n---\n');

  const userPrompt = `Analyze the following ${articles.length} articles from the past month and generate actionable SEO intelligence recommendations for landscape/hardscape contractor clients.

ARTICLES:
${articlesSummary}

Respond with this exact JSON structure:
{
  "recommendations": [
    {
      "category": "GBP|Maps|LSA|Meta Ads|Yelp|Nextdoor|Angi|Thumbtack|General SEO|Industry Trends",
      "title": "Short actionable title",
      "summary": "2-3 sentence summary of the change/trend and why it matters",
      "details": "Detailed explanation with specific actions to take for contractor clients",
      "impact": "high|medium|low",
      "confidence": "verified|emerging",
      "citationIndices": [0, 3],
      "citationExcerpts": ["relevant quote from article 0", "relevant quote from article 3"]
    }
  ],
  "taskDrafts": [
    {
      "title": "Actionable task title",
      "description": "What to do, step by step",
      "suggestedPriority": "high|medium|low|urgent",
      "suggestedDueInDays": 7,
      "recommendationIndex": 0
    }
  ],
  "sopDrafts": [
    {
      "sopDocId": "",
      "sopTitle": "Name of SOP that needs updating",
      "description": "Why this SOP needs updating",
      "beforeContent": "Current approach (describe what to look for)",
      "afterContent": "Updated approach based on new intel",
      "recommendationIndex": 0
    }
  ]
}

Focus on changes that directly impact lead generation for high-ticket outdoor living services. Every recommendation MUST cite at least one source article by index. Prioritize actionable items over informational ones.`;

  return { systemPrompt, userPrompt };
}

export async function callClaudeApi(
  userPrompt: string,
  systemPrompt: string
): Promise<string> {
  console.log(`[AIAnalyzer] Calling Claude API (prompt: ${userPrompt.length} chars)`);
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const result = textBlock ? textBlock.text : '';
    console.log(`[AIAnalyzer] Claude API response: ${result.length} chars, stop_reason: ${message.stop_reason}`);
    return result;
  } catch (error) {
    console.error('[AIAnalyzer] Claude API call failed:', error);
    throw error;
  }
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  return cleaned.trim();
}

export function parseRecommendations(
  response: string,
  articles: ArticleForAnalysis[]
): ParsedRecommendation[] {
  if (!response) {
    console.error('[AIAnalyzer] Empty response from Claude API');
    return [];
  }
  console.log(`[AIAnalyzer] Response length: ${response.length} chars, first 200: ${response.substring(0, 200)}`);
  try {
    const cleaned = stripCodeFences(response);
    const parsed = JSON.parse(cleaned);
    if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
      console.error('[AIAnalyzer] No recommendations array in response');
      return [];
    }

    return parsed.recommendations.map((rec: any) => {
      const citations = (rec.citationIndices || []).map((idx: number, i: number) => {
        const article = articles[idx];
        if (!article) return null;
        return {
          fetchResultId: article.id,
          sourceUrl: article.url,
          sourceName: article.sourceName,
          excerpt: rec.citationExcerpts?.[i] || '',
        };
      }).filter(Boolean);

      return {
        category: rec.category || 'General SEO',
        title: rec.title || 'Untitled Recommendation',
        summary: rec.summary || '',
        details: rec.details || '',
        impact: rec.impact || 'medium',
        confidence: citations.length >= 2 ? 'verified' : 'emerging',
        citations,
      };
    });
  } catch (error) {
    console.error('[AIAnalyzer] Failed to parse AI response:', error);
    return [];
  }
}

export async function generateSopSuggestions(
  recommendations: ParsedRecommendation[]
): Promise<ParsedSopDraft[]> {
  if (recommendations.length === 0) return [];

  const prompt = `Based on these SEO recommendations, suggest SOP updates needed:

${recommendations.map((r, i) => `[${i}] ${r.title}: ${r.summary}`).join('\n')}

Respond with JSON array:
[{
  "sopDocId": "",
  "sopTitle": "Name of SOP",
  "description": "Why update is needed",
  "beforeContent": "Current approach",
  "afterContent": "Updated approach",
  "recommendationIndex": 0
}]

Only suggest SOP updates for high-impact, verified recommendations. Return empty array [] if none needed.`;

  try {
    const response = await callClaudeApi(prompt, 'You are an SOP management assistant. Respond with valid JSON only.');
    const parsed = JSON.parse(stripCodeFences(response));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('[AIAnalyzer] Failed to generate SOP suggestions:', error);
    return [];
  }
}

export async function generateTaskDrafts(
  recommendations: ParsedRecommendation[]
): Promise<ParsedTaskDraft[]> {
  if (recommendations.length === 0) return [];

  const prompt = `Based on these SEO recommendations, create actionable task drafts:

${recommendations.map((r, i) => `[${i}] ${r.title} (${r.impact} impact, ${r.confidence}): ${r.summary}`).join('\n')}

Respond with JSON array:
[{
  "title": "Actionable task title",
  "description": "Step-by-step what to do",
  "suggestedPriority": "high|medium|low|urgent",
  "suggestedDueInDays": 7,
  "recommendationIndex": 0
}]

Create 1-2 tasks per high-impact recommendation. Focus on concrete actions. Return empty array [] if none needed.`;

  try {
    const response = await callClaudeApi(prompt, 'You are a task management assistant for an SEO agency. Respond with valid JSON only.');
    const parsed = JSON.parse(stripCodeFences(response));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('[AIAnalyzer] Failed to generate task drafts:', error);
    return [];
  }
}
