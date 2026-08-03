import fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';

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
import { registerJwt } from './shared/auth/jwt.js';
import { registerDatabaseLifecycle } from './shared/database/index.js';
import { registerErrorHandlers } from './shared/errors/error-handler.js';

interface BuildAppOptions extends FastifyServerOptions {
  authRepository?: AuthRepository;
  customerRepository?: CustomerRepository;
  serviceRepository?: ServiceRepository;
  serviceRequestRepository?: ServiceRequestRepository;
  appointmentRepository?: AppointmentRepository;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const {
    authRepository = new PrismaAuthRepository(),
    customerRepository = new PrismaCustomerRepository(),
    serviceRepository = new PrismaServiceRepository(),
    serviceRequestRepository = new PrismaServiceRequestRepository(),
    appointmentRepository = new PrismaAppointmentRepository(),
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

  registerJwt(app);
  registerDatabaseLifecycle(app);
  registerErrorHandlers(app);
  registerAuthRoutes(app, authRepository);
  registerServicesRoutes(app, serviceRepository);
  registerCustomersRoutes(app, customerRepository);
  registerServiceRequestsRoutes(app, serviceRequestRepository);
  registerAppointmentsRoutes(app, appointmentRepository);

  app.get('/health', () => {
    return {
      status: 'ok',
    };
  });

  return app;
}
