import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base, baseSepolia, localhost, sepolia } from "viem/chains";
import {
  VYBE_CONTRACT_ABI,
  discoverVybeContractsFromDeployers,
} from "@/lib/contract";

type SerializedBet = {
  contractAddress: `0x${string}`;
  marketId: number;
  betYes: boolean;
  amount: string;
  claimed: boolean;
};

type CacheEntry = {
  fetchedAt: number;
  bets: SerializedBet[];
};

const CACHE_KEY = "__vybeUserBetCache";
const DEFAULT_CACHE_MS = 10_000;

const CACHE_TTL =
  Number(process.env.VYBE_USER_CACHE_MS) ||
  Number(process.env.NX_PUBLIC_VYBE_USER_CACHE_MS) || // backwards compat typo
  Number(process.env.NEXT_PUBLIC_VYBE_USER_CACHE_MS) ||
  DEFAULT_CACHE_MS;

function getUserCache(): Record<string, CacheEntry> {
  if (!(CACHE_KEY in globalThis)) {
    (globalThis as any)[CACHE_KEY] = {};
  }
  return (globalThis as any)[CACHE_KEY] as Record<string, CacheEntry>;
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

const client = createPublicClient({
  chain: resolveChain(),
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = searchParams.get("address")?.toLowerCase();
  if (!user || !user.startsWith("0x")) {
    return NextResponse.json(
      { error: "Missing or invalid ?address=0x..." },
      { status: 400 },
    );
  }

  const cacheKey = `${client.chain?.id ?? 0}-${user}`;
  const cache = getUserCache();
  const hit = cache[cacheKey];
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL) {
    return NextResponse.json({
      address: user,
      fromCache: true,
      bets: hit.bets,
    });
  }

  try {
    const addresses = await discoverVybeContractsFromDeployers(client as any);
    const slices = await Promise.all(
      addresses.map(async (addr) => {
        try {
          const rows = await client.readContract({
            address: addr,
            abi: VYBE_CONTRACT_ABI,
            functionName: "getUserBets",
            args: [user as `0x${string}`],
          });
          const bets = (rows as any[]).map((row) => ({
            contractAddress: addr,
            marketId: Number(row.marketId),
            betYes: Boolean(row.betYes),
            amount: BigInt(row.amount ?? 0).toString(),
            claimed: Boolean(row.claimed),
          })) as SerializedBet[];
          return bets;
        } catch {
          return [];
        }
      }),
    );

    const bets = slices.flat();
    cache[cacheKey] = { fetchedAt: Date.now(), bets };

    return NextResponse.json({
      address: user,
      fromCache: false,
      bets,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to load user bets" },
      { status: 500 },
    );
  }
}
