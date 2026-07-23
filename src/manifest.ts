import {
  defineImplementation,
  defineManifest,
  toolFactory,
} from "@absolutejs/manifest";
import { Type } from "@sinclair/typebox";
import type { OnchainAdapters } from "./adapter-kit/index";
import type { Onchain } from "./core";

export type OnchainToolRuntime = {
  onchain: Onchain;
  /** Authorized owner; never supplied by a tool caller. */
  userId: string;
};

const tool = toolFactory<OnchainToolRuntime>();

/* createOnchain's config is OnchainAdapters — entirely instance-valued
 * (wallet, attester, mint, randomness), so it is one $self slot and there
 * are no serializable settings. */
export const manifest = defineManifest<OnchainAdapters, OnchainToolRuntime>()({
  contract: 2,
  identity: {
    accent: "#7c3aed",
    category: "web3",
    description:
      "Optional on-chain provenance with taste: attested earning, literal editions, immutable origin ownership, and auditable application-controlled transfers while users stay gasless and walletless. Badges may remain soulbound; market items opt into transfers. Public provenance records ownership and settlement references, never payment or identity data.",
    docsUrl: "https://github.com/absolutejs/onchain",
    name: "@absolutejs/onchain",
    tagline: "Earn it, own it, trade it—with provenance intact.",
  },
  implements: [
    defineImplementation<{ file?: string }>()({
      contract: "onchain/adapters",
      factory: "localAdapter",
      from: "@absolutejs/onchain",
      settings: Type.Object({
        file: Type.Optional(
          Type.String({
            description:
              "File the local ledger persists to. Leave empty for in-memory only (lost on restart).",
            examples: ["./var/onchain-ledger.json"],
            title: "Ledger file",
          }),
        ),
      }),
      title:
        "Local (zero-setup, off-chain — attestations are trusted, for development)",
      wiring: {
        code: "localAdapter(${settings})",
        imports: [{ from: "@absolutejs/onchain", names: ["localAdapter"] }],
      },
    }),
  ],
  settings: Type.Object({}),
  slots: {
    adapters: {
      configPath: "$self",
      contract: "onchain/adapters",
      description:
        "Which chain backs your collectibles (local off-chain for dev, a real chain in production)",
      known: ["@absolutejs/onchain#local", "@absolutejs/onchain-base"],
      required: true,
    },
  },
  tools: {
    check_owned: tool.runtime({
      annotations: { idempotentHint: true, openWorldHint: true },
      authorization: {
        approval: "never",
        audience: "authenticated",
        destinations: ["configured-onchain-adapter"],
        effects: ["read", "external-network"],
        idempotency: { mode: "host" },
        requiredScopes: ["collectibles:read"],
        resource: { idField: "seed", type: "collectible-seed" },
        reversible: false,
      },
      description:
        'Whether a collectible seed has already been claimed. Each seed mints exactly once, so this answers both "is it taken?" and "can it still be earned?".',
      handler: async ({ seed }, runtime) =>
        (await runtime.onchain.owns(seed))
          ? `seed "${seed}" is already claimed`
          : `seed "${seed}" is unclaimed`,
      input: Type.Object({
        seed: Type.String({ minLength: 1 }),
      }),
    }),
    claim_collectible: tool.runtime({
      annotations: { idempotentHint: true, openWorldHint: true },
      authorization: {
        approval: "policy",
        audience: "owner",
        destinations: ["configured-onchain-adapter"],
        effects: ["write", "external-network"],
        idempotency: { mode: "resource" },
        requiredScopes: ["collectibles:claim"],
        resource: { idField: "seed", type: "collectible-seed" },
        reversible: false,
      },
      description:
        "Claim (mint) an earned collectible for a user: the attester verifies the fact against its source of truth, then mints a soulbound token with a real edition serial. Fails if the seed is already claimed or the fact cannot be verified — there is no mint-without-earning path.",
      handler: async (
        { archetype, fact, maxSupply, seed, soulbound },
        runtime,
      ) => {
        const receipt = await runtime.onchain.claim(runtime.userId, {
          archetype,
          fact,
          seed,
          ...(maxSupply !== undefined ? { maxSupply } : {}),
          ...(soulbound !== undefined ? { soulbound } : {}),
        });

        return JSON.stringify(receipt);
      },
      input: Type.Object({
        archetype: Type.String({
          description:
            'Edition bucket the collectible belongs to, e.g. "wild-creature" or "crate:season1".',
          minLength: 1,
        }),
        fact: Type.String({
          description:
            'The externally verifiable event this is earned from, e.g. "github:commit:owner/repo@sha".',
          minLength: 1,
        }),
        maxSupply: Type.Optional(
          Type.Integer({
            description:
              'Edition cap: 1 = a literal 1-of-1, N = limited "#k of N". Omit for an open edition.',
            minimum: 1,
          }),
        ),
        seed: Type.String({
          description:
            "The deterministic asset seed — the asset itself. Mints exactly once.",
          minLength: 1,
        }),
        soulbound: Type.Optional(
          Type.Boolean({
            description:
              "Non-transferable (default true — earned, not bought).",
          }),
        ),
      }),
    }),
    user_inventory: tool.runtime({
      annotations: { idempotentHint: true, openWorldHint: true },
      authorization: {
        approval: "never",
        audience: "owner",
        destinations: ["configured-onchain-adapter"],
        effects: ["read", "external-network"],
        idempotency: { mode: "host" },
        requiredScopes: ["collectibles:read"],
        reversible: false,
      },
      description:
        "Every collectible a user owns: token id, archetype, seed, literal edition (serial of supply), and mint time.",
      handler: async (_input, runtime) => {
        const receipts = await runtime.onchain.inventory(runtime.userId);

        return receipts.length === 0
          ? "the authorized user owns no collectibles"
          : JSON.stringify(receipts);
      },
      input: Type.Object({}),
    }),
    transfer_collectible: tool.runtime({
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      authorization: {
        approval: "always",
        audience: "owner",
        destinationFields: ["toUserId"],
        destinations: ["configured-onchain-adapter"],
        effects: ["transfer", "write", "external-network"],
        idempotency: { field: "settlementRef", mode: "field" },
        requiredScopes: ["collectibles:transfer"],
        resource: { idField: "tokenId", type: "collectible" },
        reversible: false,
      },
      description:
        "Transfer a marketable collectible after the application has atomically settled its sale, trade, gift, or recovery. The settlement reference makes retries idempotent and becomes public provenance.",
      handler: async ({ reason, settlementRef, toUserId, tokenId }, runtime) =>
        JSON.stringify(
          await runtime.onchain.transfer(runtime.userId, toUserId, {
            tokenId,
            reason,
            settlementRef,
          }),
        ),
      input: Type.Object({
        toUserId: Type.String({ minLength: 1 }),
        tokenId: Type.String({ minLength: 1 }),
        settlementRef: Type.String({ minLength: 1 }),
        reason: Type.Union([
          Type.Literal("sale"),
          Type.Literal("trade"),
          Type.Literal("gift"),
          Type.Literal("recovery"),
        ]),
      }),
    }),
    collectible_provenance: tool.runtime({
      annotations: { idempotentHint: true, openWorldHint: true },
      authorization: {
        approval: "never",
        audience: "authenticated",
        destinations: ["configured-onchain-adapter"],
        effects: ["read", "external-network"],
        idempotency: { mode: "host" },
        requiredScopes: ["collectibles:read"],
        resource: { idField: "tokenId", type: "collectible" },
        reversible: false,
      },
      description:
        "Read the ordered mint and transfer history for a collectible, including its immutable original owner.",
      handler: async ({ tokenId }, runtime) =>
        JSON.stringify(await runtime.onchain.provenance(tokenId)),
      input: Type.Object({ tokenId: Type.String({ minLength: 1 }) }),
    }),
  },
  wiring: [
    {
      description:
        "claim() is the only path to ownership: earn → attest (verify the fact) → mint. Swap the adapter slot to move from off-chain dev to a real chain without touching app code.",
      id: "default",
      server: {
        code: "const onchain = createOnchain(${slot.adapters});",
        imports: [{ from: "@absolutejs/onchain", names: ["createOnchain"] }],
        placement: "module-scope",
      },
      title: "Create the onchain claim flow",
    },
  ],
});
