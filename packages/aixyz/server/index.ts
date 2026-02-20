import { getAixyzConfig, Network } from "../config";
import initExpress from "express";
import { x402ResourceServer } from "@x402/core/server";
import { paymentMiddleware, PaymentRequirements } from "@x402/express";
import { getDefaultFacilitator } from "../accepts";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { z } from "zod";
import { AcceptsX402 } from "../accepts";

// TODO(@fuxingloh): rename to unstable_AixyzApp?
export class AixyzServer extends x402ResourceServer {
  constructor(
    facilitator = getDefaultFacilitator(),
    public config = getAixyzConfig(),
    public express: initExpress.Express = initExpress(),
  ) {
    super(facilitator);
    this.register(config.x402.network as any, new ExactEvmScheme());
  }

  public unstable_withIndexPage(path = "/") {
    if (!path || typeof path !== "string" || !path.startsWith("/")) {
      throw new Error(`Invalid path: ${path}. Path must be a string starting with "/"`);
    }

    // Simple human interface at root
    this.express.get(path, (_req, res) => {
      const { name, description, version, skills } = this.config;

      let text = `${name}\n`;
      text += `${"=".repeat(name.length)}\n\n`;
      text += `Description: ${description}\n`;
      text += `Version: ${version}\n\n`;

      if (skills && skills.length > 0) {
        text += `Skills:\n`;
        skills.forEach((skill, index) => {
          text += `\n${index + 1}. ${skill.name}\n`;
          text += `   ID: ${skill.id}\n`;
          text += `   Description: ${skill.description}\n`;
          if (skill.tags && skill.tags.length > 0) {
            text += `   Tags: ${skill.tags.join(", ")}\n`;
          }
          if (skill.examples && skill.examples.length > 0) {
            text += `   Examples:\n`;
            skill.examples.forEach((example) => {
              text += `   - ${example}\n`;
            });
          }
        });
      }

      res.type("text/plain").send(text);
    });

    return this;
  }

  // TODO(@fuxingloh): add back x402 Bazaar compatibility

  private withAccepts(accepts: AcceptsX402) {
    const schema = z.object({
      scheme: z.literal("exact"),
      price: z.string(),
      payTo: z.string().default(this.config.x402.payTo),
      network: z
        .custom<Network>((val) => {
          return typeof val === "string" && val.includes(":");
        })
        .default(this.config.x402.network),
    });

    return schema.parse(accepts);
  }

  withX402(route: `${"GET" | "POST"} /${string}`, accepts: AcceptsX402) {
    this.express.use(
      paymentMiddleware(
        {
          [route]: {
            accepts: this.withAccepts(accepts),
            mimeType: "application/json",
            description: `A2A Payment: ${this.config.description}`,
          },
        },
        this,
        undefined,
        undefined,
        false,
      ),
    );
  }

  async withPaymentRequirements(accepts: AcceptsX402): Promise<PaymentRequirements[]> {
    return this.buildPaymentRequirements(this.withAccepts(accepts));
  }
}
