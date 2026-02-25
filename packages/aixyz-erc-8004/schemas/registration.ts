import { z } from "zod";

/**
 * ERC-8004 Raw Agent Registration File Schema
 * For parsing raw registration files fetched from IPFS/URIs
 *
 * Based on: https://github.com/erc-8004/erc-8004-contracts/blob/093d7b91eb9c22048d411896ed397d695742a5f8/ERC8004SPEC.md#agent-uri-and-agent-registration-file
 */

export const ERC8004_REGISTRATION_TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";

/**
 * Supported trust mechanisms for agent validation
 */
export const TrustMechanismSchema = z.enum([
  "reputation",
  "crypto-economic",
  "tee-attestation",
  "social",
  "governance",
]);

/**
 * Service/Endpoint - represents a single service endpoint
 * Examples: MCP server, A2A endpoint, web interface, OASF spec
 */
export const ServiceSchema = z.object({
  name: z.string(),
  endpoint: z.url(),
  version: z.string().optional(),
  // OASF-specific fields
  skills: z.array(z.string()).optional(),
  domains: z.array(z.string()).optional(),
  // MCP-specific fields
  tools: z.array(z.string()).optional(),
  prompts: z.array(z.string()).optional(),
  resources: z.array(z.string()).optional(),
});

/**
 * Registration entry - links to agent registrations on other chains
 * Format: { agentId: "123", agentRegistry: "eip155:1:0x..." }
 */
export const RegistrationEntrySchema = z.object({
  agentId: z
    .union([z.string().trim().regex(/^\d+$/), z.number()])
    .transform((val) => Number(val))
    .pipe(z.number().int().nonnegative()),
  agentRegistry: z.string(),
});

/**
 * Raw Agent Registration File Schema
 * For parsing registration files fetched from IPFS/URIs
 */
export const AgentRegistrationFileSchema = z.object({
  // Schema identifiers
  type: z.string().optional(),
  $schema: z.string().optional(),

  // ERC-721 metadata compatibility (required)
  name: z.string(),
  description: z.string(),
  image: z.string(),

  // Service endpoints
  services: z.array(ServiceSchema).optional(),
  endpoints: z.array(ServiceSchema).optional(), // Legacy field name

  // Agent configuration
  active: z.boolean().optional(),
  x402support: z.boolean().optional(),
  x402Support: z.boolean().optional(), // Alternative casing

  // Cross-chain & identity
  registrations: z.array(RegistrationEntrySchema).optional(),
  supportedTrust: z.array(z.string()).optional(),
  ens: z.string().optional(),
  did: z.string().optional(),
});

/**
 * Strict Schema - for creating new registration files
 * Requires correct type literal and at least one service
 */
export const StrictAgentRegistrationFileSchema = AgentRegistrationFileSchema.extend({
  type: z.literal(ERC8004_REGISTRATION_TYPE),
  services: z.array(ServiceSchema).min(1, "At least one service endpoint is required"),
});

export type TrustMechanism = z.infer<typeof TrustMechanismSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type RegistrationEntry = z.infer<typeof RegistrationEntrySchema>;
export type AgentRegistrationFile = z.infer<typeof AgentRegistrationFileSchema>;
export type StrictAgentRegistrationFile = z.infer<typeof StrictAgentRegistrationFileSchema>;

/**
 * Get services from a registration file
 * Handles both `services` (new) and `endpoints` (legacy) field names
 * @default TODO: parse and merge both fields
 */
export function getServices(file: AgentRegistrationFile | StrictAgentRegistrationFile): Service[] {
  return file.services ?? file.endpoints ?? [];
}

/**
 * Check if agent supports x402 payment protocol
 * Handles both `x402support` and `x402Support` casing variants
 * @deprecated TODO: parse and merge both fields
 */
export function hasX402Support(file: AgentRegistrationFile | StrictAgentRegistrationFile): boolean {
  return file.x402support === true || file.x402Support === true;
}
