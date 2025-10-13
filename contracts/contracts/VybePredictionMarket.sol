// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Vybe Prediction Market (Parimutuel prototype)
/// @notice Simple binary prediction markets funded in ETH. Users buy YES/NO shares before a deadline.
/// After resolution by a designated oracle, winners redeem a pro-rata share of the total pot.
contract VybePredictionMarket is Ownable, ReentrancyGuard {
    struct Market {
        // Metadata
        string question; // Human-readable text
        string trackId;  // Spotify Track ID used by oracle
        uint256 threshold; // Popularity threshold (0-100 for Spotify popularity)
        uint256 deadline;  // Timestamp after which trading is closed

        // State
        bool resolved;
        bool outcomeYes; // true if observed >= threshold

        // Pools and accounting
        uint256 yesPool; // Total ETH on YES side
        uint256 noPool;  // Total ETH on NO side

        // Per-user shares
        mapping(address => uint256) yesShares;
        mapping(address => uint256) noShares;
    }

    // Admins
    address public oracle; // Account allowed to resolve markets

    // Markets
    uint256 public marketCount;
    mapping(uint256 => Market) private markets;

    // Events
    event MarketCreated(
        uint256 indexed marketId,
        string question,
        string trackId,
        uint256 threshold,
        uint256 deadline
    );
    event BetPlaced(uint256 indexed marketId, address indexed user, bool yes, uint256 amount);
    event Resolved(uint256 indexed marketId, bool outcomeYes, uint256 yesPool, uint256 noPool);
    event Redeemed(uint256 indexed marketId, address indexed user, uint256 payout);

    modifier onlyOracle() {
        require(msg.sender == oracle, "not oracle");
        _;
    }

    constructor(address _oracle) Ownable(msg.sender) {
        oracle = _oracle;
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    // Create a new market. Returns the marketId.
    function createMarket(
        string calldata question,
        string calldata trackId,
        uint256 threshold,
        uint256 deadline
    ) external onlyOwner returns (uint256 marketId) {
        require(bytes(question).length > 0, "empty question");
        require(bytes(trackId).length > 0, "empty trackId");
        require(threshold <= 100, "threshold > 100");
        require(deadline > block.timestamp, "deadline in past");

        marketId = ++marketCount;
        Market storage m = markets[marketId];
        m.question = question;
        m.trackId = trackId;
        m.threshold = threshold;
        m.deadline = deadline;

        emit MarketCreated(marketId, question, trackId, threshold, deadline);
    }

    // Place a YES bet by sending ETH.
    function buyYes(uint256 marketId) external payable {
        _buy(marketId, true);
    }

    // Place a NO bet by sending ETH.
    function buyNo(uint256 marketId) external payable {
        _buy(marketId, false);
    }

    function _buy(uint256 marketId, bool yes) internal {
        require(marketId > 0 && marketId <= marketCount, "invalid market");
        Market storage m = markets[marketId];
        require(!m.resolved, "resolved");
        require(block.timestamp < m.deadline, "trading closed");
        require(msg.value > 0, "no value");

        if (yes) {
            m.yesPool += msg.value;
            m.yesShares[msg.sender] += msg.value; // shares = ETH amount (parimutuel)
        } else {
            m.noPool += msg.value;
            m.noShares[msg.sender] += msg.value;
        }
        emit BetPlaced(marketId, msg.sender, yes, msg.value);
    }

    // Oracle resolves with an observed value (0-100). Outcome YES if observed >= threshold
    function resolveMarket(uint256 marketId, uint256 observed) external onlyOracle {
        require(marketId > 0 && marketId <= marketCount, "invalid market");
        require(observed <= 100, "observed > 100");
        Market storage m = markets[marketId];
        require(!m.resolved, "already resolved");
        require(block.timestamp >= m.deadline, "before deadline");

        m.resolved = true;
        m.outcomeYes = observed >= m.threshold;
        emit Resolved(marketId, m.outcomeYes, m.yesPool, m.noPool);
    }

    // Redeem winnings after resolution. Can be called once per user per market side (since it zeroes shares).
    function redeem(uint256 marketId) external nonReentrant {
        require(marketId > 0 && marketId <= marketCount, "invalid market");
        Market storage m = markets[marketId];
        require(m.resolved, "not resolved");

        uint256 payout;
        uint256 pot = m.yesPool + m.noPool;
        if (pot == 0) {
            // Nothing bet; nothing to payout.
            require(false, "no funds available for redemption");
        }

        if (m.outcomeYes) {
            uint256 user = m.yesShares[msg.sender];
            require(user > 0, "no winning shares");
            // Payout = user / yesPool * pot
            payout = (user * pot) / m.yesPool;
            m.yesShares[msg.sender] = 0;
        } else {
            uint256 user = m.noShares[msg.sender];
            require(user > 0, "no winning shares");
            payout = (user * pot) / m.noPool;
            m.noShares[msg.sender] = 0;
        }

        // Transfer payout
        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "transfer failed");
        emit Redeemed(marketId, msg.sender, payout);
    }

    // Views
    function getMarket(uint256 marketId)
        external
        view
        returns (
            string memory question,
            string memory trackId,
            uint256 threshold,
            uint256 deadline,
            bool resolved,
            bool outcomeYes,
            uint256 yesPool,
            uint256 noPool
        )
    {
        require(marketId > 0 && marketId <= marketCount, "invalid market");
        Market storage m = markets[marketId];
        return (
            m.question,
            m.trackId,
            m.threshold,
            m.deadline,
            m.resolved,
            m.outcomeYes,
            m.yesPool,
            m.noPool
        );
    }

    function getUserShares(uint256 marketId, address user) external view returns (uint256 yesShares, uint256 noShares) {
        require(marketId > 0 && marketId <= marketCount, "invalid market");
        Market storage m = markets[marketId];
        return (m.yesShares[user], m.noShares[user]);
    }

    receive() external payable {}
}
