import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../../db/client.js';
import { getSopContent } from './googleDocs.js';

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
  templateSetId?: string;
  draftType: 'update' | 'new';
  sopDocId: string;
  sopTitle: string;
  description: string;
  beforeContent: string;
  afterContent: string;
  recommendationIndex: number;
}

interface TemplateSetContext {
  id: string;
  name: string;
  description: string | null;
  strategyDocId: string | null;
  strategyDocContent: string | null;
  templates: {
    title: string;
    description: string | null;
    dueInDays: number | null;
    sortOrder: number;
    subtasks: { title: string; sortOrder: number }[];
  }[];
}

export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  const marker = '--- VIDEO TRANSCRIPT ---';
  const idx = content.indexOf(marker);
  if (idx === -1) return content.substring(0, maxLength);
  const desc = content.substring(0, idx);
  const remaining = maxLength - desc.length;
  if (remaining <= 100) return desc.trim();
  return desc + content.substring(idx, idx + remaining);
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
    content: truncateContent(fr.content, 6000),
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
  const templateSetContexts = await loadTemplateSetContext();
  console.log(`[AIAnalyzer] Loaded ${templateSetContexts.length} template set contexts`);
  const sopDrafts = await generateSopSuggestions(recommendations, templateSetContexts);
  console.log(`[AIAnalyzer] Generated ${sopDrafts.length} SOP drafts`);

  return { recommendations, taskDrafts, sopDrafts };
}

export function buildAnalysisPrompt(
  articles: ArticleForAnalysis[],
  settings: any
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are an expert Local SEO intelligence analyst for Tekton Growth, a digital marketing agency that runs the "Local Market Domination System" for landscape, hardscape, and outdoor living contractors — high-ticket services ($10K-$100K+ projects).

YOUR ROLE: Analyze industry news and identify changes that affect our system. For each finding, explain what we currently do, what's changing, and what we should adjust.

=== OUR SYSTEM: LOCAL MARKET DOMINATION ===

We run ONE unified 4-layer system. Each layer builds on the previous:

LAYER 1 — REVIEW GENERATION (Reputation Accelerator)
What we do now:
- Automated SMS + email review request sequences
- Automated follow-up for non-responders
- Reviews posted to Google
- Builds ranking signals + click-through rates + instant credibility
Why it matters: Nothing else performs without a trust foundation.

LAYER 2 — GBP OPTIMIZATION (GBP Booster)
What we do now:
- Full category optimization (primary + secondary)
- 20-30 services with keyword-aligned descriptions
- SEO-focused business description
- Photos, branding, Q&A, products
- Keyword alignment across all GBP fields
Why it matters: GBP drives 60-70% of service-based calls.

LAYER 3 — LOCAL SERVICE ADS (Fast Wins Accelerator)
What we do now:
- Google Guaranteed badge setup
- Service area configuration
- Budget & bidding optimization
- Dispute management
- Call tracking & reporting
Why it matters: Gets phone ringing in 7-14 days while we build authority.

LAYER 4 — CORE 30 AUTHORITY BUILDER (Long-Term Authority Engine)
What we do now:
- Dedicated web page for every service
- Dedicated page for every GBP category
- Local landing pages for service areas
- SEO-optimized content with topical relevance
- Geographic relevance expansion
Why it matters: Builds organic ranking infrastructure. 8-12 months to wider radius + organic lead surge.

OPTIONAL — FACEBOOK ADS (Volume Accelerator)
What we do now:
- Retargeting campaigns
- Awareness campaigns
- Seasonal promotions
- Lead gen for specific areas

=== CLIENT CONTEXT ===
- Clients: landscape, hardscape, outdoor living contractors
- Services: patios, outdoor kitchens, retaining walls, landscape design, hardscape installation, pool decks, pergolas, fire pits, driveways
- Target: homeowners with $10K-$100K+ outdoor living projects
- Goal: maximize qualified, high-ticket lead volume — never leave good leads on the table

=== SOURCE TIER WEIGHTING ===
- Tier 1 (Google official): Highest authority — confirmed changes
- Tier 2 (Industry experts: Whitespark, BrightLocal, Sterling Sky, Joy Hawkins, Darren Shaw): High authority
- Tier 3 (Community: Reddit, forums, blogs): Supporting evidence only

=== CONSENSUS RULES ===
- 2+ sources on same topic = "verified"
- 1 source only = "emerging"
- Tier 1 alone = "verified" (Google's word is sufficient)

You MUST respond with valid JSON only. No markdown code fences, no text outside the JSON object.`;

  const articlesSummary = articles.map((a, i) =>
    `[${i}] SOURCE: ${a.sourceName} (${a.sourceTier}) | CATEGORY: ${a.category}\nTITLE: ${a.title}\nURL: ${a.url}\nCONTENT: ${a.content}\n`
  ).join('\n---\n');

  const userPrompt = `Analyze these ${articles.length} articles and generate recommendations mapped to our Local Market Domination System layers.

ARTICLES:
${articlesSummary}

Respond with this exact JSON structure:
{
  "recommendations": [
    {
      "category": "Layer 1: Reviews|Layer 2: GBP|Layer 3: LSA|Layer 4: Core 30|Facebook Ads|Cross-Layer",
      "title": "Short actionable title",
      "summary": "2-3 sentences: what changed and why it matters to our system",
      "details": "CURRENT APPROACH: What we do now in this layer.\\nWHAT'S CHANGING: The specific change/trend from the source(s).\\nRECOMMENDED ADJUSTMENT: Exactly what to change in our process, with step-by-step actions.",
      "impact": "high|medium|low",
      "confidence": "verified|emerging",
      "citationIndices": [0, 3],
      "citationExcerpts": ["relevant quote from article 0", "relevant quote from article 3"]
    }
  ],
  "taskDrafts": [
    {
      "title": "Actionable task title (include which layer)",
      "description": "Step-by-step what to do and for which clients",
      "suggestedPriority": "high|medium|low|urgent",
      "suggestedDueInDays": 7,
      "recommendationIndex": 0
    }
  ],
  "sopDrafts": [
    {
      "sopDocId": "",
      "sopTitle": "Name of SOP that needs updating",
      "description": "Why this SOP needs updating based on the intelligence",
      "beforeContent": "Current approach in our SOP",
      "afterContent": "Updated approach with the new intelligence incorporated",
      "recommendationIndex": 0
    }
  ]
}

RULES:
- Every recommendation MUST map to a specific layer (or "Cross-Layer" if it affects multiple)
- Every recommendation MUST include CURRENT APPROACH, WHAT'S CHANGING, and RECOMMENDED ADJUSTMENT in the details
- Every recommendation MUST cite at least one source article by index
- Focus on changes that directly impact lead generation for high-ticket outdoor living contractors
- Prioritize things that require immediate action over informational items
- If nothing meaningful changed for a layer, don't force a recommendation — quality over quantity`;

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

function extractDocIdFromUrl(url: string): string | null {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function loadTemplateSetContext(): Promise<TemplateSetContext[]> {
  const templateSets = await prisma.templateSet.findMany({
    where: { active: true },
    include: {
      templates: {
        orderBy: { sortOrder: 'asc' },
        include: {
          subtasks: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  });

  const contexts: TemplateSetContext[] = [];

  for (const ts of templateSets) {
    let strategyDocId: string | null = null;
    let strategyDocContent: string | null = null;

    if (ts.strategyDocUrl) {
      strategyDocId = extractDocIdFromUrl(ts.strategyDocUrl);
      if (strategyDocId) {
        try {
          strategyDocContent = await getSopContent(strategyDocId);
        } catch (error) {
          console.warn(`[AIAnalyzer] Failed to fetch strategy doc for "${ts.name}":`, error);
        }
      }
    }

    contexts.push({
      id: ts.id,
      name: ts.name,
      description: ts.description,
      strategyDocId,
      strategyDocContent,
      templates: ts.templates.map((t) => ({
        title: t.title,
        description: t.description,
        dueInDays: t.dueInDays,
        sortOrder: t.sortOrder,
        subtasks: t.subtasks.map((s) => ({
          title: s.title,
          sortOrder: s.sortOrder,
        })),
      })),
    });
  }

  return contexts;
}

export async function generateSopSuggestions(
  recommendations: ParsedRecommendation[],
  templateSetContexts: TemplateSetContext[]
): Promise<ParsedSopDraft[]> {
  if (templateSetContexts.length === 0) return [];

  const recsText = recommendations.map((r, i) =>
    `[${i}] ${r.title} (${r.impact} impact, ${r.confidence}): ${r.summary}`
  ).join('\n');

  const templateSetSections = templateSetContexts.map((ts) => {
    const templateList = ts.templates.map((t) => {
      const subtaskList = t.subtasks.length > 0
        ? t.subtasks.map((s) => `      - ${s.title}`).join('\n')
        : '';
      return `    ${t.sortOrder + 1}. ${t.title}${t.description ? ` — ${t.description}` : ''}${t.dueInDays ? ` (due in ${t.dueInDays} days)` : ''}${subtaskList ? '\n' + subtaskList : ''}`;
    }).join('\n');

    if (ts.strategyDocContent) {
      return `TEMPLATE SET: "${ts.name}" (ID: ${ts.id})
${ts.description ? `Description: ${ts.description}\n` : ''}Templates in this set:
${templateList}

CURRENT STRATEGY DOCUMENT:
${ts.strategyDocContent}

INSTRUCTION: Based on the recommendations below, suggest specific updates to this strategy document. Show what sections to change and why.`;
    } else {
      return `TEMPLATE SET: "${ts.name}" (ID: ${ts.id})
${ts.description ? `Description: ${ts.description}\n` : ''}Templates in this set:
${templateList}

INSTRUCTION: No strategy document exists for this set. Generate a complete strategy document with:
1. STRATEGY OVERVIEW: What this strategy accomplishes and why it matters for high-ticket outdoor living contractors
2. HOW IT WORKS: High-level approach based on the templates listed above
3. KEY IMPLEMENTATION DETAILS: For each major template, explain what to do and why
4. SUCCESS METRICS: How to measure if the strategy is working`;
    }
  }).join('\n\n---\n\n');

  const prompt = `You are creating/updating strategy documents for template sets in a task management system used by an SEO agency serving high-ticket outdoor living contractors.

TEMPLATE SETS TO PROCESS:
${templateSetSections}

RECENT SEO RECOMMENDATIONS:
${recsText || 'No new recommendations this cycle.'}

For each template set, generate a strategy document entry. Respond with a JSON array:
[{
  "templateSetId": "the template set UUID",
  "draftType": "new" or "update",
  "sopDocId": "google-doc-id if updating existing, empty string if new",
  "sopTitle": "Strategy document title",
  "description": "Why this draft was generated",
  "beforeContent": "Current relevant section (for updates only, empty string for new)",
  "afterContent": "Full strategy document content (for new) or updated section (for updates)",
  "recommendationIndex": -1
}]

RULES:
- For "new" docs: afterContent should be a complete, well-structured strategy document. beforeContent should be empty string.
- For "update" docs: only include changes relevant to the new recommendations. beforeContent should quote the current text being changed. recommendationIndex should reference the most relevant recommendation.
- If a template set with an existing strategy doc has no relevant recommendations, skip it entirely.
- Every template set WITHOUT a strategy doc should get a "new" draft.
- Write in a professional but practical tone. Focus on actionable guidance.`;

  try {
    const response = await callClaudeApi(prompt, 'You are a strategy document writer for an SEO agency. Respond with valid JSON only.');
    const parsed = JSON.parse(stripCodeFences(response));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((draft: any) => ({
      templateSetId: draft.templateSetId || undefined,
      draftType: draft.draftType === 'new' ? 'new' : 'update',
      sopDocId: draft.sopDocId || '',
      sopTitle: draft.sopTitle || 'Strategy Document',
      description: draft.description || '',
      beforeContent: draft.beforeContent || '',
      afterContent: draft.afterContent || '',
      recommendationIndex: draft.recommendationIndex ?? -1,
    }));
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
