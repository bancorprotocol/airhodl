const os            = require("os");
const fs            = require("fs");
const Web3          = require("web3");
const child_process = require("child_process");

const DST_FILE_NAME = process.argv[2];
const TOKEN_ADDRESS = process.argv[3];
const VAULT_ADDRESS = process.argv[4];
const ETHERSCAN_KEY = process.argv[5];
const INFURA_KEY    = process.argv[6];
const LAST_BLOCK    = process.argv[7];

function fraction(n, d) {
    n = Web3.utils.toBN(n);
    d = Web3.utils.toBN(d);
    return {
        n  : n,
        d  : d,
        get: ( ) => n.div(d),
        mul: (x) => fraction(n.mul(x.n), d.mul(x.d)),
        add: (x) => fraction(n.mul(x.d).add(d.mul(x.n)), d.mul(x.d)),
    };
}

function script(prefix, vault) {
    return __dirname + "/" + prefix + (vault ? "_vault" : "") + ".js";
}

function spawn() {
    const result = child_process.spawnSync("node", Object.values(arguments), {stdio: ["inherit", "inherit", "pipe"]});
    if (result.stderr.length > 0)
        throw new Error(result.stderr);
}

function run() {
    fs.writeFileSync(DST_FILE_NAME, "", {encoding: "utf8"});

    const records = {};
    const spawned = {};

    const vaultAddress = Web3.utils.toChecksumAddress(VAULT_ADDRESS);
    const queue = [{address: Web3.utils.toChecksumAddress(TOKEN_ADDRESS), weight: fraction(1, 1)}];

    while (queue.length > 0) {
        const token = queue.shift();
        const file1 = token.address + ".events";
        const file2 = token.address + ".balances";
        const file3 = token.address + ".snapshot";
        const vault = token.address == vaultAddress;
        if (spawned[token.address] != true) {
            spawned[token.address] = true;
            spawn(script("1_fetch_events" , vault),        file1, token.address, ETHERSCAN_KEY, LAST_BLOCK);
            spawn(script("2_calc_balances", vault), file1, file2, token.address, INFURA_KEY   , LAST_BLOCK);
            spawn(script("3_detect_types" , false), file2, file3, token.address, INFURA_KEY               );
        }
        const lines = fs.readFileSync(file3, {encoding: "utf8"}).split(os.EOL).slice(0, -1);
        const supply = lines.map(x => Web3.utils.toBN(x.split(" ")[1])).reduce((a, b) => a.add(b), Web3.utils.toBN(0));
        for (const line of lines) {
            const words = line.split(" ");
            const address = words[0];
            const balance = words[1];
            const account = words[2];
            const details = words.slice(3);
            if (address == vaultAddress)
                queue.push({address: address, weight: token.weight.mul(fraction(balance, supply))});
            else if (!/^0x0+$/.test((account)))
                queue.push({address: account, weight: token.weight.mul(fraction(balance, supply))});
            else if (!(address in records))
                records[address] = {amount: token.weight.mul(fraction(balance, 1)), type: details.join(" ")};
            else
                records[address].amount = records[address].amount.add(token.weight.mul(fraction(balance, 1)));
        }
    }

    const value = ([address, record]) => record.amount.get().shln(160).or(Web3.utils.toBN(address));
    for (const [address, record] of Object.entries(records).sort((a, b) => value(b).cmp(value(a)))) {
        const line = address + " " + record.amount.get().toString() + " " + record.type + os.EOL;
        fs.appendFileSync(DST_FILE_NAME, line, {encoding: "utf8"});
        process.stdout.write(line);
    }
}

require("../fix")(fs);
run();