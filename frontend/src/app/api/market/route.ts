// src/app/api/market/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base, localhost } from "viem/chains";
import { VYBE_CONTRACT_ABI, VYBE_CONTRACT_ADDRESS } from "@/lib/contract";

const client = createPublicClient({
  chain: localhost, // or mainnet depending on your deploy
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

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
    string, // question
    string, // trackId
    bigint, // threshold
    bigint, // deadline
    boolean, // resolved
    boolean, // outcomeYes
    bigint, // yesPool
    bigint  // noPool
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
}