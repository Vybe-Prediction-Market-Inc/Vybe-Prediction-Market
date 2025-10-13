const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("VybePredictionMarket", (m) => {
    // For local testing, set oracle to the deployer address
    const oracle = m.getAccount(0);
    const vybe = m.contract("VybePredictionMarket", [oracle]);
    return { vybe };
});
