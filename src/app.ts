import fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';
import cors from '@fastify/cors';

import { env } from './config/env.js';
import {
  type AuthRepository,
  PrismaAuthRepository,
} from './modules/auth/auth.repository.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import {
  type AppointmentRepository,
  PrismaAppointmentRepository,
} from './modules/appointments/appointments.repository.js';
import { registerAppointmentsRoutes } from './modules/appointments/appointments.routes.js';
import {
  type FinanceRepository,
  PrismaFinanceRepository,
} from './modules/finance/finance.repository.js';
import { registerFinanceRoutes } from './modules/finance/finance.routes.js';
import {
  type CustomerRepository,
  PrismaCustomerRepository,
} from './modules/customers/customers.repository.js';
import { registerCustomersRoutes } from './modules/customers/customers.routes.js';
import {
  PrismaServiceRepository,
  type ServiceRepository,
} from './modules/services/services.repository.js';
import { registerServicesRoutes } from './modules/services/services.routes.js';
import {
  PrismaServiceRequestRepository,
  type ServiceRequestRepository,
} from './modules/service-requests/service-requests.repository.js';
import { registerServiceRequestsRoutes } from './modules/service-requests/service-requests.routes.js';
import {
  PrismaServiceRequestTimelineRepository,
  type ServiceRequestTimelineRepository,
} from './modules/service-request-timeline/service-request-timeline.repository.js';
import { registerServiceRequestTimelineRoutes } from './modules/service-request-timeline/service-request-timeline.routes.js';
import {
  PrismaUserRepository,
  type UserRepository,
} from './modules/users/users.repository.js';
import { registerUsersRoutes } from './modules/users/users.routes.js';
import { PrismaNotificationRepository, type NotificationRepository } from './modules/notifications/notifications.repository.js';
import { registerNotificationsRoutes } from './modules/notifications/notifications.routes.js';
import { registerJwt } from './shared/auth/jwt.js';
import {
  checkDatabaseReadiness,
  type DatabaseReadinessCheck,
  registerDatabaseLifecycle,
} from './shared/database/index.js';
import { registerErrorHandlers } from './shared/errors/error-handler.js';

interface BuildAppOptions extends FastifyServerOptions {
  authRepository?: AuthRepository;
  customerRepository?: CustomerRepository;
  serviceRepository?: ServiceRepository;
  serviceRequestRepository?: ServiceRequestRepository;
  serviceRequestTimelineRepository?: ServiceRequestTimelineRepository;
  appointmentRepository?: AppointmentRepository;
  financeRepository?: FinanceRepository;
  userRepository?: UserRepository;
  notificationRepository?: NotificationRepository;
  databaseReadinessCheck?: DatabaseReadinessCheck;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const {
    authRepository = new PrismaAuthRepository(),
    customerRepository = new PrismaCustomerRepository(),
    serviceRepository = new PrismaServiceRepository(),
    serviceRequestRepository = new PrismaServiceRequestRepository(),
    serviceRequestTimelineRepository = new PrismaServiceRequestTimelineRepository(),
    appointmentRepository = new PrismaAppointmentRepository(),
    financeRepository = new PrismaFinanceRepository(),
    userRepository = new PrismaUserRepository(),
    notificationRepository = new PrismaNotificationRepository(),
    databaseReadinessCheck = checkDatabaseReadiness,
    ...serverOptions
  } = options;
  const app = fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
    ...serverOptions,
  });

  const allowedOrigins = new Set(env.CORS_ORIGINS);

  app.register(cors, {
    origin(origin, callback) {
      callback(null, origin === undefined || allowedOrigins.has(origin));
    },
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  registerJwt(app);
  registerDatabaseLifecycle(app);
  registerErrorHandlers(app);
  registerAuthRoutes(app, authRepository);
  registerServicesRoutes(app, serviceRepository);
  registerCustomersRoutes(app, customerRepository);
  registerServiceRequestsRoutes(app, serviceRequestRepository);
  registerServiceRequestTimelineRoutes(app, serviceRequestTimelineRepository);
  registerAppointmentsRoutes(app, appointmentRepository);
  registerFinanceRoutes(app, financeRepository);
  registerUsersRoutes(app, userRepository);
  registerNotificationsRoutes(app, notificationRepository);

  app.get('/health', () => {
    return {
      status: 'ok',
    };
  });

  app.get('/ready', async (request, reply) => {
    try {
      await databaseReadinessCheck();
      return {
        status: 'ready',
      };
    } catch (error) {
      request.log.error({ err: error }, 'Database readiness check failed');
      return reply.status(503).send({
        status: 'not_ready',
      });
    }
  });

  return app;
}
