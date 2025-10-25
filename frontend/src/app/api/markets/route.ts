import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base, baseSepolia, localhost, sepolia } from "viem/chains";
import {
  VYBE_CONTRACT_ABI,
  discoverVybeContractsFromDeployers,
  type MarketSummary,
} from "@/lib/contract";

type CachedMarkets = {
  fetchedAt: number;
  source: "envio" | "rpc";
  markets: MarketSummary[];
};

const CACHE_KEY = "__vybeMarketsCache";
const DEFAULT_CACHE_MS = 15_000;
const DEFAULT_SCAN_BLOCKS = 2_000;

const CACHE_TTL =
  Number(process.env.VYBE_MARKET_CACHE_MS) ||
  Number(process.env.NEXT_PUBLIC_VYBE_MARKET_CACHE_MS) ||
  DEFAULT_CACHE_MS;

const ENVIO_ENDPOINT =
  process.env.VYBE_ENVIO_URL || process.env.NEXT_PUBLIC_ENVIO_URL;

const MARKET_LIMIT =
  Number(process.env.VYBE_ENVIO_MARKET_LIMIT) ||
  Number(process.env.NEXT_PUBLIC_ENVIO_MARKET_LIMIT) ||
  200;

function serializeMarkets(markets: MarketSummary[]) {
  return markets.map((market) => ({
    ...market,
    yesPool: market.yesPool.toString(),
    noPool: market.noPool.toString(),
  }));
}

function getCache(): CachedMarkets | null {
  return (globalThis as any)[CACHE_KEY] ?? null;
}

function setCache(payload: CachedMarkets) {
  (globalThis as any)[CACHE_KEY] = payload;
}

function resolveChain() {
  const envId = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
  if (envId === localhost.id) return localhost;
  if (envId === base.id) return base;
  if (envId === baseSepolia.id) return baseSepolia;
  if (envId === sepolia.id) return sepolia;
  if (envId && Number.isFinite(envId)) return { ...baseSepolia, id: envId };
  return localhost;
}

async function fetchFromEnvio(): Promise<MarketSummary[] | null> {
  if (!ENVIO_ENDPOINT) return null;

  const query = `
    query Markets($limit: Int!) {
      markets(orderBy: BLOCK_NUMBER_DESC, limit: $limit) {
        id
        contractAddress
        question
        trackId
        threshold
        deadline
        resolved
        outcomeYes
        yesPool
        noPool
      }
    }
  `;

  const res = await fetch(ENVIO_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { limit: MARKET_LIMIT } }),
  });

  if (!res.ok) throw new Error(`Envio responded with status ${res.status}`);
  const body = await res.json();
  if (body.errors) {
    const msg = body.errors
      .map((err: { message?: string }) => err.message)
      .filter(Boolean)
      .join("; ");
    throw new Error(msg || "Envio GraphQL error");
  }

  const rows = body.data?.markets;
  if (!rows || !Array.isArray(rows)) return [];

  return rows.map((row: any, index: number) => ({
    contractAddress: row.contractAddress as `0x${string}`,
    marketId: Number(row.id ?? index + 1),
    question: row.question ?? "",
    trackId: row.trackId ?? "",
    threshold: Number(row.threshold ?? 0),
    deadline: Number(row.deadline ?? 0),
    resolved: Boolean(row.resolved),
    outcomeYes: Boolean(row.outcomeYes),
    yesPool: BigInt(row.yesPool ?? 0),
    noPool: BigInt(row.noPool ?? 0),
  }));
}

async function fetchFromRpc(): Promise<MarketSummary[]> {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpcUrl) throw new Error("NEXT_PUBLIC_RPC_URL not configured");

  const client = createPublicClient({
    chain: resolveChain(),
    transport: http(rpcUrl),
  });

  const startBlock =
    process.env.NEXT_PUBLIC_SCAN_START_BLOCK &&
    process.env.NEXT_PUBLIC_SCAN_START_BLOCK.trim().length > 0
      ? BigInt(process.env.NEXT_PUBLIC_SCAN_START_BLOCK.trim())
      : undefined;
  const maxBlocks =
    process.env.NEXT_PUBLIC_SCAN_BLOCKS &&
    process.env.NEXT_PUBLIC_SCAN_BLOCKS.trim().length > 0
      ? Number(process.env.NEXT_PUBLIC_SCAN_BLOCKS)
      : DEFAULT_SCAN_BLOCKS;

  const addresses = await discoverVybeContractsFromDeployers(client, {
    startBlock,
    maxBlocks,
  });

  const all: MarketSummary[] = [];
  for (const addr of addresses) {
    const bytecode = await client.getBytecode({ address: addr });
    if (!bytecode || bytecode === "0x") continue;

    const count = (await client.readContract({
      address: addr,
      abi: VYBE_CONTRACT_ABI,
      functionName: "marketCount",
      args: [],
    })) as bigint;
    const total = Number(count);
    if (total === 0) continue;

    const contracts = Array.from({ length: total }, (_, i) => ({
      address: addr,
      abi: VYBE_CONTRACT_ABI,
      functionName: "getMarket" as const,
      args: [BigInt(i + 1)],
    }));

    const results = await client.multicall({ contracts, allowFailure: true });
    results.forEach((entry, index) => {
      if (entry.status !== "success" || !entry.result) return;
      const [
        question,
        trackId,
        threshold,
        deadline,
        resolved,
        outcomeYes,
        yesPool,
        noPool,
      ] = entry.result as [
        string,
        string,
        bigint,
        bigint,
        boolean,
        boolean,
        bigint,
        bigint
      ];

      all.push({
        contractAddress: addr,
        marketId: index + 1,
        question,
        trackId,
        threshold: Number(threshold),
        deadline: Number(deadline),
        resolved,
        outcomeYes,
        yesPool,
        noPool,
      });
    });
  }

  return all;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "1";
  const cache = getCache();

  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({
      fromCache: true,
      source: cache.source,
      markets: serializeMarkets(cache.markets),
    });
  }

  try {
    let source: CachedMarkets["source"] = "envio";
    let markets = await fetchFromEnvio();

    if (!markets || markets.length === 0) {
      source = "rpc";
      markets = await fetchFromRpc();
    }

    const payload: CachedMarkets = {
      fetchedAt: Date.now(),
      source,
      markets: markets ?? [],
    };
    setCache(payload);

    return NextResponse.json({
      fromCache: false,
      source,
      markets: serializeMarkets(payload.markets),
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to load markets" },
      { status: 500 },
    );
  }
}
