'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';

interface UseDuckDBResult {
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
  query: <T = Record<string, unknown>>(sql: string) => Promise<T[]>;
  loadParquet: (url: string, tableName: string) => Promise<void>;
}

export function useDuckDB(): UseDuckDBResult {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const dbRef = useRef<duckdb.AsyncDuckDB | null>(null);
  const connRef = useRef<duckdb.AsyncDuckDBConnection | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initDuckDB() {
      try {
        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

        const worker_url = URL.createObjectURL(
          new Blob([`importScripts("${bundle.mainWorker}");`], {
            type: 'text/javascript',
          }),
        );

        const worker = new Worker(worker_url);
        const logger = new duckdb.ConsoleLogger();
        const db = new duckdb.AsyncDuckDB(logger, worker);

        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(worker_url);

        if (cancelled) {
          await db.terminate();
          return;
        }

        const conn = await db.connect();

        dbRef.current = db;
        connRef.current = conn;
        setIsReady(true);
        setIsLoading(false);
      } catch (err) {
        console.error('[DuckDB] Error:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    }

    initDuckDB();

    return () => {
      cancelled = true;
      connRef.current?.close();
      dbRef.current?.terminate();
    };
  }, []);

  const query = useCallback(async <T = Record<string, unknown>>(sql: string): Promise<T[]> => {
    if (!connRef.current) {
      throw new Error('DuckDB not initialized');
    }

    const result = await connRef.current.query(sql);
    return result.toArray().map((row) => row.toJSON() as T);
  }, []);

  const loadParquet = useCallback(async (url: string, tableName: string): Promise<void> => {
    if (!dbRef.current || !connRef.current) {
      throw new Error('DuckDB not initialized');
    }

    await dbRef.current.registerFileURL(tableName, url, duckdb.DuckDBDataProtocol.HTTP, false);
    await connRef.current.query(`
        CREATE OR REPLACE TABLE ${tableName} AS
        SELECT * FROM parquet_scan('${tableName}')
      `);
  }, []);

  return { isReady, isLoading, error, query, loadParquet };
}
