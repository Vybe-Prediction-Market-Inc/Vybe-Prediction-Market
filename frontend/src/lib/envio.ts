export type EnvioBet = {
  id: string;
  yes: boolean;
  amount: string; // wei string
  timestamp: number;
  redeemed: boolean;
  payout?: string | null; // wei string
  market: {
    id: string;
    question: string;
    resolved: boolean;
    outcomeYes: boolean | null;
    yesPool: string; // wei
    noPool: string;  // wei
  };
};

export type EnvioUser = {
  id: string;
  bets: EnvioBet[];
  totalVolume?: string | null; // wei
  pnl?: string | null;         // wei
  marketsParticipated?: number | null;
  wins?: number | null;
  losses?: number | null;
};

export async function fetchEnvioUser(address: string): Promise<EnvioUser | null> {
  const url = process.env.NEXT_PUBLIC_ENVIO_HYPERSYNC_URL;
  if (!url) return null;

  const query = `
    query User($id: ID!) {
      user(id: $id) {
        id
        totalVolume
        pnl
        marketsParticipated
        wins
        losses
        bets(first: 100, orderBy: timestamp, orderDirection: desc) {
          id
          yes
          amount
          timestamp
          redeemed
          payout
          market { id question resolved outcomeYes yesPool noPool }
        }
      }
    }
  `;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id: address.toLowerCase() } }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (json?.errors || !json?.data?.user) return null;
  return json.data.user as EnvioUser;
}
