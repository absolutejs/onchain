import { describe, expect, test } from "bun:test";
import { createOnchain, edition, localAdapter } from "../src/index";

describe("onchain core + local adapter", () => {
  test("claim mints a real 1-of-1 — a literal edition, soulbound, earned", async () => {
    const oc = createOnchain(localAdapter());
    const r = await oc.claim("alice", { seed: "seed:unique:1", fact: "github:commit:acme/app@abc", archetype: "wild-creature", maxSupply: 1 });
    expect(edition(r)).toBe("1 of 1");
    expect(r.serial).toBe(1);
    expect(r.supply).toBe(1);
    expect(r.soulbound).toBe(true);
  });

  test("limited editions get literal serials (#k of N), never a probability", async () => {
    const oc = createOnchain(localAdapter());
    const a = await oc.claim("a", { seed: "s1", fact: "f1", archetype: "crate:season1", maxSupply: 50 });
    const b = await oc.claim("b", { seed: "s2", fact: "f2", archetype: "crate:season1", maxSupply: 50 });
    expect(edition(a)).toBe("#1 of 50");
    expect(edition(b)).toBe("#2 of 50");
  });

  test("a seed mints exactly once — no dupes, no re-pull", async () => {
    const oc = createOnchain(localAdapter());
    await oc.claim("a", { seed: "dup", fact: "f", archetype: "x", maxSupply: 1 });
    expect(oc.claim("b", { seed: "dup", fact: "f", archetype: "x", maxSupply: 1 })).rejects.toThrow();
    expect(await oc.owns("dup")).toBe(true);
  });

  test("mint refuses a tampered / forged attestation", async () => {
    const ad = localAdapter();
    const forged = { subject: "0xhacker", seed: "s", fact: "f", archetype: "x", issuedAt: Date.now(), signature: "deadbeef" };
    expect(ad.mint.mint(forged, { maxSupply: 1 })).rejects.toThrow(/invalid attestation/);
  });

  test("inventory lists what you earned", async () => {
    const oc = createOnchain(localAdapter());
    await oc.claim("carol", { seed: "c1", fact: "f", archetype: "wild-creature", maxSupply: 1 });
    const inv = await oc.inventory("carol");
    expect(inv).toHaveLength(1);
    expect(inv[0]!.seed).toBe("c1");
  });

  test("marketable assets transfer idempotently and preserve their original owner", async () => {
    const oc = createOnchain(localAdapter());
    const minted = await oc.claim("alice", { seed: "market:1", fact: "earned:1", archetype: "genesis", maxSupply: 50, soulbound: false });
    const input = { tokenId: minted.tokenId, reason: "sale" as const, settlementRef: "sale:123" };
    const first = await oc.transfer("alice", "bob", input);
    const retry = await oc.transfer("alice", "bob", input);
    expect(retry.transferredAt).toBe(first.transferredAt);
    expect((await oc.inventory("bob"))[0]!.originOwner).toBe(minted.owner);
    expect(await oc.provenance(minted.tokenId)).toEqual([
      expect.objectContaining({ sequence: 1, kind: "mint", reason: "earned" }),
      expect.objectContaining({ sequence: 2, kind: "transfer", reason: "sale", settlementRef: "sale:123" }),
    ]);
  });

  test("soulbound earned assets still refuse transfer", async () => {
    const oc = createOnchain(localAdapter());
    const minted = await oc.claim("alice", { seed: "bound:1", fact: "earned:2", archetype: "badge" });
    await expect(oc.transfer("alice", "bob", { tokenId: minted.tokenId, reason: "gift", settlementRef: "gift:1" })).rejects.toThrow(/soulbound/);
  });
});
