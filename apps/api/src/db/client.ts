import { mkdirSync } from "node:fs";
import { migrations } from "./migrations.ts";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

/** Uses Postgres when DATABASE_URL is set. Otherwise it runs PGlite in-process, so local dev needs no database server. */
export async function createDb(url = process.env.DATABASE_URL): Promise<Db> {
  let db: Db;
  if (url) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: url });
    db = {
      query: async (sql, params) => (await pool.query(sql, params)).rows,
      close: () => pool.end(),
    };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = process.env.PGLITE_DIR; // undefined = in-memory
    if (dir) mkdirSync(dir, { recursive: true });
    const lite = new PGlite(dir);
    db = {
      query: async <T,>(sql: string, params?: unknown[]) =>
        params?.length ? (await lite.query<T>(sql, params)).rows : ((await lite.exec(sql)).at(-1)?.rows as T[]) ?? [],
      close: () => lite.close(),
    };
  }
  await migrate(db);
  return db;
}

async function migrate(db: Db) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const applied = new Set((await db.query<{ version: number }>(`SELECT version FROM schema_migrations`)).map((r) => r.version));
  for (const [i, sql] of migrations.entries()) {
    if (applied.has(i)) continue;
    await db.query(`BEGIN; ${sql}; INSERT INTO schema_migrations (version) VALUES (${i}); COMMIT;`);
  }
}
