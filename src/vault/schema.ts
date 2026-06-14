// Zod schemas for runtime validation of decrypted vault payloads and the
// encrypted file envelope (defends against corrupt/incompatible files, PRD 10).

import { z } from "zod";
import { VAULT_FORMAT_VERSION } from "@/lib/types";

export const credentialItemSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  username: z.string(),
  password: z.string(),
  url: z.string(),
  notes: z.string(),
  tags: z.array(z.string()),
  favorite: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const vaultDataSchema = z.object({
  version: z.number().int().positive(),
  items: z.array(credentialItemSchema),
});

const kdfParamsSchema = z.object({
  alg: z.enum(["argon2id", "pbkdf2-sha256"]),
  memKiB: z.number().int().positive().optional(),
  iterations: z.number().int().positive(),
  parallelism: z.number().int().positive().optional(),
  salt: z.string().min(1),
});

const aesGcmBlobSchema = z.object({
  alg: z.literal("AES-GCM"),
  iv: z.string().min(1),
  ct: z.string().min(1),
});

const keyEnvelopeSchema = aesGcmBlobSchema.extend({ kdf: kdfParamsSchema });

export const encryptedVaultFileSchema = z.object({
  format: z.literal(VAULT_FORMAT_VERSION),
  schema: z.number().int().positive(),
  envelopes: z.object({
    masterPassword: keyEnvelopeSchema,
    recoveryKey: keyEnvelopeSchema,
  }),
  body: aesGcmBlobSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  vectorClock: z.number().int().nonnegative(),
});
