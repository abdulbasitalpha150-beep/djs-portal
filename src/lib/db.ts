import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalAny = globalThis as unknown as { mongoose?: MongooseCache };

if (!globalAny.mongoose) {
  globalAny.mongoose = { conn: null, promise: null };
}

const cached = globalAny.mongoose;

export async function connectDb() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required in environment variables");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGO_URI, {
      dbName: "freight-agent-portal",
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}
