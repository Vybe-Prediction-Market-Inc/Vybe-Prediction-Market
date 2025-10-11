import { expect } from "chai";
import { ethers } from "hardhat";

describe("VybePredictionMarket", function () {
    async function deployFixture() {
        const [deployer, oracle, alice, bob] = await ethers.getSigners();
        const Vybe = await ethers.getContractFactory("VybePredictionMarket");
        const vybe = await Vybe.deploy(oracle.address);
        await vybe.waitForDeployment();

        const block = await ethers.provider.getBlock("latest");
        if (!block) throw new Error("No latest block");
        const now = block.timestamp;
        const deadline = now + 3600; // 1h

        const tx = await vybe.createMarket(
            "Will the track reach popularity >= 80?",
            "4uLU6hMCjMI75M1A2tKUQC",
            80,
            deadline
        );
        await tx.wait();

        return { vybe, deployer, oracle, alice, bob, deadline };
    }

    it("allows buying YES/NO and resolves + redeems correctly (YES wins)", async () => {
        const { vybe, oracle, alice, bob, deadline } = await deployFixture();

        // Alice buys YES 1 ETH, Bob buys NO 1 ETH
        await vybe.connect(alice).buyYes(1, { value: ethers.parseEther("1") });
        await vybe.connect(bob).buyNo(1, { value: ethers.parseEther("1") });

        // Travel to deadline
        await ethers.provider.send("evm_setNextBlockTimestamp", [deadline + 1]);
        await ethers.provider.send("evm_mine", []);

        // Oracle resolves observed 90 (>=80) => YES wins
        await vybe.connect(oracle).resolveMarket(1, 90);

        const before = await ethers.provider.getBalance(alice.address);
        const tx = await vybe.connect(alice).redeem(1);
        const rcpt = await tx.wait();
        const gas = rcpt!.gasUsed * rcpt!.gasPrice!;
        const after = await ethers.provider.getBalance(alice.address);

        // Pot = 2 ETH, yesPool = 1 ETH, Alice has 1 ETH shares => payout = 2 ETH
        expect(after).to.be.closeTo(
            before + ethers.parseEther("2") - gas,
            ethers.parseEther("0.001")
        );

        // Bob cannot redeem (losing side)
        await expect(vybe.connect(bob).redeem(1)).to.be.revertedWith(
            "no winning shares"
        );
    });

    it("prevents trading after deadline and non-oracle resolve", async () => {
        const { vybe, deployer, deadline } = await deployFixture();
        await ethers.provider.send("evm_setNextBlockTimestamp", [deadline + 1]);
        await ethers.provider.send("evm_mine", []);
        await expect(
            vybe.connect(deployer).buyYes(1, { value: 1 })
        ).to.be.revertedWith("trading closed");
        await expect(
            vybe.connect(deployer).resolveMarket(1, 50)
        ).to.be.revertedWith("not oracle");
    });
});
