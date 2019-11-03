contract("AirHodlConverter", function(accounts) {
    let token    ;
    let reserve  ;
    let registry ;
    let converter;

    const TOTAL_SUPPLY = 1000;
    const VESTING_LENGTH = 10;

    const owner    = accounts[0];
    const nonOwner = accounts[1];

    const catchRevert = require("./helpers/Utils.js").catchRevert;

    beforeEach(async function() {
        token     = await artifacts.require("SmartToken"          ).new("name", "symbol", 0);
        reserve   = await artifacts.require("ERC20Token"          ).new("name", "symbol", 0, TOTAL_SUPPLY);
        registry  = await artifacts.require("ContractRegistry"    ).new();
        converter = await artifacts.require("TestAirHodlConverter").new(token.address, registry.address, reserve.address, VESTING_LENGTH);
    });

    describe("function activate:", function() {
        it("should abort with an error if called by a non-owner", async function() {
            await catchRevert(converter.activate({from: nonOwner}));
        });
        it("should abort with an error if called more than once", async function() {
            await converter.activate({from: owner});
            await catchRevert(converter.activate({from: owner}));
        });
    });

    describe("function getReserveBalance:", function() {
        it("should abort with an error if called before activation", async function() {
            await catchRevert(converter.getReserveBalance(reserve.address));
        });
    });

    describe("function getReserveBalance:", function() {
        beforeEach(async function() {
            await reserve.transfer(converter.address, TOTAL_SUPPLY);
            await converter.activate();
        });
        for (let seconds = 0; seconds <= VESTING_LENGTH; seconds++) {
            const percent = Math.round(seconds / VESTING_LENGTH * 100);
            const expected = Math.floor(TOTAL_SUPPLY * seconds / VESTING_LENGTH);
            it(`after ${percent}% of the vesting period should return ${expected}`, async function() {
                await converter.jump(seconds);
                const actual = await converter.getReserveBalance(reserve.address);
                assert(actual.equals(expected), `but has returned ${actual}`);
            });
        }
        it(`after the end of the vesting period should return ${TOTAL_SUPPLY}`, async function() {
            await converter.jump(VESTING_LENGTH + 1);
            const actual = await converter.getReserveBalance(reserve.address);
            assert(actual.equals(TOTAL_SUPPLY), `but has returned ${actual}`);
        });
    });
});
