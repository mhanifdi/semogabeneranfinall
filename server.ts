/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Full-Stack Application Entry Point — VERTIKAL SMA JAWARA 28
 * Runs Express backend with API dispatcher and Vite middleware on port 3000 (0.0.0.0).
 */

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { JawaraApplication, mountJawaraRoutesOnExpress } from './server/src/app.ts';
import { seedDevelopmentDemoData, seedProductionAdmin } from './server/src/database/seed.ts';
import { env } from './server/src/config/env.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || env.port || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Initialize Jawara Application instance (runs database schema migrations)
  const jawaraApp = new JawaraApplication();

  // Run seed initialization
  try {
    if (env.allowDemoSeed) {
      seedDevelopmentDemoData(jawaraApp.db);
    } else {
      seedProductionAdmin(jawaraApp.db);
    }
  } catch (err) {
    console.warn('[SEED] Database seeding notice:', err);
  }

  // Mount API endpoints
  mountJawaraRoutesOnExpress(app, jawaraApp);

  if (!isProd) {
    // Development mode: Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve compiled assets
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.resolve(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Not Found');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[VERTIKAL JAWARA 28] Server listening at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[VERTIKAL JAWARA 28] Fatal server boot error:', err);
  process.exit(1);
});
