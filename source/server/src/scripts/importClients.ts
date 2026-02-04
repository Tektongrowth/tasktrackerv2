import { PlanType } from '@prisma/client';
import { prisma } from '../db/client.js';
import { applyNewProjectTemplates } from '../services/templateService.js';

interface ClientRow {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  businessName: string;
  package: string;
}

const clients: ClientRow[] = [
  { firstName: 'Matt', lastName: 'Geier', phone: '16085772585', email: 'mattmadisongreenteam@gmail.com', businessName: 'Madison Green Team', package: 'package_four' },
  { firstName: 'Phillip', lastName: 'Abreu', phone: '14074561369', email: 'phillip@ludlowservices.com', businessName: 'Ludlow Services', package: 'package_three' },
  { firstName: 'Mark', lastName: 'Todd', phone: '16109608868', email: 'toddqualitylandscape@gmail.com', businessName: 'Todd Quality Landscapes', package: 'package_four' },
  { firstName: 'Allison', lastName: 'Vartanian', phone: '14133622155', email: 'allie@stclairlandscaping.net', businessName: 'St. Clair Landscaping', package: 'package_four' },
  { firstName: 'Logan', lastName: 'Conklin', phone: '19378969669', email: 'conklinlandscapesolutions@gmail.com', businessName: 'Conklin Landscape Solutions', package: 'facebook_ads_addon' },
  { firstName: 'Matt', lastName: 'Lantz', phone: '13076308188', email: 'mlantz6@gmail.com', businessName: 'Blue Ribbon Lawn & Landscape', package: 'website_only' },
  { firstName: 'Kyle', lastName: 'Deere', phone: '18165206374', email: 'kyle@atlaslandscapekc.com', businessName: 'Atlas Landscape', package: 'package_four' },
  { firstName: 'Shelbi', lastName: 'Dodd', phone: '17074852615', email: 'office@allinheatingandcooling.com', businessName: 'All In Heating and Cooling', package: 'package_four' },
  { firstName: 'Dylan', lastName: 'Mcisaac', phone: '19026294890', email: 'mcisaac.lawncare@gmail.com', businessName: 'McIsaac Lawn Care', package: 'package_four' },
  { firstName: 'Gracie', lastName: 'Wade', phone: '18652555136', email: 'gracie@wadescapes.com', businessName: 'Wadescapes', package: 'package_four' },
  { firstName: 'Jason', lastName: 'Nolt', phone: '17178237461', email: 'jason@authentichomescapes.com', businessName: 'Authentic Homescapes', package: 'package_four' },
  { firstName: 'Rocco', lastName: "D'angelo", phone: '16476221486', email: 'info@nrxlandscaping.com', businessName: 'NRX Landscaping', package: 'package_four' },
  { firstName: 'Matthew', lastName: 'Foran', phone: '16109552293', email: 'foranlawns@gmail.com', businessName: 'Foran Lawn & Yard', package: 'package_four' },
  { firstName: 'Jon', lastName: 'Lee', phone: '13193103031', email: 'leeslandscapecr@gmail.com', businessName: "Lee's Landscaping", package: 'package_four' },
  { firstName: 'Richard', lastName: 'Carroll', phone: '15744403001', email: 'rcoutdoorllc@gmail.com', businessName: 'RC Outdoor', package: 'package_four' },
  { firstName: 'Justin', lastName: 'Laughter', phone: '', email: 'justin@laughterfamilyhardscapes.com', businessName: 'Laughter Family Hardscapes', package: 'package_four' },
  { firstName: 'Rick', lastName: 'Tillotson', phone: '12072725460', email: 'rick@maineoutdoorspaces.com', businessName: 'Maine Outdoor Spaces', package: 'package_four' },
  { firstName: 'Jesus', lastName: 'Hernandez', phone: '15132952382', email: 'leonslandscapes@gmail.com', businessName: "Leon's Landscaping", package: 'package_four' },
  { firstName: 'Joel', lastName: 'Post', phone: '18152913839', email: 'greenescapeslawn@live.com', businessName: 'Green Escapes Lawncare', package: 'package_four' },
  { firstName: 'Tom', lastName: 'Sorce', phone: '14125235001', email: 'sorcelandscape@gmail.com', businessName: 'Sorce Landscapes', package: 'package_four' },
  { firstName: 'Ervin', lastName: 'Stoltzfus', phone: '15709397278', email: 'toprockdesign18@gmail.com', businessName: 'Top Rock Design LLC', package: 'package_four' },
  { firstName: 'Nicolle', lastName: 'Mendoza', phone: '16056814828', email: 'nicolle@tierradesignsf.com', businessName: 'Tierra Design - Landscape Design/Build', package: 'package_four' },
  { firstName: 'Chris', lastName: 'Hellen', phone: '17635871587', email: 'chris@candklawn.com', businessName: 'Next Level Outdoor Services', package: 'package_four' },
  { firstName: 'Jon', lastName: 'Valenta', phone: '19082005851', email: 'jon@generalpavingstones.com', businessName: 'General Paving Stones', package: 'package_two' },
];

function mapPackage(pkg: string): PlanType | null {
  const mapping: Record<string, PlanType> = {
    'package_one': 'package_one',
    'package_two': 'package_two',
    'package_three': 'package_three',
    'package_four': 'package_four',
    'facebook_ads_addon': 'facebook_ads_addon',
    'custom_website_addon': 'custom_website_addon',
  };
  return mapping[pkg] || null;
}

async function importClients() {
  console.log('Starting client import...\n');

  let created = 0;
  let skipped = 0;
  let totalTasks = 0;

  for (const row of clients) {
    // Check if client already exists by email or business name
    const existingClient = await prisma.client.findFirst({
      where: {
        OR: [
          { email: row.email },
          { name: row.businessName }
        ]
      }
    });

    if (existingClient) {
      console.log(`SKIP: "${row.businessName}" already exists (id: ${existingClient.id})`);
      skipped++;
      continue;
    }

    // Create client
    const client = await prisma.client.create({
      data: {
        name: row.businessName,
        email: row.email,
        phone: row.phone || null,
      }
    });

    // Determine plan type
    const planType = mapPackage(row.package);
    const isWebsiteOnly = row.package === 'website_only';

    // Create project
    const project = await prisma.project.create({
      data: {
        clientId: client.id,
        name: row.businessName,
        planType: planType,
        subscriptionStatus: 'active',
      }
    });

    let taskCount = 0;

    if (isWebsiteOnly) {
      // Create manual "Website Build" task for Blue Ribbon
      await prisma.task.create({
        data: {
          projectId: project.id,
          title: 'Website Build',
          status: 'todo',
          priority: 'medium',
        }
      });
      taskCount = 1;
      console.log(`CREATE: "${row.businessName}" - no package, 1 manual task (Website Build)`);
    } else if (planType) {
      // Generate onboarding tasks from TemplateSets
      const { totalTasksCreated } = await applyNewProjectTemplates(project.id, planType);
      taskCount = totalTasksCreated;
      console.log(`CREATE: "${row.businessName}" - ${planType}, ${taskCount} tasks generated`);
    } else {
      console.log(`CREATE: "${row.businessName}" - unknown package "${row.package}", no tasks`);
    }

    created++;
    totalTasks += taskCount;
  }

  console.log('\n--- SUMMARY ---');
  console.log(`Created: ${created} clients/projects`);
  console.log(`Skipped: ${skipped} (already existed)`);
  console.log(`Total tasks generated: ${totalTasks}`);
}

importClients()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
