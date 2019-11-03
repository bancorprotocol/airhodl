const fs   = require("fs");
const Web3 = require("web3");

const CFG_FILE_NAME = process.argv[2];
const NODE_ADDRESS  = process.argv[3];
const PRIVATE_KEY   = process.argv[4];
const PUBLIC_ADDR   = process.argv[5];
const BNT_AMOUNT    = process.argv[6];
const BNT_BUFFER    = process.argv[7];

const ARTIFACTS_DIR = __dirname + "/../../build/";

const MIN_GAS_LIMIT = 100000;

function get() {
    return JSON.parse(fs.readFileSync(CFG_FILE_NAME, {encoding: "utf8"}));
}

function set(record) {
    fs.writeFileSync(CFG_FILE_NAME, JSON.stringify({...get(), ...record}, null, 4));
}

async function scan() {
    return await new Promise(function(resolve, reject) {
        process.stdin.resume();
        process.stdin.once("data", function(data) {
            process.stdin.pause();
            resolve(data.toString().trim());
        });
    });
}

async function getGasPrice(web3) {
    while (true) {
        const nodeGasPrice = await web3.eth.getGasPrice();
        process.stdout.write(`Enter gas-price or leave empty to use ${nodeGasPrice}: `);
        const userGasPrice = await scan();
        if (/^\d+$/.test(userGasPrice))
            return userGasPrice;
        if (userGasPrice == "")
            return nodeGasPrice;
        console.log("Illegal gas-price");
    }
}

async function getTransactionReceipt(web3) {
    while (true) {
        process.stdout.write("Enter transaction-hash or leave empty to retry: ");
        const hash = await scan();
        if (/^0x([0-9A-Fa-f]{64})$/.test(hash)) {
            const receipt = await web3.eth.getTransactionReceipt(hash);
            if (receipt)
                return receipt;
            console.log("Invalid transaction-hash");
        }
        else if (hash) {
            console.log("Illegal transaction-hash");
        }
        else {
            return null;
        }
    }
}

async function send(web3, account, gasPrice, transaction, value = 0, retry = true) {
    while (true) {
        try {
            const options = {
                to      : transaction._parent._address,
                data    : transaction.encodeABI(),
                gas     : Math.max(await transaction.estimateGas({from: account.address}), MIN_GAS_LIMIT),
                gasPrice: gasPrice ? gasPrice : await getGasPrice(web3),
                value   : value,
            };
            const signed  = await web3.eth.accounts.signTransaction(options, account.privateKey);
            const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
            return receipt;
        }
        catch (error) {
            console.log(error.message);
            if (retry) {
                const receipt = await getTransactionReceipt(web3);
                if (receipt)
                    return receipt;
            }
            else {
                return {};
            }
        }
    }
}

async function deploy(web3, account, gasPrice, contractId, contractName, contractArgs) {
    if (get()[contractId] == undefined) {
        const abi = fs.readFileSync(ARTIFACTS_DIR + contractName + ".abi", {encoding: "utf8"});
        const bin = fs.readFileSync(ARTIFACTS_DIR + contractName + ".bin", {encoding: "utf8"});
        const contract = new web3.eth.Contract(JSON.parse(abi));
        const options = {data: "0x" + bin, arguments: contractArgs};
        const transaction = contract.deploy(options);
        const receipt = await send(web3, account, gasPrice, transaction);
        const args = transaction.encodeABI().slice(options.data.length);
        console.log(`${contractId} deployed at ${receipt.contractAddress}`);
        set({[contractId]: {name: contractName, addr: receipt.contractAddress, args: args}});
    }
    return deployed(web3, contractName, get()[contractId].addr);
}

function deployed(web3, contractName, contractAddr) {
    const abi = fs.readFileSync(ARTIFACTS_DIR + contractName + ".abi", {encoding: "utf8"});
    return new web3.eth.Contract(JSON.parse(abi), contractAddr);
}

async function rpc(func) {
    while (true) {
        try {
            return await func.call();
        }
        catch (error) {
            if (!error.message.startsWith("Invalid JSON RPC response"))
                throw error;
        }
    }
}

async function assertBalance(token, address, expected) {
    const actual = await rpc(token.methods.balanceOf(address));
    assertEqual(`balance of ${address}: ${actual}`, `balance of ${address}: ${expected}`);
}

async function assertOwner(instance, expected) {
    const actual = await rpc(instance.methods.owner());
    assertEqual(`owner of ${instance._address}: ${actual.toLowerCase()}`, `owner of ${instance._address}: ${expected.toLowerCase()}`);
}

function assertEqual(actual, expected) {
    console.log(`expected ${expected}`);
    console.log(`actual   ${actual  }`);
    if (actual !== expected) {
        console.log("error");
        process.exit();
    }
}

async function run() {
    const web3 = new Web3(NODE_ADDRESS);

    const gasPrice = await getGasPrice(web3);
    const account  = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    const web3Func = (func, ...args) => func(web3, account, gasPrice, ...args);
    const bntTotal = Web3.utils.toBN(BNT_AMOUNT).add(Web3.utils.toBN(BNT_BUFFER)).toString();

    if (get().oldConverter == undefined) { // this is a test-scenario
        const registry     = await web3Func(deploy, "registry"    , "ContractRegistry", []);
        const ethToken     = await web3Func(deploy, "ethToken"    , "EtherToken"      , []);
        const bntToken     = await web3Func(deploy, "bntToken"    , "SmartToken"      , ["Bancor Network Token", "BNT", 18]);
        const oldConverter = await web3Func(deploy, "oldConverter", "BancorConverter" , [bntToken._address, registry._address, 0, ethToken._address, 100000]);
        await web3Func(send, ethToken    .methods.deposit(), 1234);
        await web3Func(send, ethToken    .methods.transfer(oldConverter._address, 1234));
        await web3Func(send, bntToken    .methods.issue(PUBLIC_ADDR, bntTotal + 567890));
        await web3Func(send, bntToken    .methods.transferOwnership(oldConverter._address));
        await web3Func(send, oldConverter.methods.acceptTokenOwnership());
    }

    const oldConverter = deployed(web3, "BancorConverter" , get().oldConverter.addr);
    const registry     = deployed(web3, "ContractRegistry", await rpc(oldConverter.methods.registry()));
    const ethToken     = deployed(web3, "EtherToken"      , await rpc(oldConverter.methods.connectorTokens(0)));
    const bntToken     = deployed(web3, "SmartToken"      , await rpc(oldConverter.methods.token()));

    const relayToken          = await web3Func(deploy, "relayToken"         , "SmartToken"         , get().relayTokenParams);
    const airHodlToken        = await web3Func(deploy, "airHodlToken"       , "SmartToken"         , get().airHodlTokenParams);
    const newConverter        = await web3Func(deploy, "newConverter"       , "BancorConverter"    , [relayToken._address, registry._address, 0, bntToken._address, 500000]);
    const airHodlConverter    = await web3Func(deploy, "airHodlConverter"   , "AirHodlConverter"   , [airHodlToken._address, registry._address, relayToken._address, get().vestingLength]);
    const fixedSupplyUpgrader = await web3Func(deploy, "fixedSupplyUpgrader", "FixedSupplyUpgrader", []);

    const bntBalance = await rpc(bntToken.methods.balanceOf(PUBLIC_ADDR));
    const ethBalance = await rpc(oldConverter.methods.getConnectorBalance(ethToken._address));

    await web3Func(send, newConverter.methods.addConnector(ethToken._address, 500000, false));
    await web3Func(send, relayToken  .methods.transferOwnership(fixedSupplyUpgrader._address));
    await web3Func(send, oldConverter.methods.transferOwnership(fixedSupplyUpgrader._address));
    await web3Func(send, newConverter.methods.transferOwnership(fixedSupplyUpgrader._address));
    await web3Func(send, bntToken    .methods.transfer(fixedSupplyUpgrader._address, bntTotal));
    await web3Func(send, registry    .methods.registerAddress(Web3.utils.asciiToHex("BancorConverterUpgrader"), fixedSupplyUpgrader._address));

    await assertBalance(bntToken  , fixedSupplyUpgrader._address, bntTotal);
    await assertBalance(bntToken  , newConverter       ._address, 0);
    await assertBalance(bntToken  , PUBLIC_ADDR                 , bntBalance - bntTotal);
    await assertBalance(ethToken  , oldConverter       ._address, ethBalance);
    await assertBalance(ethToken  , newConverter       ._address, 0);
    await assertBalance(relayToken, airHodlConverter   ._address, 0);
    await assertBalance(relayToken, PUBLIC_ADDR                 , 0);

    await assertOwner(relayToken  , PUBLIC_ADDR);
    await assertOwner(oldConverter, PUBLIC_ADDR);
    await assertOwner(newConverter, PUBLIC_ADDR);

    await web3Func(send, fixedSupplyUpgrader.methods.execute(oldConverter._address, newConverter._address, airHodlConverter._address, BNT_AMOUNT));

    await assertBalance(bntToken  , fixedSupplyUpgrader._address, 0);
    await assertBalance(bntToken  , newConverter       ._address, BNT_AMOUNT);
    await assertBalance(bntToken  , PUBLIC_ADDR                 , bntBalance - BNT_AMOUNT);
    await assertBalance(ethToken  , oldConverter       ._address, 0);
    await assertBalance(ethToken  , newConverter       ._address, ethBalance);
    await assertBalance(relayToken, airHodlConverter   ._address, BNT_AMOUNT);
    await assertBalance(relayToken, PUBLIC_ADDR                 , BNT_AMOUNT);

    await assertOwner(relayToken  , newConverter       ._address);
    await assertOwner(oldConverter, fixedSupplyUpgrader._address);
    await assertOwner(newConverter, fixedSupplyUpgrader._address);

    await web3Func(send, oldConverter.methods.acceptOwnership());
    await web3Func(send, newConverter.methods.acceptOwnership());

    await assertOwner(oldConverter, PUBLIC_ADDR);
    await assertOwner(newConverter, PUBLIC_ADDR);

    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
}

require("../fix")(fs);
run();