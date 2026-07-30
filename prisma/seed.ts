import 'dotenv/config';

import { PrismaClient, UserRole } from '@prisma/client';
import argon2 from 'argon2';
import { z } from 'zod';

const seedEnvSchema = z.object({
  ADMIN_NAME: z.string().trim().min(1),
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(12),
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
  const passwordHash = await argon2.hash(seedEnv.ADMIN_PASSWORD, {
    type: argon2.argon2id,
  });

  await prisma.user.upsert({
    where: { email: seedEnv.ADMIN_EMAIL },
    update: {
      name: seedEnv.ADMIN_NAME,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      name: seedEnv.ADMIN_NAME,
      email: seedEnv.ADMIN_EMAIL,
      passwordHash,
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
