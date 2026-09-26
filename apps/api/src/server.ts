import { buildApp } from "./app.ts";
import { createDb } from "./db/client.ts";

const db = await createDb();
const app = await buildApp(db);
await app.listen({ port: Number(process.env.PORT ?? 4000), host: "0.0.0.0" });
