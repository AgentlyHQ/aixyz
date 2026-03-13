import type { AixyzApp } from "./index";
import type { HttpMethod } from "./types";

export function createDispatcher(app: AixyzApp): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const key = app.getRouteKey(request.method as HttpMethod, url.pathname);
    const entry = app.routes.get(key);

    if (!entry) {
      return new Response("Not Found", { status: 404 });
    }

    if (entry.payment && app.payment) {
      const rejection = await app.payment.verify(request);
      if (rejection) return rejection;
    }

    let index = 0;
    const middlewares = app.getMiddlewares();
    const handler = entry.handler;

    const next = async (): Promise<Response> => {
      if (index < middlewares.length) {
        const mw = middlewares[index++];
        return mw(request, next);
      }
      return handler(request);
    };

    const response = await next();

    // Settle payment after a successful handler response
    if (entry.payment && app.payment) {
      const settlementResult = await app.payment.settle(request);
      if (settlementResult?.success) {
        const paymentResultHeader = settlementResult.headers["PAYMENT-RESPONSE"];
        response.headers.set("PAYMENT-RESPONSE", paymentResultHeader);
      }
    }

    return response;
  };
}
