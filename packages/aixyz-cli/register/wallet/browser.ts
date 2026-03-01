import { execFile } from "child_process";

export interface BrowserSignParams {
  registryAddress: `0x${string}`;
  calldata: `0x${string}`;
  chainId: number;
  chainName: string;
  uri?: string;
  gas?: bigint;
  mode?: "register" | "update";
}

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function signWithBrowser(params: BrowserSignParams): Promise<{ txHash: string }> {
  const { registryAddress, calldata, chainId, chainName, uri, gas, mode } = params;

  const nonce = crypto.randomUUID();
  const { buildHtml } = await import("./html.tsx");
  const html = buildHtml({ registryAddress, calldata, chainId, chainName, uri, gas, nonce, mode });

  const { promise: resultPromise, resolve, reject } = Promise.withResolvers<{ txHash: string }>();
  let settled = false;

  function resolveOnce(result: { txHash: string }): void {
    if (!settled) {
      settled = true;
      resolve(result);
    }
  }

  function rejectOnce(error: Error): void {
    if (!settled) {
      settled = true;
      reject(error);
    }
  }

  const jsonHeaders = { "Content-Type": "application/json" };

  const server = Bun.serve({
    hostname: "localhost",
    port: 0,
    error(error) {
      console.error(`Local server error: ${error.message}`);
      rejectOnce(new Error(`Internal server error: ${error.message}`));
      return new Response("Internal Server Error", { status: 500 });
    },
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === "GET" && url.pathname === "/") {
        return new Response(html, { headers: { "Content-Type": "text/html" } });
      }

      if (req.method === "POST" && url.pathname === `/result/${nonce}`) {
        if (settled) {
          return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: jsonHeaders });
        }

        let body: { txHash?: string; error?: string };
        try {
          body = (await req.json()) as { txHash?: string; error?: string };
        } catch (parseError) {
          const msg = `Received malformed response from browser wallet: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
          console.error(msg);
          rejectOnce(new Error(msg));
          return new Response(JSON.stringify({ error: msg }), { status: 400, headers: jsonHeaders });
        }

        if (body.txHash) {
          resolveOnce({ txHash: body.txHash });
        } else {
          rejectOnce(new Error(body.error || "Unknown error from browser wallet"));
        }
        return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  const localUrl = `http://localhost:${server.port}`;
  console.log(`\nOpening browser wallet at ${localUrl}`);
  console.log(`This page will remain available for ${TIMEOUT_MS / 60_000} minutes.`);
  console.log("If the browser doesn't open, visit the URL manually.\n");

  openBrowser(localUrl);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, rej) => {
    timeoutId = setTimeout(() => rej(new Error("Browser wallet timed out after 5 minutes")), TIMEOUT_MS);
  });

  try {
    return await Promise.race([resultPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
    server.stop();
  }
}

function openBrowser(url: string): void {
  const commands: Record<string, [string, ...string[]]> = {
    darwin: ["open", url],
    win32: ["cmd", "/c", "start", "", url],
  };
  const [cmd, ...args] = commands[process.platform] ?? ["xdg-open", url];

  execFile(cmd, args, (err) => {
    if (err) {
      console.error(`\nCould not open browser automatically. Please open this URL manually: ${url}\n`);
    }
  });
}
