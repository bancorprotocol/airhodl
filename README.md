# airhodl

**Prerequisites:**
- node 10.16.0
- npm 6.9.0

**NodeJS Infrastructure:**
- Use `npm install` in order to install all required packages
- Use `npm test` in order to run truffle-test or solidity-coverage
- You can use `npm run build` in order to generate all artifacts (`abi` and `bin` files)
- All required artifacts are already stored in this repository (under `/solidity/build`)

**System Verification:**
- Use `npm test 1` (quick testing)
- Use `npm test 2` (full coverage)

**Snapshot Execution:**
```bash
node ./solidity/scripts/snapshot/run.js
    Output file name (e.g. airdrop.txt)
    Token contract address (e.g. 0x1F573D6Fb3F13d689FF844B4cE37794d79a7FF1C)
    Vault contract address (e.g. 0xf1A5C3EDA198BD3eE097Ac4b8340E4d47C9D4679)
    Etherscan developer key
    Infura developer key
    Last block number
```

**Airdrop Execution:**
```bash
node ./solidity/scripts/airdrop/run.js
    Input file name (e.g. airdrop.txt)
    Configuration file name
    Ethereum node address
    Account private key
    Number of accounts per chunk
```

**Upgrade Execution:**
```bash
node ./solidity/scripts/upgrade/run.js
    Configuration file name
    Ethereum node address
    Account private key
    BNT amount
    BNT buffer
```

**Airdrop Configuration File Example:**
```json
{
    "params": [
        "Token",
        "TKN",
        18
    ]
}
```

**Upgrade Configuration File Example:**
```json
{
    "bntTokenParams": [
        "Bancor Network Token",
        "BNT",
        18
    ],
    "relayTokenParams": [
        "BNT/ETH Relay Token",
        "BRT",
        18
    ],
    "airHodlTokenParams": [
        "Bancor AirHodl Token",
        "BVT",
        18
    ],
    "vestingLength": 63072000
}
```
