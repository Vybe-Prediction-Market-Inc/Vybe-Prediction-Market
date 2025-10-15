// src/app/api/market/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { localhost } from "viem/chains";
import { VYBE_CONTRACT_ABI, VYBE_CONTRACT_ADDRESS } from "@/lib/contract";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idStr = searchParams.get("id");
    const id = Number(idStr);
    if (!idStr || Number.isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "Missing or invalid 'id' query param" }, { status: 400 });
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json({ error: "NEXT_PUBLIC_RPC_URL is not set" }, { status: 500 });
    }
    if (!VYBE_CONTRACT_ADDRESS) {
      return NextResponse.json({ error: "NEXT_PUBLIC_MARKET_ADDRESS is not set" }, { status: 500 });
    }

    // Create client on-demand to avoid module-level crashes when envs are missing
    const client = createPublicClient({
      chain: localhost,
      transport: http(rpcUrl),
    });

    const [
      question,
      trackId,
      threshold,
      deadline,
      resolved,
      outcomeYes,
      yesPool,
      noPool,
    ] = await client.readContract({
      address: VYBE_CONTRACT_ADDRESS,
      abi: VYBE_CONTRACT_ABI,
      functionName: "getMarket",
      args: [BigInt(id)],
    }) as [
      string,
      string,
      bigint,
      bigint,
      boolean,
      boolean,
      bigint,
      bigint
    ];

    return NextResponse.json({
      id,
      question,
      trackId,
      threshold: Number(threshold),
      deadline: Number(deadline),
      resolved,
      outcomeYes,
      yesPool: Number(yesPool),
      noPool: Number(noPool),
    });
  } catch (err: any) {
    console.error("/api/market error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}