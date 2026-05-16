import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const DAY = 24 * 60 * 60;
const METADATA_URI = "ipfs://arc-escrow/service-agreement-001";

async function deployFixture() {
  const [client, beneficiary, arbiter, other] = await ethers.getSigners();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();

  const ArcEscrow = await ethers.getContractFactory("ArcEscrow");
  const escrow = await ArcEscrow.deploy(await usdc.getAddress());

  const amount = ethers.parseUnits("100", 6);
  await usdc.mint(client.address, ethers.parseUnits("1000", 6));
  await usdc.connect(client).approve(await escrow.getAddress(), ethers.MaxUint256);

  return { client, beneficiary, arbiter, other, usdc, escrow, amount };
}

async function createDefaultEscrow(context: Awaited<ReturnType<typeof deployFixture>>, deadline?: number) {
  const escrowId = await context.escrow.getEscrowCount();
  const validDeadline = deadline ?? (await time.latest()) + 7 * DAY;

  const tx = await context.escrow
    .connect(context.client)
    .createEscrow(
      context.beneficiary.address,
      context.arbiter.address,
      context.amount,
      validDeadline,
      METADATA_URI,
    );

  return { escrowId, tx, deadline: validDeadline };
}

describe("ArcEscrow", function () {
  it("creates escrow and transfers USDC to the contract", async function () {
    const context = await loadFixture(deployFixture);
    const escrowAddress = await context.escrow.getAddress();

    const { escrowId, tx, deadline } = await createDefaultEscrow(context);

    await expect(tx)
      .to.emit(context.escrow, "EscrowCreated")
      .withArgs(
        escrowId,
        context.client.address,
        context.beneficiary.address,
        context.arbiter.address,
        context.amount,
        deadline,
        METADATA_URI,
      );

    expect(await context.usdc.balanceOf(escrowAddress)).to.equal(context.amount);
    expect(await context.escrow.totalVolume()).to.equal(context.amount);

    const stored = await context.escrow.getEscrow(escrowId);
    expect(stored.client).to.equal(context.client.address);
    expect(stored.beneficiary).to.equal(context.beneficiary.address);
    expect(stored.arbiter).to.equal(context.arbiter.address);
    expect(stored.status).to.equal(0n);
  });

  it("allows the beneficiary to accept", async function () {
    const context = await loadFixture(deployFixture);
    const { escrowId } = await createDefaultEscrow(context);

    await expect(context.escrow.connect(context.beneficiary).acceptEscrow(escrowId))
      .to.emit(context.escrow, "EscrowAccepted")
      .withArgs(escrowId, context.beneficiary.address);

    const stored = await context.escrow.getEscrow(escrowId);
    expect(stored.status).to.equal(1n);
    expect(stored.acceptedAt).to.be.greaterThan(0n);
  });

  it("reverts when a non-beneficiary accepts", async function () {
    const context = await loadFixture(deployFixture);
    const { escrowId } = await createDefaultEscrow(context);

    await expect(context.escrow.connect(context.other).acceptEscrow(escrowId)).to.be.revertedWithCustomError(
      context.escrow,
      "Unauthorized",
    );
  });

  it("allows the client to release after accepted", async function () {
    const context = await loadFixture(deployFixture);
    const { escrowId } = await createDefaultEscrow(context);
    await context.escrow.connect(context.beneficiary).acceptEscrow(escrowId);

    await expect(context.escrow.connect(context.client).releaseEscrow(escrowId)).to.changeTokenBalances(
      context.usdc,
      [context.beneficiary, context.escrow],
      [context.amount, -context.amount],
    );

    const stored = await context.escrow.getEscrow(escrowId);
    expect(stored.status).to.equal(2n);
    expect(await context.escrow.completedEscrows()).to.equal(1n);
  });

  it("reverts when a non-client releases", async function () {
    const context = await loadFixture(deployFixture);
    const { escrowId } = await createDefaultEscrow(context);
    await context.escrow.connect(context.beneficiary).acceptEscrow(escrowId);

    await expect(context.escrow.connect(context.other).releaseEscrow(escrowId)).to.be.revertedWithCustomError(
      context.escrow,
      "Unauthorized",
    );
  });

  it("allows client or beneficiary to open a dispute", async function () {
    const context = await loadFixture(deployFixture);
    const first = await createDefaultEscrow(context);
    await context.escrow.connect(context.beneficiary).acceptEscrow(first.escrowId);

    await expect(context.escrow.connect(context.client).openDispute(first.escrowId))
      .to.emit(context.escrow, "EscrowDisputed")
      .withArgs(first.escrowId, context.client.address);

    const second = await createDefaultEscrow(context);
    await context.escrow.connect(context.beneficiary).acceptEscrow(second.escrowId);

    await expect(context.escrow.connect(context.beneficiary).openDispute(second.escrowId))
      .to.emit(context.escrow, "EscrowDisputed")
      .withArgs(second.escrowId, context.beneficiary.address);

    expect(await context.escrow.disputedEscrows()).to.equal(2n);
  });

  it("allows the arbiter to split disputed funds", async function () {
    const context = await loadFixture(deployFixture);
    const { escrowId } = await createDefaultEscrow(context);
    await context.escrow.connect(context.beneficiary).acceptEscrow(escrowId);
    await context.escrow.connect(context.client).openDispute(escrowId);

    const clientAmount = ethers.parseUnits("25", 6);
    const beneficiaryAmount = ethers.parseUnits("75", 6);

    await expect(context.escrow.connect(context.arbiter).resolveDispute(escrowId, 2500, 7500)).to.changeTokenBalances(
      context.usdc,
      [context.client, context.beneficiary, context.escrow],
      [clientAmount, beneficiaryAmount, -context.amount],
    );

    const stored = await context.escrow.getEscrow(escrowId);
    expect(stored.status).to.equal(4n);
  });

  it("reverts when a non-arbiter resolves", async function () {
    const context = await loadFixture(deployFixture);
    const { escrowId } = await createDefaultEscrow(context);
    await context.escrow.connect(context.beneficiary).acceptEscrow(escrowId);
    await context.escrow.connect(context.client).openDispute(escrowId);

    await expect(context.escrow.connect(context.other).resolveDispute(escrowId, 5000, 5000)).to.be.revertedWithCustomError(
      context.escrow,
      "Unauthorized",
    );
  });

  it("reverts for an invalid dispute split", async function () {
    const context = await loadFixture(deployFixture);
    const { escrowId } = await createDefaultEscrow(context);
    await context.escrow.connect(context.beneficiary).acceptEscrow(escrowId);
    await context.escrow.connect(context.client).openDispute(escrowId);

    await expect(context.escrow.connect(context.arbiter).resolveDispute(escrowId, 9000, 999)).to.be.revertedWithCustomError(
      context.escrow,
      "InvalidSplit",
    );
  });

  it("refunds an expired created escrow", async function () {
    const context = await loadFixture(deployFixture);
    const deadline = (await time.latest()) + DAY;
    const { escrowId } = await createDefaultEscrow(context, deadline);

    await time.increaseTo(deadline + 1);

    await expect(context.escrow.connect(context.beneficiary).refundExpired(escrowId)).to.changeTokenBalances(
      context.usdc,
      [context.client, context.escrow],
      [context.amount, -context.amount],
    );

    const stored = await context.escrow.getEscrow(escrowId);
    expect(stored.status).to.equal(5n);
  });

  it("allows the client to cancel an unaccepted escrow", async function () {
    const context = await loadFixture(deployFixture);
    const { escrowId } = await createDefaultEscrow(context);

    await expect(context.escrow.connect(context.client).cancelUnaccepted(escrowId)).to.changeTokenBalances(
      context.usdc,
      [context.client, context.escrow],
      [context.amount, -context.amount],
    );

    const stored = await context.escrow.getEscrow(escrowId);
    expect(stored.status).to.equal(6n);
  });

  it("reverts for zero addresses, zero amount, and invalid deadline", async function () {
    const context = await loadFixture(deployFixture);
    const deadline = (await time.latest()) + DAY;

    await expect(
      context.escrow.connect(context.client).createEscrow(
        ethers.ZeroAddress,
        context.arbiter.address,
        context.amount,
        deadline,
        METADATA_URI,
      ),
    ).to.be.revertedWithCustomError(context.escrow, "ZeroAddress");

    await expect(
      context.escrow.connect(context.client).createEscrow(
        context.beneficiary.address,
        ethers.ZeroAddress,
        context.amount,
        deadline,
        METADATA_URI,
      ),
    ).to.be.revertedWithCustomError(context.escrow, "ZeroAddress");

    await expect(
      context.escrow.connect(context.client).createEscrow(
        context.beneficiary.address,
        context.arbiter.address,
        0,
        deadline,
        METADATA_URI,
      ),
    ).to.be.revertedWithCustomError(context.escrow, "ZeroAmount");

    await expect(
      context.escrow.connect(context.client).createEscrow(
        context.beneficiary.address,
        context.arbiter.address,
        context.amount,
        await time.latest(),
        METADATA_URI,
      ),
    ).to.be.revertedWithCustomError(context.escrow, "InvalidDeadline");
  });
});
