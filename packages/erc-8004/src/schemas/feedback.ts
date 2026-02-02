import { z } from "zod";

/**
 * ERC-8004 Raw Feedback File Schema
 * For parsing raw feedback files fetched from IPFS/URIs
 *
 * Spec: https://github.com/erc-8004/erc-8004-contracts/blob/093d7b91eb9c22048d411896ed397d695742a5f8/ERC8004SPEC.md#off-chain-feedback-file-structure
 */

// =============================================================================
// Building Block Schemas
// =============================================================================

/**
 * Optional number schema - accepts string or number, transforms to number or null
 * Used for chainId which may come as string from JSON
 */
const ChainIdSchema = z
  .union([z.string(), z.number()])
  .transform((val) => {
    if (typeof val === "string" && val.trim() === "") return null;
    const num = Number(val);
    return Number.isNaN(num) || !Number.isInteger(num) || num < 0 ? null : num;
  })
  .nullish();

/**
 * Simplified proof of payment schema per ERC-8004 spec
 * Only includes: fromAddress, toAddress, chainId, txHash
 */
const ProofOfPaymentSchema = z
  .object({
    fromAddress: z.string().nullish(),
    toAddress: z.string().nullish(),
    chainId: ChainIdSchema,
    txHash: z.string().nullish(),
  })
  .nullish();

/**
 * MCP reference schema - references specific MCP capabilities used
 */
const McpSchema = z
  .object({
    tool: z.string().nullish(),
    prompt: z.string().nullish(),
    resource: z.string().nullish(),
  })
  .nullish();

/**
 * A2A reference schema - references A2A skills and context
 */
const A2aSchema = z
  .object({
    skills: z.array(z.string()).nullish(),
    contextId: z.string().nullish(),
    taskId: z.string().nullish(),
  })
  .nullish();

/**
 * OASF reference schema - references OASF skills and domains
 */
const OasfSchema = z
  .object({
    skills: z.array(z.string()).nullish(),
    domains: z.array(z.string()).nullish(),
  })
  .nullish();

// =============================================================================
// Main Schema
// =============================================================================

/**
 * Raw Feedback File Schema per ERC-8004 spec
 *
 * MUST fields (required):
 * - agentRegistry: CAIP-19 identifier for the agent registry
 * - agentId: Numeric agent ID (allow for string that can be parsed to number)
 * - clientAddress: CAIP-10 address of the feedback submitter
 * - createdAt: ISO 8601 timestamp
 * - value: Feedback value (int128, stored as bigint) - OR score for backward compatibility
 * - valueDecimals: Decimal precision for value (defaults to 0 if score is used)
 *
 * Optional fields:
 * - tag1, tag2: Tags for categorization
 * - endpoint: The specific endpoint being reviewed
 * - mcp: MCP capability reference (tool, prompt, resource)
 * - a2a: A2A reference (skills, contextId, taskId)
 * - oasf: OASF reference (skills, domains)
 * - proofOfPayment: Transaction proof for x402 (fromAddress, toAddress, chainId, txHash)
 */
export const RawFeedbackFileSchema = z
  .object({
    // MUST fields (required per spec)
    agentRegistry: z.string(),
    agentId: z
      .union([z.string().trim().regex(/^\d+$/), z.number()])
      .transform((val) => Number(val))
      .pipe(z.number().int().nonnegative()),
    clientAddress: z.string(),
    createdAt: z.iso.datetime(),

    // Value fields - either value/valueDecimals OR score (backward compatibility)
    // On-chain type is int128; accept string/number/bigint and coerce to bigint
    value: z
      .union([z.string(), z.number(), z.bigint()])
      .transform((val) => BigInt(val))
      .optional(),
    valueDecimals: z.number().int().nonnegative().optional(),
    score: z.number().optional(), // Legacy field, maps to value with valueDecimals=0

    // Optional fields
    tag1: z.string().nullish(),
    tag2: z.string().nullish(),
    endpoint: z.url({ normalize: true }).nullish(),

    // Capability references
    mcp: McpSchema,
    a2a: A2aSchema,
    oasf: OasfSchema,

    // Proof of payment (x402)
    proofOfPayment: ProofOfPaymentSchema,
  })
  .loose()
  .transform((data) => {
    // value/valueDecimals take precedence; score is backward-compat fallback
    const value = data.value ?? (data.score !== undefined ? BigInt(data.score) : undefined);
    const valueDecimals = data.valueDecimals ?? (data.score !== undefined ? 0 : undefined);
    return {
      ...data,
      value,
      valueDecimals,
    };
  })
  .refine((data) => data.value !== undefined, {
    message: "Either value/valueDecimals or score is required",
  })
  .refine((data) => data.value === undefined || data.valueDecimals !== undefined, {
    message: "valueDecimals is required when using value",
  });

// =============================================================================
// Types
// =============================================================================

export type ProofOfPayment = z.infer<typeof ProofOfPaymentSchema>;
export type Mcp = z.infer<typeof McpSchema>;
export type A2a = z.infer<typeof A2aSchema>;
export type Oasf = z.infer<typeof OasfSchema>;
export type RawFeedbackFile = z.infer<typeof RawFeedbackFileSchema>;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse a feedback file with validation
 * Returns success: false if MUST fields are missing
 */
export function parseRawFeedbackFile(data: unknown) {
  return RawFeedbackFileSchema.safeParse(data);
}
