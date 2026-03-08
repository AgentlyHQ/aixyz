import { getAixyzConfig, Network } from "@aixyz/config";
import { FacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { x402HTTPResourceServer, HTTPAdapter, HTTPRequestContext } from "@x402/core/http";
import type { PaymentRequirements } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { z } from "zod";
import { type AcceptsX402, facilitator as defaultFacilitator } from "../accepts";

type RouteHandler = (req: Request) => Promise<Response>;

/**
 * Web-standard adapter implementing HTTPAdapter for x402 payment processing.
 */
class WebRequestAdapter implements HTTPAdapter {
  constructor(private req: Request) {}

  getHeader(name: string): string | undefined {
    return this.req.headers.get(name) ?? undefined;
  }

  getMethod(): string {
    return this.req.method;
  }

  getPath(): string {
    return new URL(this.req.url).pathname;
  }

  getUrl(): string {
    return this.req.url;
  }

  getAcceptHeader(): string {
    return this.req.headers.get("Accept") ?? "";
  }

  getUserAgent(): string {
    return this.req.headers.get("User-Agent") ?? "";
  }

  getQueryParams(): Record<string, string | string[]> {
    const params: Record<string, string | string[]> = {};
    for (const [key, value] of new URL(this.req.url).searchParams) {
      const existing = params[key];
      if (existing !== undefined) {
        params[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        params[key] = value;
      }
    }
    return params;
  }

  getQueryParam(name: string): string | string[] | undefined {
    return this.getQueryParams()[name];
  }
}

// TODO(@fuxingloh): rename to unstable_AixyzApp?
export class AixyzServer extends x402ResourceServer {
  private _routes = new Map<string, RouteHandler>();
  private _x402Servers = new Map<string, x402HTTPResourceServer>();

  constructor(
    facilitator: FacilitatorClient = defaultFacilitator,
    public config = getAixyzConfig(),
  ) {
    super(facilitator);
    this.register(config.x402.network as any, new ExactEvmScheme());
  }

  /**
   * Register a web-standard route handler.
   * @param method HTTP method (e.g. "GET", "POST") or "*" for any method
   * @param path URL path starting with "/"
   * @param handler Function accepting a Request and returning a Promise<Response>
   */
  on(method: string, path: string, handler: RouteHandler): void {
    this._routes.set(`${method} ${path}`, handler);
  }

  /**
   * Web-standard fetch handler – dispatch an incoming Request to the registered route.
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const key = `${method} ${path}`;
    let handler = this._routes.get(key);
    if (!handler) handler = this._routes.get(`* ${path}`);

    if (!handler) {
      return new Response("Not Found", { status: 404 });
    }

    const x402Server = this._x402Servers.get(key);
    if (x402Server) {
      return this._withX402(request, x402Server, handler);
    }

    return handler(request);
  }

  private async _withX402(
    request: Request,
    httpServer: x402HTTPResourceServer,
    handler: RouteHandler,
  ): Promise<Response> {
    const adapter = new WebRequestAdapter(request);
    const context: HTTPRequestContext = {
      adapter,
      path: adapter.getPath(),
      method: adapter.getMethod(),
      paymentHeader: adapter.getHeader("payment-signature") ?? adapter.getHeader("x-payment"),
    };

    if (!httpServer.requiresPayment(context)) {
      return handler(request);
    }

    const result = await httpServer.processHTTPRequest(context);

    switch (result.type) {
      case "no-payment-required":
        return handler(request);

      case "payment-error": {
        const { response } = result;
        const headers = new Headers(response.headers);
        if (response.isHtml) {
          headers.set("Content-Type", "text/html");
          return new Response(response.body as string, { status: response.status, headers });
        }
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify(response.body), { status: response.status, headers });
      }

      case "payment-verified": {
        const { paymentPayload, paymentRequirements, declaredExtensions } = result;
        const response = await handler(request);

        const settleResult = await httpServer.processSettlement(
          paymentPayload,
          paymentRequirements,
          declaredExtensions,
        );
        if (settleResult.success) {
          const headers = new Headers(response.headers);
          for (const [key, value] of Object.entries(settleResult.headers)) {
            headers.set(key, value);
          }
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        }
        return response;
      }
    }
  }

  public unstable_withIndexPage(path = "/") {
    if (!path?.startsWith("/")) {
      throw new Error(`Invalid path: ${path}. Path must be a string starting with "/"`);
    }

    this.on("GET", path, async () => {
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

      return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    });

    return this;
  }

  // TODO(@fuxingloh): add back x402 Bazaar compatibility

  private withSchemeExact(accepts: AcceptsX402) {
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

  withX402Exact(route: `${"GET" | "POST"} /${string}`, accepts: AcceptsX402) {
    const parsed = this.withSchemeExact(accepts);
    const httpServer = new x402HTTPResourceServer(this, {
      [route]: {
        accepts: parsed,
        mimeType: "application/json",
        description: `A2A Payment: ${this.config.description}`,
      },
    });
    // The route template literal type `${"GET" | "POST"} /${string}` already enforces the format,
    // but we split robustly by taking only the first space as the method/path separator.
    const spaceIndex = route.indexOf(" ");
    const method = route.slice(0, spaceIndex);
    const path = route.slice(spaceIndex + 1);
    this._x402Servers.set(`${method} ${path}`, httpServer);
  }

  async withPaymentRequirements(accepts: AcceptsX402): Promise<PaymentRequirements[]> {
    return this.buildPaymentRequirements(this.withSchemeExact(accepts));
  }
}
