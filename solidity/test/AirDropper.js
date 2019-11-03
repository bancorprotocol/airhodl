contract("AirDropper", function(accounts) {
    let token;
    let dropper;

    const owner    = accounts[0];
    const nonOwner = accounts[1];
    const users    = accounts.slice(2);

    const values = users.map((x, i) => i + 1);
    const supply = values.reduce((a, b) => a + b, 0);

    const catchRevert = require("./helpers/Utils.js").catchRevert;

    before(async function() {
        token = await artifacts.require("ERC20Token").new("name", "symbol", 0, supply, {from: owner});
        dropper = await artifacts.require("AirDropper").new(token.address, {from: owner});
        await token.transfer(dropper.address, supply, {from: owner});
    });

    it("function execute should abort with an error if called by a non-owner", async function() {
        await catchRevert(dropper.execute(users, values, {from: nonOwner}));
    });

    it("function execute should abort with an error if there are more users than values", async function() {
        await catchRevert(dropper.execute(users, values.slice(1), {from: owner}));
    });

    it("function execute should abort with an error if there are less users than values", async function() {
        await catchRevert(dropper.execute(users.slice(1), values, {from: owner}));
    });

    it("function execute should abort with an error if called twice for the same target", async function() {
        await dropper.execute(users, values, {from: owner});
        await catchRevert(dropper.execute([users[0]], [values[0]], {from: owner}));
    });

    for (let i = 0; i < users.length; i++) {
        it(`balance of user #${i + 1}`, async function() {
            const balance = await token.balanceOf(users[i]);
            assert.equal(balance.toFixed(), values[i].toFixed());
        });
    }
});
