type DuckDBModule = typeof import('@duckdb/duckdb-wasm/dist/duckdb-browser');

export class DuckDBClient {
  private duckdb: DuckDBModule | null = null;
  private db: InstanceType<DuckDBModule['AsyncDuckDB']> | null = null;
  private conn: Awaited<ReturnType<InstanceType<DuckDBModule['AsyncDuckDB']>['connect']>> | null =
    null;
  private workerObjectUrl: string | null = null;

  async init(): Promise<void> {
    if (this.conn) return;

    const duckdb = await import('@duckdb/duckdb-wasm/dist/duckdb-browser');
    this.duckdb = duckdb;
    const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());

    this.workerObjectUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }),
    );

    const worker = new Worker(this.workerObjectUrl);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    this.db = db;
    this.conn = await db.connect();
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    if (!this.conn) {
      throw new Error('DuckDB not initialized');
    }
    const result = await this.conn.query(sql);
    return result.toArray().map((row) => row.toJSON() as T);
  }

  async loadParquetBuffer(buffer: ArrayBuffer, tableName: string): Promise<void> {
    if (!this.db || !this.conn) {
      throw new Error('DuckDB not initialized');
    }

    await this.db.registerFileBuffer(tableName, new Uint8Array(buffer));
    await this.conn.query(`
      CREATE OR REPLACE TABLE ${tableName} AS
      SELECT * FROM parquet_scan('${tableName}')
    `);
  }

  async close(): Promise<void> {
    const closePromise = this.conn?.close();
    if (closePromise) {
      await closePromise.catch((err) => {
        console.error('[DuckDB] Error closing connection:', err);
      });
    }
    this.conn = null;

    const terminatePromise = this.db?.terminate();
    if (terminatePromise) {
      await terminatePromise.catch((err) => {
        console.error('[DuckDB] Error terminating database:', err);
      });
    }
    this.db = null;
    this.duckdb = null;

    if (this.workerObjectUrl) {
      URL.revokeObjectURL(this.workerObjectUrl);
      this.workerObjectUrl = null;
    }
  }
}
