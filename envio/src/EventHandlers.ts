/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  VybePredictionMarket,
  VybePredictionMarket_BetPlaced,
  VybePredictionMarket_MarketCreated,
  VybePredictionMarket_Redeemed,
  VybePredictionMarket_Resolved,
} from "generated";

VybePredictionMarket.BetPlaced.handler(async ({ event, context }) => {
  const entity: VybePredictionMarket_BetPlaced = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    marketId: event.params.marketId,
    user: event.params.user,
    yes: event.params.yes,
    amount: event.params.amount,
  };

  context.VybePredictionMarket_BetPlaced.set(entity);
});

VybePredictionMarket.MarketCreated.handler(async ({ event, context }) => {
  const entity: VybePredictionMarket_MarketCreated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    marketId: event.params.marketId,
    question: event.params.question,
    trackId: event.params.trackId,
    threshold: event.params.threshold,
    deadline: event.params.deadline,
  };

  context.VybePredictionMarket_MarketCreated.set(entity);
});

VybePredictionMarket.Redeemed.handler(async ({ event, context }) => {
  const entity: VybePredictionMarket_Redeemed = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    marketId: event.params.marketId,
    user: event.params.user,
    payout: event.params.payout,
  };

  context.VybePredictionMarket_Redeemed.set(entity);
});

VybePredictionMarket.Resolved.handler(async ({ event, context }) => {
  const entity: VybePredictionMarket_Resolved = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    marketId: event.params.marketId,
    outcomeYes: event.params.outcomeYes,
    yesPool: event.params.yesPool,
    noPool: event.params.noPool,
  };

  context.VybePredictionMarket_Resolved.set(entity);
});
