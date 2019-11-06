from sys import argv
from json import loads

with open(argv[1] if len(argv) > 1 else "SimulationExample.json") as file:
    simulation   = loads(file.read())
    totalReserve = simulation["totalReserve"]
    totalSupply  = simulation["totalSupply" ]
    vestingTime  = simulation["vestingTime" ]
    withdrawals  = simulation["withdrawals" ]
    assert totalSupply >= sum(withdrawal["inputAmount"] for withdrawal in withdrawals)
    assert all(x["currentTime"] <= y["currentTime"] for x,y in zip(withdrawals,withdrawals[1:]))
    for withdrawal in withdrawals:
        vestingPart = min(vestingTime,withdrawal["currentTime"])
        n = vestingPart * totalReserve
        d = vestingTime * totalSupply
        withdrawal["outputAmount"] = withdrawal["inputAmount"] * n // d
        totalReserve -= withdrawal["outputAmount"]
        totalSupply  -= withdrawal["inputAmount" ]
        print("At {:.0%} of the vesting period: {} virtual tokens = {} real tokens".format(withdrawal["currentTime"]/vestingTime,withdrawal["inputAmount"],withdrawal["outputAmount"]))
