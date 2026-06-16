// The built-in LOCAL adapter — a complete, in-memory (optionally file-backed) implementation
// of the contract. Use it for development, tests, and fully off-chain play: real editions,
// seed uniqueness, soulbound-by-construction (there is no transfer method). It is the only
// adapter you can run with zero setup.
//
// ⚠️ Integrity note: the local Attester does NOT independently verify `fact` (it trusts the
// caller and signs with a local key you control) — so it is fakeable BY DESIGN, for dev only.
// Un-forgeable ownership ("can't be faked even by us") requires a real adapter
// (@absolutejs/onchain-base) whose Attester re-checks `fact` against the source of truth
// (e.g. the GitHub commit actually exists and you authored it) before signing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Attestation, Attester, MintProvider, MintReceipt, OnchainAdapters, RandomnessProvider, WalletProvider } from "./adapter-kit/index";

const fnv = (str: string) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, "0"); };
const hashHex = (str: string) => fnv(str) + fnv(str + "1") + fnv(str + "2") + fnv(str + "3");   // 32 hex chars

type Ledger = { receipts: Record<string, MintReceipt>; seeds: Record<string, string>; counts: Record<string, number> };

export const localAdapter = (opts: { file?: string; attesterKey?: string } = {}): OnchainAdapters => {
  const key = opts.attesterKey ?? "local-dev-key";
  const load = (): Ledger => { try { return JSON.parse(readFileSync(opts.file!, "utf8")); } catch { return { receipts: {}, seeds: {}, counts: {} }; } };
  const save = (l: Ledger) => { if (!opts.file) return; try { mkdirSync(dirname(opts.file), { recursive: true }); writeFileSync(opts.file, JSON.stringify(l)); } catch {} };
  const mem: Ledger = opts.file ? load() : { receipts: {}, seeds: {}, counts: {} };

  const wallet: WalletProvider = {
    id: "local",
    ensureWallet: async (userId) => ({ address: `0xL${hashHex(userId)}` }),
    addressFor: async (userId) => `0xL${hashHex(userId)}`
  };

  const attester: Attester = {
    id: "local",
    attest: async (input) => ({ ...input, signature: hashHex(`${input.subject}|${input.seed}|${input.fact}|${input.archetype}|${input.issuedAt}|${key}`) }),
    verify: async (att) => att.signature === hashHex(`${att.subject}|${att.seed}|${att.fact}|${att.archetype}|${att.issuedAt}|${key}`)
  };

  const mint: MintProvider = {
    id: "local",
    mint: async (att, mintOpts) => {
      if (!(await attester.verify(att))) throw new Error("onchain: invalid attestation (refusing to mint)");
      if (mem.seeds[att.seed]) throw new Error("onchain: seed already minted (each is one-and-done)");
      const serial = (mem.counts[att.archetype] ?? 0) + 1;
      const supply = mintOpts.maxSupply ?? serial;             // no cap ⇒ open edition (supply = count so far)
      if (mintOpts.maxSupply !== undefined && serial > mintOpts.maxSupply) throw new Error("onchain: edition sold out");
      mem.counts[att.archetype] = serial;
      const tokenId = `${att.archetype}#${serial}`;
      const receipt: MintReceipt = { tokenId, archetype: att.archetype, seed: att.seed, owner: att.subject, serial, supply, soulbound: mintOpts.soulbound ?? true, mintedAt: Date.now() };
      mem.receipts[tokenId] = receipt; mem.seeds[att.seed] = tokenId; save(mem);
      return receipt;
    },
    ownerOf: async (tokenId) => mem.receipts[tokenId]?.owner ?? null,
    isSeedUsed: async (seed) => Boolean(mem.seeds[seed]),
    ownedBy: async (owner) => Object.values(mem.receipts).filter((r) => r.owner === owner)
  };

  const randomness: RandomnessProvider = {
    id: "local",
    random: async (salt) => ({ value: BigInt(`0x${hashHex(salt)}`) })
  };

  return { wallet, attester, mint, randomness };
};
