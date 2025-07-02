const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
  errorFormat: 'minimal',
});

module.exports = { prisma };
