import 'dotenv/config';

import { PrismaClient, UserRole } from '@prisma/client';
import { z } from 'zod';

const seedEnvSchema = z.object({
  SEED_ADMIN_NAME: z.string().min(1),
  SEED_ADMIN_EMAIL: z.email(),
  SEED_ADMIN_PASSWORD_HASH: z.string().min(1),
});

const seedEnv = seedEnvSchema.parse(process.env);
const prisma = new PrismaClient();

const services = [
  {
    name: 'Hidráulica',
    slug: 'hidraulica',
    description: 'Instalações e pequenos reparos hidráulicos.',
    category: 'PLUMBING',
  },
  {
    name: 'Elétrica',
    slug: 'eletrica',
    description: 'Instalações e pequenos reparos elétricos.',
    category: 'ELECTRICAL',
  },
  {
    name: 'Montagem de móveis',
    slug: 'montagem-de-moveis',
    description: 'Montagem e desmontagem de móveis.',
    category: 'FURNITURE_ASSEMBLY',
  },
  {
    name: 'Fechaduras e portas',
    slug: 'fechaduras-e-portas',
    description: 'Instalação e manutenção de fechaduras e portas.',
    category: 'LOCKS_AND_DOORS',
  },
  {
    name: 'Pintura',
    slug: 'pintura',
    description: 'Serviços de pintura residencial.',
    category: 'PAINTING',
  },
  {
    name: 'Pequenos reparos',
    slug: 'pequenos-reparos',
    description: 'Manutenções e pequenos reparos residenciais.',
    category: 'MINOR_REPAIRS',
  },
] as const;

const serviceAreas = [
  { name: 'Taguatinga', slug: 'taguatinga' },
  { name: 'Riacho Fundo I', slug: 'riacho-fundo-i' },
  { name: 'Núcleo Bandeirante', slug: 'nucleo-bandeirante' },
  { name: 'Candangolândia', slug: 'candangolandia' },
  { name: 'Águas Claras', slug: 'aguas-claras' },
  { name: 'Guará', slug: 'guara' },
  { name: 'Asa Sul', slug: 'asa-sul' },
  { name: 'Asa Norte', slug: 'asa-norte' },
  { name: 'Cruzeiro', slug: 'cruzeiro' },
  { name: 'Sudoeste', slug: 'sudoeste' },
  { name: 'Noroeste', slug: 'noroeste' },
  { name: 'Octogonal', slug: 'octogonal' },
  { name: 'Lago Sul', slug: 'lago-sul' },
  { name: 'Lago Norte', slug: 'lago-norte' },
] as const;

async function seed(): Promise<void> {
  await prisma.user.upsert({
    where: { email: seedEnv.SEED_ADMIN_EMAIL },
    update: {
      name: seedEnv.SEED_ADMIN_NAME,
      passwordHash: seedEnv.SEED_ADMIN_PASSWORD_HASH,
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      name: seedEnv.SEED_ADMIN_NAME,
      email: seedEnv.SEED_ADMIN_EMAIL,
      passwordHash: seedEnv.SEED_ADMIN_PASSWORD_HASH,
      role: UserRole.ADMIN,
    },
  });

  await Promise.all(
    services.map(async (service) => {
      await prisma.service.upsert({
        where: { slug: service.slug },
        update: service,
        create: service,
      });
    }),
  );

  await Promise.all(
    serviceAreas.map(async (serviceArea) => {
      await prisma.serviceArea.upsert({
        where: { slug: serviceArea.slug },
        update: serviceArea,
        create: serviceArea,
      });
    }),
  );
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
