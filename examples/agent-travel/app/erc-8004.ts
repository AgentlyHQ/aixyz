import type { ERC8004Registration } from "aixyz/erc-8004";

const metadata: ERC8004Registration = {
  /**
   * `aixyz erc-8004 register` will write to this field.
   */
  registrations: [
    {
      agentId: 23067,
      agentRegistry: "eip155:1:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    },
  ],
  supportedTrust: ["reputation"],
};

/**
 * Declaring `export default registration`, two endpoints will be available:
 *
 * GET /_aixyz/erc-8004.json
 * GET /.well-known/erc-8004.json
 */
export default metadata;
