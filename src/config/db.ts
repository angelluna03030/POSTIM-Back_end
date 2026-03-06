// src/config/db.ts
import mongoose from 'mongoose';


const mongooseOptions: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
};

const connectWithRetry = async (retries = 5, delay = 5000): Promise<void> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const MONGO_URI = process.env.MONGO_URI; // 👈 Mover aquí
    try {
     
      if (!MONGO_URI) {
        throw new Error('MONGO_URI no está definida en las variables de entorno');
      }
 
      const conn = await mongoose.connect(MONGO_URI, mongooseOptions);
    
      console.log('✅ MongoDB conectado exitosamente');
      console.log(`   Base de datos: ${conn.connection.name}`);
      return;
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`❌ Error al conectar a MongoDB (intento ${attempt}/${retries}): ${errorMessage}`);
           console.log( "Varialbe de entro " + process.env.MONGO_URI)
      if (isLastAttempt) {
        console.error('🔴 Se agotaron los intentos de conexión. Cerrando aplicación...');

        process.exit(1);
      }

      console.log(`🔄 Reintentando en ${delay / 1000} segundos...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export const connectDB = async (): Promise<void> => {
  mongoose.connection.on('connected', () => console.log('📡 Mongoose: conexión establecida'));
  mongoose.connection.on('disconnected', () => console.warn('⚠️  Mongoose: conexión perdida'));
  mongoose.connection.on('reconnected', () => console.log('🔁 Mongoose: reconectado'));
  mongoose.connection.on('error', (err) => console.error(`🔴 Mongoose error: ${err.message}`));

  await connectWithRetry();
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('🔌 MongoDB desconectado correctamente');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error al desconectar MongoDB: ${errorMessage}`);
  }
};

// Cierre limpio al terminar el proceso
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDB();
  process.exit(0);
});