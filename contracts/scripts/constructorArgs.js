require("dotenv/config");

const { ORACLE_ADDRESS } = process.env;

if (!ORACLE_ADDRESS) {
    throw new Error(
        "Set ORACLE_ADDRESS in your environment before running a verification command."
    );
}

module.exports = [ORACLE_ADDRESS];
