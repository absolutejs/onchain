// The provider-agnostic core. Compose any adapters into one `claim` flow: the single,
// guarded path to genuine ownership. There is intentionally NO "mint without earning" —
// claim always requires an Attestation tied to a verifiable fact.
import type { MintReceipt, OnchainAdapters } from "./adapter-kit/index";

export type ClaimInput = {
  seed: string;       // the asset (deterministic creature/item seed)
  fact: string;       // the verifiable real interaction it's earned from (e.g. github:commit:repo@sha)
  archetype: string;  // edition bucket ("wild-creature", "crate:season1", ...)
  maxSupply?: number; // omit ⇒ open edition; 1 ⇒ a literal 1-of-1; N ⇒ limited "#k of N"
  soulbound?: boolean; // default true (earned, non-transferable)
};

// LITERAL edition string — never a probability. "1 of 1", or "#3 of 50".
export const edition = (r: { serial: number; supply: number }) =>
  r.supply === 1 ? "1 of 1" : `#${r.serial} of ${r.supply}`;

export const createOnchain = (adapters: OnchainAdapters) => ({
  adapters,

  // earn → attest (verifies the fact) → mint (soulbound, real serial). Throws if the seed
  // is already owned or the fact can't be verified. This is the only way to truly own one.
  async claim(userId: string, input: ClaimInput): Promise<MintReceipt> {
    if (await adapters.mint.isSeedUsed(input.seed)) throw new Error("onchain: already claimed");
    const { address } = await adapters.wallet.ensureWallet(userId);
    const att = await adapters.attester.attest({ subject: address, seed: input.seed, fact: input.fact, archetype: input.archetype, issuedAt: Date.now() });
    return adapters.mint.mint(att, { maxSupply: input.maxSupply, soulbound: input.soulbound ?? true });
  },

  async owns(seed: string): Promise<boolean> {
    return adapters.mint.isSeedUsed(seed);
  },

  async inventory(userId: string): Promise<MintReceipt[]> {
    const address = await adapters.wallet.addressFor(userId);
    return address ? adapters.mint.ownedBy(address) : [];
  }
});

export type Onchain = ReturnType<typeof createOnchain>;
