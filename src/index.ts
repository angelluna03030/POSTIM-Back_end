// src/index.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from './config';
// src/config/index.ts

// ─── Cargar variables de entorno ────────────────────────────────────────────
dotenv.config();

// ─── Validación de variables críticas ───────────────────────────────────────
const requiredEnvVars = ['MONGO_URI', 'CLOUDINARY_URL', 'PORT'];
requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Variable de entorno requerida no encontrada: ${key}`);
    process.exit(1);
  }
});

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Inicializar Express ─────────────────────────────────────────────────────
const app: Application = express();

// ─── Middlewares de seguridad ────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Middlewares de parseo ───────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rutas ───────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ message: 'Bienvenido a la API de POSTIM 🚀' });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ status: 'error', message: 'Ruta no encontrada' });
});

// ─── Error Handler global ────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`🔴 Error no controlado: ${err.message}`);
  res.status(500).json({
    status: 'error',
    message: NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
  });
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────
const bootstrap = async (): Promise<void> => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log('');
      console.log('🚀 Servidor iniciado correctamente');
      console.log(`   Entorno  : ${NODE_ENV}`);
      console.log(`   URL      : http://localhost:${PORT}`);
      console.log(`   Health   : http://localhost:${PORT}/health`);
      console.log('');
    });

    // Cierre limpio del servidor HTTP
    const shutdown = async (signal: string) => {
      console.log(`\n⚠️  Señal ${signal} recibida. Cerrando servidor...`);
      server.close(async () => {
        await disconnectDB();
        console.log('👋 Servidor cerrado correctamente');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error al iniciar la aplicación: ${msg}`);
    process.exit(1);
  }
};

bootstrap();