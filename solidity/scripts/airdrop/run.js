const os   = require("os");
const fs   = require("fs");
const Web3 = require("web3");

const SRC_FILE_NAME = process.argv[2];
const CFG_FILE_NAME = process.argv[3];
const NODE_ADDRESS  = process.argv[4];
const PRIVATE_KEY   = process.argv[5];
const CHUNK_SIZE    = process.argv[6];

const ARTIFACTS_DIR = __dirname + "/../../build/";

const MIN_GAS_LIMIT = 0;

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

async function run() {
    const web3 = new Web3(NODE_ADDRESS);

    const gasPrice = await getGasPrice(web3);
    const account  = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    const web3Func = (func, ...args) => func(web3, account, gasPrice, ...args);

    const token   = await web3Func(deploy, "token", "SmartToken", get().params);
    const dropper = await web3Func(deploy, "dropper", "AirDropper", [token._address]);
    const owner   = await rpc(dropper.methods.owner());

    const lines   = fs.readFileSync(SRC_FILE_NAME, {encoding: "utf8"}).split(os.EOL).slice(0, -1);
    const targets = lines.map(line => line.split(" ")[0]);
    const amounts = lines.map(line => line.split(" ")[1]);

    if (get().transactions == undefined) {
        const supply  = amounts.map(x => Web3.utils.toBN(x)).reduce((a, b) => a.add(b), Web3.utils.toBN(0));
        const receipt = await web3Func(send, token.methods.issue(dropper._address, supply.toString()));
        set({transactions: Array(Math.ceil(lines.length / CHUNK_SIZE)).fill({})});
        console.log(`${supply} tokens issued`);
    }
    else {
        const supply  = await rpc(token.methods.totalSupply());
        const balance = await rpc(token.methods.balanceOf(dropper._address));
        console.log(`${balance} out of ${supply} tokens remaining`);
    }

    const transactions = get().transactions;
    while (transactions.some(x => !x.done)) {
        for (let i = 0; i < transactions.length; i++) {
            if (transactions[i].blockNumber == undefined) {
                const bgn = i * CHUNK_SIZE;
                const balance = await rpc(dropper.methods.balances(targets[bgn]));
                if (balance == "0") {
                    const end = (i + 1) * CHUNK_SIZE;
                    const receipt = await web3Func(send, dropper.methods.execute(targets.slice(bgn, end), amounts.slice(bgn, end)), 0, false);
                    transactions[i] = {blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed};
                    console.log(`transaction ${i} submitted: ${JSON.stringify(transactions[i])}`);
                    set({transactions});
                }
                else {
                    transactions[i].blockNumber = await web3.eth.getBlockNumber();
                    console.log(`transaction ${i} confirmed: ${JSON.stringify(transactions[i])}`);
                    set({transactions});
                }
            }
            else if (transactions[i].done == undefined) {
                const bgn = i * CHUNK_SIZE;
                const balance = await rpc(dropper.methods.balances(targets[bgn]));
                if (balance == "0") {
                    const end = (i + 1) * CHUNK_SIZE;
                    const receipt = await web3Func(send, dropper.methods.execute(targets.slice(bgn, end), amounts.slice(bgn, end)), 0, false);
                    transactions[i] = {blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed};
                    console.log(`transaction ${i} resubmitted: ${JSON.stringify(transactions[i])}`);
                    set({transactions});
                }
                else if (transactions[i].blockNumber + 12 <= await web3.eth.getBlockNumber()) {
                    transactions[i].done = true;
                    console.log(`transaction ${i} concluded: ${JSON.stringify(transactions[i])}`);
                    set({transactions});
                }
                else {
                    web3.currentProvider.send({method: "evm_mine"}, () => {});
                }
            }
        }
    }

    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
}

require("../fix")(fs);
run();