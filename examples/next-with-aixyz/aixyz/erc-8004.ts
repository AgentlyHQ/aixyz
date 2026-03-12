import type { ERC8004Registration } from "aixyz/erc-8004";

const metadata: ERC8004Registration = {
  /**
   * `aixyz erc-8004 register` will write to this field.
   */
  registrations: [],
  supportedTrust: ["reputation"],
};

/**
 * Declaring `export default registration`, two endpoints will be available:
 *
 * GET /_aixyz/erc-8004.json
 * GET /.well-known/erc-8004.json
 */
export default metadata;
