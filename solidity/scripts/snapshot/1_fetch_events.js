const os      = require("os");
const fs      = require("fs");
const Web3    = require("web3");
const request = require("request");

const DST_FILE_NAME = process.argv[2];
const TOKEN_ADDRESS = process.argv[3];
const ETHERSCAN_KEY = process.argv[4];
const LAST_BLOCK    = process.argv[5];

const TRANSFER_EVENT = Web3.utils.keccak256("Transfer(address,address,uint256)");
const BASE_URL_1     = "http://api.etherscan.io/api?module=account&action=txlist&address=" + TOKEN_ADDRESS + "&apikey=" + ETHERSCAN_KEY;
const BASE_URL_2     = "http://api.etherscan.io/api?module=logs&action=getLogs&address="   + TOKEN_ADDRESS + "&apikey=" + ETHERSCAN_KEY + "&topic0=" + TRANSFER_EVENT;
const MAX_RESULTS    = 1000;

function init() {
    request(BASE_URL_1, {timeout: 10000}, function(error, response, body) {
        const parsed = body ? JSON.parse(body) : {};
        if (parsed.result && parsed.result.length > 0) {
            if (parsed.result[0].to == "") {
                console.log(`error = ${error}, status = ${response.statusCode}, message = ${parsed.message}, block = ${parsed.result[0].blockNumber}`);
                scan(Number(parsed.result[0].blockNumber), MAX_RESULTS);
            }
            else {
                console.log(`error = ${error}, status = ${response.statusCode}, message = ${parsed.message}, block = 0`);
                scan(0, MAX_RESULTS);
            }
        }
        else {
            console.log(`error = ${error}; retrying...`);
            init();
        }
    });
}

function scan(fromBlock, numOfBlocks) {
    const toBlock = Math.min(fromBlock + numOfBlocks - 1, LAST_BLOCK);
    if (fromBlock <= toBlock) {
        request(`${BASE_URL_2}&fromBlock=${fromBlock}&toBlock=${toBlock}`, {timeout: 10000}, function(error, response, body) {
            const parsed = body ? JSON.parse(body) : {};
            if (parsed.result) {
                if (parsed.result.length < MAX_RESULTS) {
                    console.log(`blocks ${fromBlock} + ${numOfBlocks}: error = ${error}, status = ${response.statusCode}, message = ${parsed.message}, events = ${parsed.result.length}`);
                    fs.appendFileSync(DST_FILE_NAME, parsed.result.map(x => `${x.topics[1]} ${x.topics[2]} ${x.data}` + os.EOL).join(""), {encoding: "utf8"});
                    scan(toBlock + 1, numOfBlocks + 1);
                }
                else {
                    console.log(`blocks ${fromBlock} + ${numOfBlocks}: error = ${error}, status = ${response.statusCode}, message = ${parsed.message}, events = ${parsed.result.length}; retrying...`);
                    scan(fromBlock, numOfBlocks >> 1);
                }
            }
            else {
                console.log(`blocks ${fromBlock} + ${numOfBlocks}: error = ${error}; retrying...`);
                scan(fromBlock, numOfBlocks);
            }
        });
    }
}

function run() {
    fs.writeFileSync(DST_FILE_NAME, "", {encoding: "utf8"});
    init();
}

require("../fix")(fs);
run();