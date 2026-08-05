import assert from "node:assert/strict";
import test from "node:test";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { decodeHandselEvent, handselAbi } from "../src/handsel.js";

test("decodes an indexed agreement acceptance", () => {
  const topics = encodeEventTopics({
    abi: handselAbi,
    eventName: "AgreementAccepted",
    args: {
      agreementId: 42n,
      beneficiary: "0x1000000000000000000000000000000000000001",
    },
  });
  const decoded = decodeHandselEvent(topics, "0x");

  assert.equal(decoded.agreementId, "42");
  assert.equal(decoded.eventName, "AgreementAccepted");
  assert.equal(decoded.args.agreementId, "42");
});

test("decodes proof metadata into JSON-safe event args", () => {
  const topics = encodeEventTopics({
    abi: handselAbi,
    eventName: "ProofSubmitted",
    args: {
      agreementId: 7n,
      beneficiary: "0x2000000000000000000000000000000000000002",
    },
  });
  const data = encodeAbiParameters([{ type: "string" }], ["https://example.com/proof"]);
  const decoded = decodeHandselEvent(topics, data);

  assert.equal(decoded.agreementId, "7");
  assert.equal(decoded.args.proofURI, "https://example.com/proof");
});
