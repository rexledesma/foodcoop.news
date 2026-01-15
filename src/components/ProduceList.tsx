"use client";

import { useState, useEffect, useMemo } from "react";
import type { Produce } from "@/lib/types";

export function ProduceList() {
  const [produce, setProduce] = useState<Produce[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [organicOnly, setOrganicOnly] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchProduce();
  }, []);

  const fetchProduce = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/produce");
      const data = await response.json();

      if (response.ok) {
        setProduce(data.produce);
        setLastUpdated(data.lastUpdated);
      } else {
        setError(data.error || "Failed to load produce");
      }
    } catch {
      setError("Failed to load produce data");
    } finally {
      setLoading(false);
    }
  };

  const filteredProduce = useMemo(() => {
    let filtered = produce;

    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerSearch) ||
          p.origin.toLowerCase().includes(lowerSearch)
      );
    }

    if (organicOnly) {
      filtered = filtered.filter((p) => p.organic);
    }

    return filtered;
  }, [produce, search, organicOnly]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
        {error}
        <button
          onClick={fetchProduce}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="sticky top-0 bg-zinc-50 dark:bg-zinc-950 pt-2 pb-4 space-y-3 z-10">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search produce..."
            className="w-full px-4 py-3 pl-10 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path strokeLinecap="round" strokeWidth="2" d="M21 21l-4.35-4.35" />
          </svg>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={organicOnly}
              onChange={(e) => setOrganicOnly(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Organic only
            </span>
          </label>

          <span className="text-xs text-zinc-400">
            {filteredProduce.length} items
          </span>
        </div>
      </div>

      {/* Produce Grid */}
      <div className="grid gap-3">
        {filteredProduce.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {item.name}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {item.origin}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {item.organic && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      Organic
                    </span>
                  )}
                  {item.growingPractice &&
                    item.growingPractice !== "Organic" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                        {item.growingPractice}
                      </span>
                    )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                  {item.price}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {item.priceUnit}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProduce.length === 0 && (
        <p className="text-center text-zinc-500 dark:text-zinc-400 py-8">
          No produce found matching your search.
        </p>
      )}

      {lastUpdated && (
        <p className="text-center text-xs text-zinc-400 pt-4">
          Last updated: {new Date(lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
