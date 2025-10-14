import { Abi } from "viem";

export const VYBE_CONTRACT_ADDRESS = process.env
  .NEXT_PUBLIC_MARKET_ADDRESS as `0x${string}`;

export const VYBE_CONTRACT_ABI: Abi = [
  {
    type: "function",
    name: "marketCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
  type: "function",
  name: "buyYes",
  stateMutability: "payable",
  inputs: [{ name: "marketId", type: "uint256" }],
  outputs: [],
  },
  {
  type: "function",
  name: "buyNo",
  stateMutability: "payable",
  inputs: [{ name: "marketId", type: "uint256" }],
  outputs: [],
  },
  {
  type: "function",
  name: "getUserBets",
  stateMutability: "view",
  inputs: [{ name: "_user", type: "address" }],
  outputs: [
    {
      components: [
        { name: "marketId", type: "uint256" },
        { name: "betYes", type: "bool" },
        { name: "amount", type: "uint256" },
        { name: "claimed", type: "bool" },
      ],
      type: "tuple[]",
    },
  ],
  },
  {
    type: "function",
    name: "getMarket",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      { name: "question", type: "string" },
      { name: "trackId", type: "string" },
      { name: "threshold", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "resolved", type: "bool" },
      { name: "outcomeYes", type: "bool" },
      { name: "yesPool", type: "uint256" },
      { name: "noPool", type: "uint256" },
    ],
  },
];
