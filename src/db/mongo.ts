import { Db, MongoClient } from "mongodb";
import { config } from "../config";

let cliente: MongoClient | null = null;

/** Devuelve la base de datos de MongoDB, reutilizando una única conexión. */
export async function conectarMongo(): Promise<Db> {
  if (!cliente) {
    cliente = new MongoClient(config.mongo.uri, { serverSelectionTimeoutMS: 5000 });
    try {
      await cliente.connect();
    } catch (e) {
      cliente = null;
      throw e;
    }
  }
  return cliente.db(config.mongo.db);
}

export async function cerrarMongo(): Promise<void> {
  await cliente?.close();
  cliente = null;
}
