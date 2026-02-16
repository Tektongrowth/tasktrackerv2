import { google } from 'googleapis';
import { prisma } from '../db/client.js';

const CLIENTS_FOLDER_ID = process.env.DRIVE_CLIENTS_FOLDER_ID || '';
const SHARE_EMAIL = process.env.DRIVE_SHARE_EMAIL || 'tektongrowth@gmail.com';

// Tekton brand colors (RGB 0-1 range for Sheets API)
const BRAND_CYAN = { red: 0.525, green: 0.965, blue: 0.98 };   // #86F6FA
const BRAND_TEAL = { red: 0.027, green: 0.58, blue: 0.663 };   // #0794A9
const WHITE = { red: 1, green: 1, blue: 1 };

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
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });
}

// What content categories each plan includes
const PLAN_INCLUDES: Record<string, string[]> = {
  package_one: ['onboarding', 'strategy', 'reports', 'assets'],
  package_two: ['onboarding', 'strategy', 'gbp', 'reports', 'assets'],
  package_three: ['onboarding', 'strategy', 'gbp', 'website', 'campaigns', 'reports', 'assets'],
  package_four: ['onboarding', 'strategy', 'gbp', 'website', 'campaigns', 'reports', 'assets'],
  facebook_ads_addon: ['campaigns'],
  custom_website_addon: ['website'],
};

const PLAN_LABELS: Record<string, string> = {
  package_one: 'Package 1 - GBP Setup',
  package_two: 'Package 2 - GBP Management',
  package_three: 'Package 3 - GBP + Website',
  package_four: 'Package 4 - Core 30 SEO',
  facebook_ads_addon: 'Add-on: Facebook Ads',
  custom_website_addon: 'Add-on: Custom Website',
};

interface FolderSpec {
  name: string;
  category: string;
  subfolders?: string[];
  documents?: { name: string; type: 'doc' | 'sheet' }[];
}

function buildFolderSpecs(clientName: string): FolderSpec[] {
  return [
    {
      name: '01-Onboarding',
      category: 'onboarding',
      documents: [
        { name: `Onboarding Call Recording - ${clientName}`, type: 'doc' },
        { name: `Onboarding Form Responses - ${clientName}`, type: 'doc' },
      ],
    },
    {
      name: '02-Strategy',
      category: 'strategy',
      documents: [
        { name: `Client Direction Document - ${clientName}`, type: 'doc' },
        { name: `Competitor Analysis - ${clientName}`, type: 'doc' },
        { name: `Keyword Research - ${clientName}`, type: 'sheet' },
      ],
    },
    {
      name: '03-Website',
      category: 'website',
      subfolders: ['Website Backups'],
      documents: [
        { name: `Content Order & Page Plan - ${clientName}`, type: 'sheet' },
      ],
    },
    {
      name: '04-GBP',
      category: 'gbp',
      documents: [
        { name: `Citation Audit - ${clientName}`, type: 'sheet' },
        { name: `GBP Configuration Doc - ${clientName}`, type: 'doc' },
      ],
    },
    {
      name: '05-Campaigns',
      category: 'campaigns',
      documents: [
        { name: `RR Campaign Brief - ${clientName}`, type: 'doc' },
      ],
    },
    {
      name: '06-Reports',
      category: 'reports',
      subfolders: ['Monthly'],
      documents: [
        { name: `Initial Baseline Report - ${clientName}`, type: 'doc' },
      ],
    },
    {
      name: '07-Assets',
      category: 'assets',
      subfolders: ['Logo', 'Photos'],
    },
  ];
}

interface ClientData {
  name: string;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  websiteUrl?: string | null;
  serviceArea?: string | null;
  primaryServices?: string[];
  ghlLocationId?: string | null;
  gbpLocationId?: string | null;
  googleAdsCustomerId?: string | null;
}

interface CreateDriveFolderResult {
  driveFolderUrl: string;
  cosmoSheetUrl: string;
}

export async function createClientDriveFolder(
  projectId: string,
  planType: string,
  clientData: ClientData,
  projectName: string,
  addOns: string[] = []
): Promise<CreateDriveFolderResult> {
  if (!CLIENTS_FOLDER_ID) {
    throw new Error('DRIVE_CLIENTS_FOLDER_ID environment variable not set');
  }

  const auth = getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth });
  const sheetsApi = google.sheets({ version: 'v4', auth });

  const clientName = clientData.name;
  // Merge categories from main plan type + all add-ons
  const includes = new Set(PLAN_INCLUDES[planType] || PLAN_INCLUDES.package_one);
  for (const addon of addOns) {
    for (const cat of (PLAN_INCLUDES[addon] || [])) {
      includes.add(cat);
    }
  }

  console.log(`[DriveClientFolder] Creating folder structure for "${clientName}" (${planType})`);

  // 1. Create root client folder under 2-Clients/
  const rootFolder = await drive.files.create({
    requestBody: {
      name: clientName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [CLIENTS_FOLDER_ID],
    },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  });
  const rootFolderId = rootFolder.data.id!;
  const driveFolderUrl = rootFolder.data.webViewLink!;

  // 2. Share folder with team (non-blocking)
  if (SHARE_EMAIL) {
    drive.permissions.create({
      fileId: rootFolderId,
      requestBody: {
        role: 'writer',
        type: 'user',
        emailAddress: SHARE_EMAIL,
      },
      sendNotificationEmail: false,
      supportsAllDrives: true,
    }).catch(err => {
      console.warn('[DriveClientFolder] Failed to share folder:', err.message);
    });
  }

  // 3. Create subfolders and spoke documents based on plan
  const folderSpecs = buildFolderSpecs(clientName);
  const createdDocs: { folder: string; name: string; url: string }[] = [];

  for (const spec of folderSpecs) {
    if (!includes.has(spec.category)) continue;

    const subFolder = await drive.files.create({
      requestBody: {
        name: spec.name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    const subFolderId = subFolder.data.id!;

    // Create nested subfolders in parallel
    const nestedPromises = (spec.subfolders || []).map(sf =>
      drive.files.create({
        requestBody: {
          name: sf,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [subFolderId],
        },
        supportsAllDrives: true,
      })
    );

    // Create spoke documents in parallel
    const docPromises = (spec.documents || []).map(async (doc) => {
      const mimeType = doc.type === 'sheet'
        ? 'application/vnd.google-apps.spreadsheet'
        : 'application/vnd.google-apps.document';

      const file = await drive.files.create({
        requestBody: {
          name: doc.name,
          mimeType,
          parents: [subFolderId],
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });

      createdDocs.push({
        folder: spec.name,
        name: doc.name,
        url: file.data.webViewLink!,
      });
    });

    await Promise.all([...nestedPromises, ...docPromises]);
  }

  // 4. Create Cosmo Sheet 3.0 at root level
  const cosmoSheetUrl = await createCosmoSheet(
    sheetsApi, drive, rootFolderId, clientName, clientData, projectName, planType, createdDocs
  );

  // 5. Store URLs on the project record
  await prisma.project.update({
    where: { id: projectId },
    data: { driveFolderUrl, cosmoSheetUrl },
  });

  console.log(`[DriveClientFolder] Created folder for "${clientName}": ${driveFolderUrl}`);

  return { driveFolderUrl, cosmoSheetUrl };
}

async function createCosmoSheet(
  sheetsApi: ReturnType<typeof google.sheets>,
  drive: ReturnType<typeof google.drive>,
  parentFolderId: string,
  clientName: string,
  clientData: ClientData,
  projectName: string,
  planType: string,
  docLinks: { folder: string; name: string; url: string }[]
): Promise<string> {
  const title = `Cosmo Sheet 3.0 - ${clientName}`;

  // Create spreadsheet with 4 tabs
  const spreadsheet = await sheetsApi.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: 'Client Overview', index: 0 } },
        { properties: { title: 'Access & Credentials', index: 1 } },
        { properties: { title: 'Document Library', index: 2 } },
        { properties: { title: 'Key Metrics', index: 3 } },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId!;
  const cosmoUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Move from service account root to client folder
  const fileInfo = await drive.files.get({ fileId: spreadsheetId, fields: 'parents', supportsAllDrives: true });
  const previousParents = (fileInfo.data.parents || []).join(',');
  await drive.files.update({
    fileId: spreadsheetId,
    addParents: parentFolderId,
    removeParents: previousParents,
    fields: 'id, parents',
    supportsAllDrives: true,
  });

  // --- Tab 1: Client Overview ---
  const overviewData = [
    ['CLIENT OVERVIEW', ''],
    [''],
    ['Business Identity', ''],
    ['Business Name', clientData.name],
    ['Contact Name', clientData.contactName || ''],
    ['Email', clientData.email || ''],
    ['Phone', clientData.phone || ''],
    [''],
    ['Location', ''],
    ['Address', clientData.address || ''],
    ['City', clientData.city || ''],
    ['State', clientData.state || ''],
    ['ZIP', clientData.zip || ''],
    ['Service Area', clientData.serviceArea || ''],
    [''],
    ['Business Details', ''],
    ['Website', clientData.websiteUrl || ''],
    ['Primary Services', (clientData.primaryServices || []).join(', ')],
    [''],
    ['Package & Contract', ''],
    ['Project', projectName],
    ['Package', PLAN_LABELS[planType] || planType],
    ['Status', 'Active'],
    [''],
    ['Key Links', ''],
    ['Drive Folder', `https://drive.google.com/drive/folders/${parentFolderId}`],
    ['Cosmo Sheet', cosmoUrl],
  ];

  // --- Tab 2: Access & Credentials ---
  const credData = [
    ['ACCESS & CREDENTIALS', ''],
    [''],
    ['Website', ''],
    ['URL', clientData.websiteUrl || ''],
    ['CMS Login URL', ''],
    ['Username', ''],
    ['Password', ''],
    ['Hosting Provider', ''],
    [''],
    ['Google Properties', ''],
    ['Google Business Profile', clientData.gbpLocationId ? `Location ID: ${clientData.gbpLocationId}` : ''],
    ['Google Ads', clientData.googleAdsCustomerId ? `Customer ID: ${clientData.googleAdsCustomerId}` : ''],
    ['Google Analytics', ''],
    ['Google Search Console', ''],
    ['Google Tag Manager', ''],
    [''],
    ['GHL / CRM', ''],
    ['GHL Location ID', clientData.ghlLocationId || ''],
    ['GHL Sub-account URL', ''],
    [''],
    ['Social Media', ''],
    ['Facebook', ''],
    ['Instagram', ''],
    ['LinkedIn', ''],
    ['YouTube', ''],
    [''],
    ['SEO Tools', ''],
    ['Search Atlas', ''],
    ['OTTO', ''],
    ['Rank Math', ''],
  ];

  // --- Tab 3: Document Library ---
  const docLibData: string[][] = [
    ['DOCUMENT LIBRARY', '', '', '', ''],
    [''],
    ['Folder', 'Document', 'Link', 'Status', 'Owner'],
  ];
  for (const doc of docLinks) {
    docLibData.push([doc.folder, doc.name, doc.url, 'Not Started', '']);
  }

  // --- Tab 4: Key Metrics ---
  const metricsData = [
    ['KEY METRICS', '', '', ''],
    [''],
    ['Metric', 'Current', 'Previous', 'Change'],
    ['Google Reviews (count)', '', '', ''],
    ['Average Rating', '', '', ''],
    ['GBP Impressions (Search)', '', '', ''],
    ['GBP Impressions (Maps)', '', '', ''],
    ['GBP Clicks (Website)', '', '', ''],
    ['GBP Clicks (Directions)', '', '', ''],
    ['GBP Clicks (Phone)', '', '', ''],
    ['Website Sessions', '', '', ''],
    ['Organic Keywords', '', '', ''],
    ['Leads (Total)', '', '', ''],
    ['Ad Spend', '', '', ''],
    ['Cost per Lead', '', '', ''],
  ];

  // Write all tab data
  await sheetsApi.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      data: [
        { range: "'Client Overview'!A1", values: overviewData },
        { range: "'Access & Credentials'!A1", values: credData },
        { range: "'Document Library'!A1", values: docLibData },
        { range: "'Key Metrics'!A1", values: metricsData },
      ],
      valueInputOption: 'USER_ENTERED',
    },
  });

  // Apply formatting
  const sheetIds = spreadsheet.data.sheets!.map((s: any) => s.properties!.sheetId!);
  const formatRequests: any[] = [];

  // Title row (row 0) across all tabs — teal background, white bold text
  for (const sheetId of sheetIds) {
    formatRequests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 },
        cell: {
          userEnteredFormat: {
            backgroundColor: BRAND_TEAL,
            textFormat: { bold: true, fontSize: 14, foregroundColor: WHITE },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
    // Column A width
    formatRequests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 200 },
        fields: 'pixelSize',
      },
    });
    // Column B width
    formatRequests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 300 },
        fields: 'pixelSize',
      },
    });
  }

  // Section headers in Client Overview — cyan background, bold
  for (const row of [2, 8, 15, 19, 24]) {
    formatRequests.push({
      repeatCell: {
        range: { sheetId: sheetIds[0], startRowIndex: row, endRowIndex: row + 1, startColumnIndex: 0, endColumnIndex: 2 },
        cell: {
          userEnteredFormat: {
            backgroundColor: BRAND_CYAN,
            textFormat: { bold: true, fontSize: 11 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
  }

  // Section headers in Access & Credentials
  for (const row of [2, 9, 16, 20, 26]) {
    formatRequests.push({
      repeatCell: {
        range: { sheetId: sheetIds[1], startRowIndex: row, endRowIndex: row + 1, startColumnIndex: 0, endColumnIndex: 2 },
        cell: {
          userEnteredFormat: {
            backgroundColor: BRAND_CYAN,
            textFormat: { bold: true, fontSize: 11 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
  }

  // Document Library column header row (row 2) + wider columns
  formatRequests.push({
    repeatCell: {
      range: { sheetId: sheetIds[2], startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 5 },
      cell: {
        userEnteredFormat: {
          backgroundColor: BRAND_CYAN,
          textFormat: { bold: true },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  });
  formatRequests.push({
    updateDimensionProperties: {
      range: { sheetId: sheetIds[2], dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
      properties: { pixelSize: 350 },
      fields: 'pixelSize',
    },
  });
  formatRequests.push({
    updateDimensionProperties: {
      range: { sheetId: sheetIds[2], dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
      properties: { pixelSize: 400 },
      fields: 'pixelSize',
    },
  });

  // Key Metrics column header row (row 2)
  formatRequests.push({
    repeatCell: {
      range: { sheetId: sheetIds[3], startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 4 },
      cell: {
        userEnteredFormat: {
          backgroundColor: BRAND_CYAN,
          textFormat: { bold: true },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  });

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: formatRequests },
  });

  return cosmoUrl;
}
