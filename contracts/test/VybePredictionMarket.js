const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VybePredictionMarket", function () {
    async function deployFixture() {
        const [deployer, oracle, alice, bob] = await ethers.getSigners();
        const Vybe = await ethers.getContractFactory("VybePredictionMarket");
        const vybe = await Vybe.deploy(oracle.address);
        await vybe.waitForDeployment();

        const latest = await ethers.provider.getBlock("latest");
        const deadline = latest.timestamp + 3600; // 1h

        await (
            await vybe.createMarket(
                "Will the track reach playback count >= 80?",
                "4uLU6hMCjMI75M1A2tKUQC",
                80,
                deadline
            )
        ).wait();

        return { vybe, deployer, oracle, alice, bob, deadline };
    }

    it("allows buying YES/NO and resolves + redeems correctly (YES wins)", async () => {
        const { vybe, oracle, alice, bob, deadline } = await deployFixture();

        await (
            await vybe
                .connect(alice)
                .buyYes(1, { value: ethers.parseEther("1") })
        ).wait();
        await (
            await vybe.connect(bob).buyNo(1, { value: ethers.parseEther("1") })
        ).wait();

        await ethers.provider.send("evm_setNextBlockTimestamp", [deadline + 1]);
        await ethers.provider.send("evm_mine", []);

        await (await vybe.connect(oracle).resolveMarket(1, 90)).wait();

        const before = await ethers.provider.getBalance(alice.address);
        const tx = await vybe.connect(alice).redeem(1);
        const rcpt = await tx.wait();
        const gas = rcpt.gasUsed * rcpt.gasPrice;
        const after = await ethers.provider.getBalance(alice.address);

        expect(after).to.be.closeTo(
            before + ethers.parseEther("2") - gas,
            ethers.parseEther("0.001")
        );
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
