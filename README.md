# airhodl

**Prerequisites:**
- node 10.16.0
- npm 6.9.0
- python 3.7.3

**NodeJS Infrastructure:**
- Use `npm install` in order to install all required packages
- Use `npm test` in order to run truffle-test or solidity-coverage
- You can use `npm run build` in order to generate all artifacts (`abi` and `bin` files)
- All required artifacts are already stored in this repository (under `/solidity/build`)

**System Verification:**
- Use `npm test 1` (quick testing)
- Use `npm test 2` (full coverage)

**Vesting Simulation:**
- Use `python ./solidity/python/Simulator.py`
- Change `./solidity/python/Example.json` as needed
