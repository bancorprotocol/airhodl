const fs = require("fs");
const path = require("path");
const download = require("download-file");

try {
    fs.closeSync(fs.openSync("./node_modules/run-once", "wx"));
}
catch (error) {
    console.error("This script should not run more than once");
    process.exit();
}

function fix(fileName, tokens) {
    console.log("Fixing " + fileName);
    try {
        let data = fs.readFileSync(fileName, {encoding: "utf8"});
        for (const token of tokens)
            data = data.split(token.prev).join(token.next);
        fs.writeFileSync(fileName, data, {encoding: "utf8"});
    }
    catch (error) {
        console.log(error.message);
    }
}

fix("./node_modules/truffle/build/cli.bundled.js", [
    {prev: "request = new XHR2", next: "request = new XMLHttpRequest"},
    {prev: "error = errors.InvalidResponse", next: "error = payload.method === 'evm_revert' || payload.method === 'evm_snapshot' ? null : errors.InvalidResponse"},
    {prev: "display_path = \".\" + path.sep + path.relative(options.working_directory, import_path);", next: "if (options.fix_paths) {display_path = \".\" + path.sep + path.relative(options.working_directory, import_path); result[display_path] = result[import_path]; delete result[import_path];}"}]
);

fix("./node_modules/solidity-coverage/lib/app.js", [
    {prev: "events.push", next: "coverage.processEvent"}]
);

fix("./node_modules/solidity-coverage/lib/coverageMap.js", [
    {prev: "  generate(events, pathPrefix) {", next: "  processEvent(line) {"},
    {prev: "    for (let idx = 0; idx < events.length; idx++) {", next: ""},
    {prev: "      const event = JSON.parse(events[idx]);", next: "      const event = JSON.parse(line);"},
    {prev: "    // Finally, interpret the assert pre/post events", next: "  generate(events, pathPrefix) {"}]
);

const fileNames = [
    "solidity/build/BancorConverter.abi",
    "solidity/build/BancorConverter.bin",
    "solidity/build/ContractRegistry.abi",
    "solidity/build/ContractRegistry.bin",
    "solidity/build/EtherToken.abi",
    "solidity/build/EtherToken.bin",
    "solidity/build/IERC20Token.abi",
    "solidity/build/SmartToken.abi",
    "solidity/build/SmartToken.bin",
    "solidity/contracts/ContractIds.sol",
    "solidity/contracts/FeatureIds.sol",
    "solidity/contracts/IBancorNetwork.sol",
    "solidity/contracts/bancorx/interfaces/IBancorX.sol",
    "solidity/contracts/converter/BancorConverter.sol",
    "solidity/contracts/converter/BancorFormula.sol",
    "solidity/contracts/converter/interfaces/IBancorConverter.sol",
    "solidity/contracts/converter/interfaces/IBancorConverterUpgrader.sol",
    "solidity/contracts/converter/interfaces/IBancorFormula.sol",
    "solidity/contracts/token/ERC20Token.sol",
    "solidity/contracts/token/EtherToken.sol",
    "solidity/contracts/token/SmartToken.sol",
    "solidity/contracts/token/SmartTokenController.sol",
    "solidity/contracts/token/interfaces/IERC20Token.sol",
    "solidity/contracts/token/interfaces/IEtherToken.sol",
    "solidity/contracts/token/interfaces/INonStandardERC20.sol",
    "solidity/contracts/token/interfaces/ISmartToken.sol",
    "solidity/contracts/token/interfaces/ISmartTokenController.sol",
    "solidity/contracts/utility/ContractRegistry.sol",
    "solidity/contracts/utility/Managed.sol",
    "solidity/contracts/utility/Owned.sol",
    "solidity/contracts/utility/SafeMath.sol",
    "solidity/contracts/utility/TokenHolder.sol",
    "solidity/contracts/utility/Utils.sol",
    "solidity/contracts/utility/interfaces/IAddressList.sol",
    "solidity/contracts/utility/interfaces/IContractFeatures.sol",
    "solidity/contracts/utility/interfaces/IContractRegistry.sol",
    "solidity/contracts/utility/interfaces/IOwned.sol",
    "solidity/contracts/utility/interfaces/ITokenHolder.sol",
    "solidity/contracts/utility/interfaces/IWhitelist.sol",
    "solidity/test/helpers/Utils.js"
];

for (const fileName of fileNames) {
    const url = "https://raw.githubusercontent.com/bancorprotocol/contracts/master/" + fileName;
    const options = {directory: path.dirname(fileName), filename: path.basename(fileName)};
    console.log("Installing " + options.directory + options.filename);
    download(url, options, function(error) {if (error) throw error;});
}
