import {
  defineImplementation,
  defineManifest,
  toolFactory,
} from "@absolutejs/manifest";
import { Type } from "@sinclair/typebox";
import type { OnchainAdapters } from "./adapter-kit/index";
import type { Onchain } from "./core";

const tool = toolFactory<Onchain>();

/* createOnchain's config is OnchainAdapters — entirely instance-valued
 * (wallet, attester, mint, randomness), so it is one $self slot and there
 * are no serializable settings. */
export const manifest = defineManifest<OnchainAdapters, Onchain>()({
  contract: 1,
  identity: {
    accent: "#7c3aed",
    category: "web3",
    description:
      "Optional on-chain provenance with taste: earned (never bought) soulbound collectibles where the deterministic seed IS the asset, editions are literal (\"#3 of 50\", never a probability), and users stay gasless and walletless. The single `claim` flow requires an Attestation tied to an externally verifiable fact — ownership cannot be faked or forced, even by the app operator. Ships a zero-setup local adapter; real chains ride `@absolutejs/onchain-*` adapters.",
    docsUrl: "https://github.com/absolutejs/onchain",
    name: "@absolutejs/onchain",
    tagline: "Let players truly own what they earn — no crypto hassle.",
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
      annotations: { openWorldHint: true, readOnlyHint: true },
      description:
        "Whether a collectible seed has already been claimed. Each seed mints exactly once, so this answers both \"is it taken?\" and \"can it still be earned?\".",
      handler: async ({ seed }, onchain) =>
        (await onchain.owns(seed))
          ? `seed "${seed}" is already claimed`
          : `seed "${seed}" is unclaimed`,
      input: Type.Object({
        seed: Type.String({ minLength: 1 }),
      }),
    }),
    claim_collectible: tool.runtime({
      annotations: { openWorldHint: true },
      description:
        "Claim (mint) an earned collectible for a user: the attester verifies the fact against its source of truth, then mints a soulbound token with a real edition serial. Fails if the seed is already claimed or the fact cannot be verified — there is no mint-without-earning path.",
      handler: async (
        { archetype, fact, maxSupply, seed, soulbound, userId },
        onchain,
      ) => {
        const receipt = await onchain.claim(userId, {
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
              "Edition cap: 1 = a literal 1-of-1, N = limited \"#k of N\". Omit for an open edition.",
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
            description: "Non-transferable (default true — earned, not bought).",
          }),
        ),
        userId: Type.String({
          description: "The app user earning the collectible.",
          minLength: 1,
        }),
      }),
    }),
    user_inventory: tool.runtime({
      annotations: { openWorldHint: true, readOnlyHint: true },
      description:
        "Every collectible a user owns: token id, archetype, seed, literal edition (serial of supply), and mint time.",
      handler: async ({ userId }, onchain) => {
        const receipts = await onchain.inventory(userId);

        return receipts.length === 0
          ? `user "${userId}" owns no collectibles`
          : JSON.stringify(receipts);
      },
      input: Type.Object({
        userId: Type.String({ minLength: 1 }),
      }),
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
