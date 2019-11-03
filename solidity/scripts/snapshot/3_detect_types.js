const os     = require("os");
const fs     = require("fs");
const Web3   = require("web3");
const assert = require("assert");

const SRC_FILE_NAME = process.argv[2];
const DST_FILE_NAME = process.argv[3];
const TOKEN_ADDRESS = process.argv[4];
const INFURA_KEY    = process.argv[5];

const INVALID_TOKEN = "0x" + "0".repeat(40);
const ARTIFACTS_DIR = __dirname + "/../../build/";

async function rpc(func, ...args) {
    while (true) {
        try {
            return await func(...args);
        }
        catch (error) {
            if (!error.message.startsWith("Invalid JSON RPC response"))
                console.log(error.message);
        }
    }
}

async function rpcTry(method) {
    while (true) {
        try {
            return await method.call();
        }
        catch (error) {
            if (!error.message.startsWith("Invalid JSON RPC response"))
                throw error;
        }
    }
}

async function isConverter(contract, prefix) {
    const getCount = contract.methods[prefix + "TokenCount"];
    const getToken = contract.methods[prefix + "Tokens"];
    try {
        const count = await rpcTry(getCount());
        for (let i = 0; i < Number(count); i++) {
            switch (await rpcTry(getToken(i))) {
                case TOKEN_ADDRESS: return true;
                case INVALID_TOKEN: return false;
            }
        }
    }
    catch (error) {
    }
    return false;
}

async function validToken(contract) {
    return await rpc(contract.methods.token().call);
}

function update(address, balance, token, type) {
    const line = address + " " + balance + " " + token + " " + type + os.EOL;
    fs.appendFileSync(DST_FILE_NAME, line, {encoding: "utf8"});
    process.stdout.write(line);
}

async function run() {
    fs.writeFileSync(DST_FILE_NAME, "", {encoding: "utf8"});
    const web3 = new Web3("https://mainnet.infura.io/v3/" + INFURA_KEY);
    const abi = JSON.parse(fs.readFileSync(ARTIFACTS_DIR + "IConverter.abi", {encoding: "utf8"}));
    for (const line of fs.readFileSync(SRC_FILE_NAME, {encoding: "utf8"}).split(os.EOL).slice(0, -1)) {
        const words = line.split(" ");
        const address = words[0];
        const balance = words[1];
        const contract = new web3.eth.Contract(abi, address);
        const bytecode = await rpc(web3.eth.getCode, address);
        if (bytecode == "0x")
            update(address, balance, INVALID_TOKEN, "externally-owned account");
        else if (await isConverter(contract, "connector"))
            update(address, balance, await validToken(contract), "new-converter contract");
        else if (await isConverter(contract, "reserve"))
            update(address, balance, await validToken(contract), "old-converter contract");
        else
            update(address, balance, INVALID_TOKEN, "unknown-type contract");
    }
}

require("../fix")(fs);
run();