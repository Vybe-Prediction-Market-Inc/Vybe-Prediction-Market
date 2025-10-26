import assert from "assert";
import { 
  TestHelpers,
  VybePredictionMarket_BetPlaced
} from "generated";
const { MockDb, VybePredictionMarket } = TestHelpers;

describe("VybePredictionMarket contract BetPlaced event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for VybePredictionMarket contract BetPlaced event
  const event = VybePredictionMarket.BetPlaced.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */});

  it("VybePredictionMarket_BetPlaced is created correctly", async () => {
    // Processing the event
    const mockDbUpdated = await VybePredictionMarket.BetPlaced.processEvent({
      event,
      mockDb,
    });

    // Getting the actual entity from the mock database
    let actualVybePredictionMarketBetPlaced = mockDbUpdated.entities.VybePredictionMarket_BetPlaced.get(
      `${event.chainId}_${event.block.number}_${event.logIndex}`
    );

    // Creating the expected entity
    const expectedVybePredictionMarketBetPlaced: VybePredictionMarket_BetPlaced = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      marketId: event.params.marketId,
      user: event.params.user,
      yes: event.params.yes,
      amount: event.params.amount,
    };
    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(actualVybePredictionMarketBetPlaced, expectedVybePredictionMarketBetPlaced, "Actual VybePredictionMarketBetPlaced should be the same as the expectedVybePredictionMarketBetPlaced");
  });
});
