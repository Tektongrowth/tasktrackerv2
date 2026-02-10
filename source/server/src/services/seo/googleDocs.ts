import { google } from 'googleapis';

function getGoogleAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set');
  }

  const key = JSON.parse(Buffer.from(keyJson, 'base64').toString('utf-8'));

  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

interface DigestRecommendation {
  category: string;
  title: string;
  summary: string;
  details: string;
  impact: string;
  confidence: string;
  sourceCount: number;
  citations?: { sourceName: string; sourceUrl: string; excerpt: string }[];
}

interface DigestData {
  id: string;
  period: string;
  sourcesFetched: number;
  recommendationsGenerated: number;
  taskDraftsCreated: number;
  sopDraftsCreated: number;
}

export async function createDigestDocument(
  digest: DigestData,
  recommendations: DigestRecommendation[],
  folderId?: string
): Promise<string> {
  const auth = getGoogleAuth();
  const docs = google.docs({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  const title = `SEO Intelligence Report — ${digest.period}`;

  const createRes = await docs.documents.create({
    requestBody: { title },
  });

  const docId = createRes.data.documentId!;

  if (folderId) {
    try {
      await drive.files.update({
        fileId: docId,
        addParents: folderId,
        fields: 'id, parents',
      });
    } catch (error) {
      console.warn('[GoogleDocs] Failed to move doc to folder:', error);
    }
  }

  const requests: any[] = [];
  let insertIndex = 1;

  const addText = (text: string, style?: string) => {
    const endIndex = insertIndex + text.length;
    requests.push({
      insertText: { location: { index: insertIndex }, text },
    });
    if (style === 'HEADING_1' || style === 'HEADING_2' || style === 'HEADING_3') {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: insertIndex, endIndex },
          paragraphStyle: { namedStyleType: style },
          fields: 'namedStyleType',
        },
      });
    }
    insertIndex = endIndex;
  };

  addText(`SEO Intelligence Report\n`, 'HEADING_1');
  addText(`Period: ${digest.period}\n\n`);

  addText(`Executive Summary\n`, 'HEADING_2');
  addText(`Sources analyzed: ${digest.sourcesFetched}\n`);
  addText(`Recommendations: ${digest.recommendationsGenerated}\n`);
  addText(`Task drafts: ${digest.taskDraftsCreated}\n`);
  addText(`SOP updates suggested: ${digest.sopDraftsCreated}\n\n`);

  const highImpact = recommendations.filter((r) => r.impact === 'high');
  if (highImpact.length > 0) {
    addText(`High-Impact Changes\n`, 'HEADING_2');
    for (const rec of highImpact) {
      addText(`${rec.title}\n`, 'HEADING_3');
      addText(`Category: ${rec.category} | Confidence: ${rec.confidence} | Sources: ${rec.sourceCount}\n`);
      addText(`${rec.summary}\n\n`);
      addText(`${rec.details}\n\n`);

      if (rec.citations && rec.citations.length > 0) {
        addText(`Sources:\n`);
        for (const citation of rec.citations) {
          addText(`• ${citation.sourceName}: "${citation.excerpt}"\n  ${citation.sourceUrl}\n`);
        }
        addText(`\n`);
      }
    }
  }

  const categories = [...new Set(recommendations.map((r) => r.category))];
  addText(`All Recommendations by Category\n`, 'HEADING_2');

  for (const category of categories) {
    const catRecs = recommendations.filter((r) => r.category === category);
    addText(`${category}\n`, 'HEADING_3');

    for (const rec of catRecs) {
      addText(`${rec.impact.toUpperCase()} — ${rec.title}\n`);
      addText(`${rec.summary}\n\n`);
    }
  }

  if (requests.length > 0) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests },
    });
  }

  return `https://docs.google.com/document/d/${docId}/edit`;
}

export async function listSopDocuments(
  folderId: string
): Promise<{ id: string; name: string }[]> {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
    fields: 'files(id, name)',
    orderBy: 'name',
  });

  return (res.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
  }));
}

export async function getSopContent(docId: string): Promise<string> {
  const auth = getGoogleAuth();
  const docs = google.docs({ version: 'v1', auth });

  const doc = await docs.documents.get({ documentId: docId });
  const content = doc.data.body?.content || [];

  let text = '';
  for (const element of content) {
    if (element.paragraph) {
      for (const el of element.paragraph.elements || []) {
        if (el.textRun) {
          text += el.textRun.content;
        }
      }
    }
  }

  return text;
}

export async function createSopDocument(
  title: string,
  content: string,
  folderId: string
): Promise<string> {
  const auth = getGoogleAuth();
  const docs = google.docs({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  const createRes = await docs.documents.create({
    requestBody: { title },
  });

  const docId = createRes.data.documentId!;

  try {
    await drive.files.update({
      fileId: docId,
      addParents: folderId,
      fields: 'id, parents',
    });
  } catch (error) {
    console.warn('[GoogleDocs] Failed to move strategy doc to folder:', error);
  }

  const requests: any[] = [];
  let insertIndex = 1;

  const addText = (text: string, style?: string) => {
    const endIndex = insertIndex + text.length;
    requests.push({
      insertText: { location: { index: insertIndex }, text },
    });
    if (style === 'HEADING_1' || style === 'HEADING_2' || style === 'HEADING_3') {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: insertIndex, endIndex },
          paragraphStyle: { namedStyleType: style },
          fields: 'namedStyleType',
        },
      });
    }
    insertIndex = endIndex;
  };

  addText(`${title}\n`, 'HEADING_1');

  const sections = content.split(/\n(?=#{1,3}\s)/);
  for (const section of sections) {
    const headingMatch = section.match(/^(#{1,3})\s+(.+)\n/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const style = level === 1 ? 'HEADING_1' : level === 2 ? 'HEADING_2' : 'HEADING_3';
      addText(`${headingText}\n`, style);
      const body = section.slice(headingMatch[0].length);
      if (body.trim()) {
        addText(`${body.trim()}\n\n`);
      }
    } else if (section.trim()) {
      addText(`${section.trim()}\n\n`);
    }
  }

  if (requests.length > 0) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests },
    });
  }

  return `https://docs.google.com/document/d/${docId}/edit`;
}

export async function applyDraftSopEdit(
  sopDocId: string,
  afterContent: string,
  description: string
): Promise<void> {
  const auth = getGoogleAuth();
  const docs = google.docs({ version: 'v1', auth });

  const doc = await docs.documents.get({ documentId: sopDocId });
  const body = doc.data.body;
  if (!body || !body.content) {
    throw new Error('Could not read SOP document body');
  }

  const lastElement = body.content[body.content.length - 1];
  const endIndex = lastElement?.endIndex || 1;

  await docs.documents.batchUpdate({
    documentId: sopDocId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: endIndex - 1 },
            text: `\n\n--- SEO Intelligence Update (${new Date().toISOString().split('T')[0]}) ---\n${description}\n\n${afterContent}\n`,
          },
        },
      ],
    },
  });
}
