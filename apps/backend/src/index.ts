import { env } from './config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { connectRedis, disconnectRedis } from './config/redis';
import { connectDatabase, disconnectDatabase } from './config/prisma';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import orderRoutes from './routes/order.routes';
import vehicleRoutes from './routes/vehicle.routes';
import categoryRoutes from './routes/category.routes';
import warehouseRoutes from './routes/warehouse.routes';
import adminRoutes from './routes/admin.routes';
import inventoryRoutes from './routes/inventory.routes';
import supplierRoutes from './routes/supplier.routes';
import poRoutes from './routes/po.routes';
import customerRoutes from './routes/customer.routes';
import vendorRoutes from './routes/vendor.routes';
import riderRoutes from './routes/rider.routes';
import serviceRoutes from './routes/service.routes';
import technicianRoutes from './routes/technician.routes';
import bannerRoutes from './routes/banner.routes';
import homeRoutes from './routes/home.routes';
import offerRoutes from './routes/offer.routes';
import couponRoutes from './routes/coupon.routes';
import uploadRoutes from './routes/upload.routes';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import fs from 'fs';

const app = express();

// Behind Vercel's proxy the client IP arrives via X-Forwarded-For; without
// this, express-rate-limit rejects the header and rate-limits all traffic
// as a single client.
app.set('trust proxy', 1);

// Middlewares
app.use(compression());
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Generous limit on the public API surface; auth routes get a tighter limit
// below since brute-forcing login/OTP is the more sensitive target.
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Health/readiness -- checked by orchestrators and by this project's own dev
// tooling to distinguish "server not started" from "server started, DB down".
// Mounted both at the root and under /api so external monitors that only know
// the public API prefix (and the mobile apps' connectivity check) can use
// /api/health and /api/status too.
app.use(healthRoutes);
app.use('/api', healthRoutes);

// Swagger Setup
let swaggerPath = path.join(__dirname, 'swagger.yaml');
if (!fs.existsSync(swaggerPath)) {
  swaggerPath = path.join(__dirname, '../src/swagger.yaml');
}
const swaggerDocument = YAML.load(swaggerPath);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/api/vendors', vendorRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', poRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/riders', riderRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/upload', uploadRoutes);

// Serve static files from uploads directory
// These are public product/category images meant to be displayed by other
// origins (admin/vendor dashboards, the customer web build), so relax CORP
// only for this route rather than for the whole API.
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(process.cwd(), 'uploads'))
);

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to MechBazar API' });
});

app.use(notFoundHandler);
app.use(errorHandler);

// Vercel's Node runtime imports `app` and calls it directly as a request
// handler (see api/index.ts) -- it never runs this file as a long-lived
// process, so binding a port or blocking on DB connectivity here would just
// leak a listener/delay that's never reached. Docker/local dev still needs
// the real listen() + startup sequence below.
if (!env.IS_VERCEL) {
  startServer();
}

async function startServer() {
  console.log(`[startup] Starting MechBazar backend (${env.NODE_ENV})...`);

  await connectDatabase();
  await connectRedis();

  const server = app
    .listen(env.PORT, '0.0.0.0', () => {
      console.log(`[startup] Server is running on port ${env.PORT} across all interfaces`);
    })
    .on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          `\n[FATAL] Port ${env.PORT} is already in use.\n` +
            `Another backend instance (or another app) is already listening on this port.\n` +
            `Stop that process, or set PORT to a different value in apps/backend/.env.\n`
        );
      } else {
        console.error('[FATAL] Failed to start server:', err);
      }
      process.exit(1);
    });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[shutdown] Received ${signal}, shutting down gracefully...`);

    server.close(() => console.log('[shutdown] HTTP server closed'));
    await disconnectDatabase();
    await disconnectRedis();

    console.log('[shutdown] Cleanup complete, exiting');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    console.error('[error] Unhandled promise rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[error] Uncaught exception:', err);
  });
}

export default app;
