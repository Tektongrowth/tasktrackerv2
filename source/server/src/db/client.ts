import { PrismaClient } from '@prisma/client';

// Configure Prisma client with connection retry and logging
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production'
    ? ['error', 'warn']
    : ['query', 'error', 'warn'],
});

// Handle connection errors gracefully
prisma.$connect()
  .then(() => {
    console.log('Database connected successfully');
  })
  .catch((error) => {
    console.error('Failed to connect to database:', error);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Handle unexpected disconnections
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
