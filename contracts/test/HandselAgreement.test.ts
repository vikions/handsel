import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const DAY = 24 * 60 * 60;
const TITLE = "Landing page implementation";
const CRITERIA_URI = "ipfs://handsel/criteria/landing-page";
const METADATA_URI = "ipfs://handsel/agreements/landing-page";
const PROOF_URI = "https://github.com/team/project/pull/42";

async function deployFixture() {
  const [client, beneficiary, arbiter, other] = await ethers.getSigners();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();

  const HandselAgreement = await ethers.getContractFactory("HandselAgreement");
  const handsel = await HandselAgreement.deploy(await usdc.getAddress());

  const amount = ethers.parseUnits("100", 6);
  await usdc.mint(client.address, ethers.parseUnits("1000", 6));
  await usdc.connect(client).approve(await handsel.getAddress(), ethers.MaxUint256);

  return { client, beneficiary, arbiter, other, usdc, handsel, amount };
}

async function createDefaultAgreement(context: Awaited<ReturnType<typeof deployFixture>>, deadline?: number) {
  const agreementId = await context.handsel.getAgreementCount();
  const validDeadline = deadline ?? (await time.latest()) + 7 * DAY;

  const tx = await context.handsel
    .connect(context.client)
    .createAgreement(
      context.beneficiary.address,
      context.arbiter.address,
      context.amount,
      validDeadline,
      TITLE,
      CRITERIA_URI,
      METADATA_URI,
    );

  return { agreementId, tx, deadline: validDeadline };
}

async function createAndAccept(context: Awaited<ReturnType<typeof deployFixture>>) {
  const created = await createDefaultAgreement(context);
  await context.handsel.connect(context.beneficiary).acceptAgreement(created.agreementId);
  return created;
}

async function createAcceptAndSubmit(context: Awaited<ReturnType<typeof deployFixture>>) {
  const created = await createAndAccept(context);
  await context.handsel.connect(context.beneficiary).submitProof(created.agreementId, PROOF_URI);
  return created;
}

describe("HandselAgreement", function () {
  it("creates a proof-based agreement and transfers USDC to the contract", async function () {
    const context = await loadFixture(deployFixture);
    const handselAddress = await context.handsel.getAddress();

    const { agreementId, tx, deadline } = await createDefaultAgreement(context);

    await expect(tx)
      .to.emit(context.handsel, "AgreementCreated")
      .withArgs(
        agreementId,
        context.client.address,
        context.beneficiary.address,
        context.arbiter.address,
        context.amount,
        deadline,
        TITLE,
        CRITERIA_URI,
        METADATA_URI,
      );

    expect(await context.usdc.balanceOf(handselAddress)).to.equal(context.amount);
    expect(await context.handsel.totalVolume()).to.equal(context.amount);

    const stored = await context.handsel.getAgreement(agreementId);
    expect(stored.client).to.equal(context.client.address);
    expect(stored.beneficiary).to.equal(context.beneficiary.address);
    expect(stored.arbiter).to.equal(context.arbiter.address);
    expect(stored.title).to.equal(TITLE);
    expect(stored.criteriaURI).to.equal(CRITERIA_URI);
    expect(stored.metadataURI).to.equal(METADATA_URI);
    expect(stored.status).to.equal(0n);
  });

  it("allows the beneficiary to accept", async function () {
    const context = await loadFixture(deployFixture);
    const { agreementId } = await createDefaultAgreement(context);

    await expect(context.handsel.connect(context.beneficiary).acceptAgreement(agreementId))
      .to.emit(context.handsel, "AgreementAccepted")
      .withArgs(agreementId, context.beneficiary.address);

    const stored = await context.handsel.getAgreement(agreementId);
    expect(stored.status).to.equal(1n);
    expect(stored.acceptedAt).to.be.greaterThan(0n);
  });

  it("reverts when a non-beneficiary accepts", async function () {
    const context = await loadFixture(deployFixture);
    const { agreementId } = await createDefaultAgreement(context);

    await expect(context.handsel.connect(context.other).acceptAgreement(agreementId)).to.be.revertedWithCustomError(
      context.handsel,
      "Unauthorized",
    );
  });

  it("allows the beneficiary to submit proof", async function () {
    const context = await loadFixture(deployFixture);
    const { agreementId } = await createAndAccept(context);

    await expect(context.handsel.connect(context.beneficiary).submitProof(agreementId, PROOF_URI))
      .to.emit(context.handsel, "ProofSubmitted")
      .withArgs(agreementId, context.beneficiary.address, PROOF_URI);

    const stored = await context.handsel.getAgreement(agreementId);
    expect(stored.status).to.equal(2n);
    expect(stored.proofURI).to.equal(PROOF_URI);
    expect(stored.submittedAt).to.be.greaterThan(0n);
  });

  it("reverts when a non-beneficiary submits proof", async function () {
    const context = await loadFixture(deployFixture);
    const { agreementId } = await createAndAccept(context);

    await expect(context.handsel.connect(context.other).submitProof(agreementId, PROOF_URI)).to.be.revertedWithCustomError(
      context.handsel,
      "Unauthorized",
    );
  });

  it("allows the client to approve proof and release USDC", async function () {
    const context = await loadFixture(deployFixture);
    const { agreementId } = await createAcceptAndSubmit(context);

    await expect(context.handsel.connect(context.client).approveProof(agreementId))
      .to.emit(context.handsel, "ProofApprovedAndReleased")
      .withArgs(agreementId, context.client.address, context.beneficiary.address, context.amount)
      .and.to.changeTokenBalances(
        context.usdc,
        [context.beneficiary, context.handsel],
        [context.amount, -context.amount],
      );

    const stored = await context.handsel.getAgreement(agreementId);
    expect(stored.status).to.equal(3n);
    expect(await context.handsel.completedAgreements()).to.equal(1n);
  });

  it("reverts when a non-client approves proof", async function () {
    const context = await loadFixture(deployFixture);
    const { agreementId } = await createAcceptAndSubmit(context);

    await expect(context.handsel.connect(context.other).approveProof(agreementId)).to.be.revertedWithCustomError(
      context.handsel,
      "Unauthorized",
    );
  });

  it("keeps a manual client release path for active agreements", async function () {
    const context = await loadFixture(deployFixture);
    const { agreementId } = await createAndAccept(context);

    await expect(context.handsel.connect(context.client).releaseAgreement(agreementId))
      .to.emit(context.handsel, "AgreementReleased")
      .withArgs(agreementId, context.client.address, context.beneficiary.address, context.amount);

    const stored = await context.handsel.getAgreement(agreementId);
    expect(stored.status).to.equal(3n);
  });

  it("allows client or beneficiary to open a dispute from Active", async function () {
    const context = await loadFixture(deployFixture);
    const first = await createAndAccept(context);

    await expect(context.handsel.connect(context.client).openDispute(first.agreementId))
      .to.emit(context.handsel, "AgreementDisputed")
      .withArgs(first.agreementId, context.client.address);

    const second = await createAndAccept(context);

    await expect(context.handsel.connect(context.beneficiary).openDispute(second.agreementId))
      .to.emit(context.handsel, "AgreementDisputed")
      .withArgs(second.agreementId, context.beneficiary.address);

    expect(await context.handsel.disputedAgreements()).to.equal(2n);
  });

  it("allows client or beneficiary to open a dispute from Submitted", async function () {
    const context = await loadFixture(deployFixture);
    const { agreementId } = await createAcceptAndSubmit(context);

    await expect(context.handsel.connect(context.client).openDispute(agreementId))
      .to.emit(context.handsel, "AgreementDisputed")
      .withArgs(agreementId, context.client.address);

    const stored = await context.handsel.getAgreement(agreementId);
    expect(stored.status).to.equal(4n);
  });

  it("allows the arbiter to split disputed funds", async function () {
    const context = await loadFixture(deployFixture);
    const { agreementId } = await createAcceptAndSubmit(context);
    await context.handsel.connect(context.client).openDispute(agreementId);

    const clientAmount = ethers.parseUnits("25", 6);
    const beneficiaryAmount = ethers.parseUnits("75", 6);

    await expect(context.handsel.connect(context.arbiter).resolveDispute(agreementId, 2500, 7500)).to.changeTokenBalances(
      context.usdc,
      [context.client, context.beneficiary, context.handsel],
      [clientAmount, beneficiaryAmount, -context.amount],
    );

    const stored = await context.handsel.getAgreement(agreementId);
    expect(stored.status).to.equal(5n);
  });

  it("reverts when a non-arbiter resolves", async function () {
    const context = await loadFixture(deployFixture);
    const { agreementId } = await createAcceptAndSubmit(context);
    await context.handsel.connect(context.client).openDispute(agreementId);

    await expect(context.handsel.connect(context.other).resolveDispute(agreementId, 5000, 5000)).to.be.revertedWithCustomError(
      context.handsel,
      "Unauthorized",
    );
  });

  it("reverts for an invalid dispute split", async function () {
    const context = await loadFixture(deployFixture);
    const { agreementId } = await createAcceptAndSubmit(context);
    await context.handsel.connect(context.client).openDispute(agreementId);

    await expect(context.handsel.connect(context.arbiter).resolveDispute(agreementId, 9000, 999)).to.be.revertedWithCustomError(
      context.handsel,
      "InvalidSplit",
    );
  });

  it("refunds an expired created agreement", async function () {
    const context = await loadFixture(deployFixture);
    const deadline = (await time.latest()) + DAY;
    const { agreementId } = await createDefaultAgreement(context, deadline);

    await time.increaseTo(deadline + 1);

    await expect(context.handsel.connect(context.beneficiary).refundExpired(agreementId)).to.changeTokenBalances(
      context.usdc,
      [context.client, context.handsel],
      [context.amount, -context.amount],
    );

    const stored = await context.handsel.getAgreement(agreementId);
    expect(stored.status).to.equal(6n);
  });

  it("refunds an expired active agreement", async function () {
    const context = await loadFixture(deployFixture);
    const deadline = (await time.latest()) + DAY;
    const { agreementId } = await createDefaultAgreement(context, deadline);
    await context.handsel.connect(context.beneficiary).acceptAgreement(agreementId);

    await time.increaseTo(deadline + 1);

    await expect(context.handsel.connect(context.client).refundExpired(agreementId)).to.changeTokenBalances(
      context.usdc,
      [context.client, context.handsel],
      [context.amount, -context.amount],
    );
  });

  it("allows the client to cancel an unaccepted agreement", async function () {
    const context = await loadFixture(deployFixture);
    const { agreementId } = await createDefaultAgreement(context);

    await expect(context.handsel.connect(context.client).cancelUnaccepted(agreementId)).to.changeTokenBalances(
      context.usdc,
      [context.client, context.handsel],
      [context.amount, -context.amount],
    );

    const stored = await context.handsel.getAgreement(agreementId);
    expect(stored.status).to.equal(7n);
  });

  it("reverts for zero addresses, zero amount, and invalid deadline", async function () {
    const context = await loadFixture(deployFixture);
    const deadline = (await time.latest()) + DAY;

    await expect(
      context.handsel.connect(context.client).createAgreement(
        ethers.ZeroAddress,
        context.arbiter.address,
        context.amount,
        deadline,
        TITLE,
        CRITERIA_URI,
        METADATA_URI,
      ),
    ).to.be.revertedWithCustomError(context.handsel, "ZeroAddress");

    await expect(
      context.handsel.connect(context.client).createAgreement(
        context.beneficiary.address,
        ethers.ZeroAddress,
        context.amount,
        deadline,
        TITLE,
        CRITERIA_URI,
        METADATA_URI,
      ),
    ).to.be.revertedWithCustomError(context.handsel, "ZeroAddress");

    await expect(
      context.handsel.connect(context.client).createAgreement(
        context.beneficiary.address,
        context.arbiter.address,
        0,
        deadline,
        TITLE,
        CRITERIA_URI,
        METADATA_URI,
      ),
    ).to.be.revertedWithCustomError(context.handsel, "ZeroAmount");

    await expect(
      context.handsel.connect(context.client).createAgreement(
        context.beneficiary.address,
        context.arbiter.address,
        context.amount,
        await time.latest(),
        TITLE,
        CRITERIA_URI,
        METADATA_URI,
      ),
    ).to.be.revertedWithCustomError(context.handsel, "InvalidDeadline");
  });
});
