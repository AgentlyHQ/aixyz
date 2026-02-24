import { execFile } from "child_process";

export interface BrowserSignParams {
  registryAddress: `0x${string}`;
  calldata: `0x${string}`;
  chainId: number;
  chainName: string;
  uri?: string;
  gas?: bigint;
}

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function signWithBrowser(params: BrowserSignParams): Promise<{ txHash: string }> {
  const { registryAddress, calldata, chainId, chainName, uri, gas } = params;

  const nonce = crypto.randomUUID();
  const html = buildHtml({ registryAddress, calldata, chainId, chainName, uri, gas, nonce });

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

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** JSON.stringify does not escape `</script>`, which breaks out of a script tag. */
export function safeJsonEmbed(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildHtml(params: {
  registryAddress: string;
  calldata: string;
  chainId: number;
  chainName: string;
  uri?: string;
  gas?: bigint;
  nonce: string;
}): string {
  const { registryAddress, calldata, chainId, chainName, uri, gas, nonce } = params;
  const chainIdHex = `0x${chainId.toString(16)}`;

  const displayUri = uri && uri.length > 80 ? uri.slice(0, 80) + "..." : (uri ?? "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>agently-cli – Register Agent</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #08080c;
    --surface: #111118;
    --surface-raised: #18181f;
    --border: #222230;
    --border-hover: #3a3a50;
    --text: #c8c8d0;
    --text-dim: #6a6a78;
    --text-bright: #eeeef2;
    --accent: #6e56cf;
    --accent-dim: rgba(110,86,207,0.12);
    --green: #3dd68c;
    --green-dim: rgba(61,214,140,0.1);
    --red: #e5484d;
    --red-dim: rgba(229,72,77,0.1);
    --blue: #52a9ff;
    --blue-dim: rgba(82,169,255,0.1);
    --mono: 'DM Mono', 'SF Mono', 'Fira Code', monospace;
    --sans: 'DM Sans', system-ui, sans-serif;
    --radius: 8px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: var(--sans);
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .container {
    max-width: 420px;
    width: 100%;
  }

  .header {
    margin-bottom: 1.75rem;
    animation: fadeIn 0.4s ease-out;
  }

  .brand {
    font-family: var(--mono);
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 0.75rem;
  }

  h1 {
    font-family: var(--sans);
    font-size: 1.35rem;
    font-weight: 600;
    color: var(--text-bright);
    letter-spacing: -0.01em;
  }

  .details {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0;
    margin-bottom: 1.5rem;
    overflow: hidden;
    animation: fadeIn 0.4s ease-out 0.05s both;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 0.65rem 0.85rem;
    gap: 1rem;
  }

  .detail-row + .detail-row {
    border-top: 1px solid var(--border);
  }

  .detail-label {
    font-family: var(--mono);
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .detail-value {
    font-family: var(--mono);
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--text);
    text-align: right;
    word-break: break-all;
    line-height: 1.5;
  }

  /* --- Wallet section --- */
  #walletSection {
    animation: fadeIn 0.4s ease-out 0.1s both;
  }

  .section-label {
    font-family: var(--mono);
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.6rem;
  }

  #walletList { margin-bottom: 0; }

  .wallet-btn {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    width: 100%;
    padding: 0.7rem 0.85rem;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: var(--sans);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .wallet-btn:first-child { border-radius: var(--radius) var(--radius) 0 0; }
  .wallet-btn:last-child { border-radius: 0 0 var(--radius) var(--radius); }
  .wallet-btn:only-child { border-radius: var(--radius); }
  .wallet-btn + .wallet-btn { border-top: none; }

  .wallet-btn:hover:not(:disabled) {
    background: var(--surface-raised);
    border-color: var(--border-hover);
  }
  .wallet-btn:hover:not(:disabled) + .wallet-btn {
    border-top-color: transparent;
  }
  .wallet-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .wallet-btn img {
    width: 24px;
    height: 24px;
    border-radius: 5px;
    flex-shrink: 0;
  }

  .wallet-btn .arrow {
    margin-left: auto;
    color: var(--text-dim);
    font-size: 0.8rem;
    transition: transform 0.15s;
  }
  .wallet-btn:hover:not(:disabled) .arrow { transform: translateX(2px); }

  .legacy-btn {
    width: 100%;
    padding: 0.7rem 0.85rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--sans);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .legacy-btn:hover {
    background: var(--surface-raised);
    border-color: var(--border-hover);
  }

  /* --- Connected state --- */
  #walletInfo {
    display: none;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.7rem 0.85rem;
    margin-bottom: 1rem;
    animation: fadeIn 0.3s ease-out;
  }

  .connected-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .connected-addr {
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--text);
    word-break: break-all;
    line-height: 1.5;
  }

  .connected-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green);
    flex-shrink: 0;
    animation: pulse 2s ease-in-out infinite;
  }

  #disconnectBtn {
    width: auto;
    padding: 0.3rem 0.6rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text-dim);
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }
  #disconnectBtn:hover {
    color: var(--red);
    border-color: var(--red);
  }

  /* --- Register button --- */
  #registerBtn {
    display: none;
    width: 100%;
    padding: 0.75rem;
    background: var(--accent);
    border: none;
    border-radius: var(--radius);
    color: #fff;
    font-family: var(--sans);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  #registerBtn:hover:not(:disabled) { opacity: 0.88; }
  #registerBtn:disabled { opacity: 0.35; cursor: not-allowed; }

  /* --- Status --- */
  .status {
    margin-top: 1rem;
    padding: 0.65rem 0.85rem;
    border-radius: var(--radius);
    font-family: var(--mono);
    font-size: 0.72rem;
    font-weight: 400;
    line-height: 1.5;
    display: none;
    word-break: break-all;
    animation: fadeIn 0.2s ease-out;
  }
  .status.error {
    background: var(--red-dim);
    border: 1px solid rgba(229,72,77,0.15);
    color: var(--red);
    display: block;
  }
  .status.success {
    background: var(--green-dim);
    border: 1px solid rgba(61,214,140,0.12);
    color: var(--green);
    display: block;
  }
  .status.info {
    background: var(--blue-dim);
    border: 1px solid rgba(82,169,255,0.12);
    color: var(--blue);
    display: block;
  }

  #discovering {
    font-family: var(--mono);
    color: var(--text-dim);
    font-size: 0.72rem;
    margin-bottom: 0.75rem;
    letter-spacing: 0.01em;
  }

  #discovering::after {
    content: '';
    animation: dots 1.5s steps(4, end) infinite;
  }

  @keyframes dots {
    0%  { content: ''; }
    25% { content: '.'; }
    50% { content: '..'; }
    75% { content: '...'; }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="brand">agently-cli</div>
    <h1>Register Agent</h1>
  </div>

  <div class="details" id="details">
    <div class="detail-row">
      <span class="detail-label">Chain</span>
      <span class="detail-value">${escapeHtml(chainName)} (${chainId})</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Registry</span>
      <span class="detail-value">${escapeHtml(registryAddress)}</span>
    </div>
    ${
      uri
        ? `<div class="detail-row">
      <span class="detail-label">URI</span>
      <span class="detail-value">${escapeHtml(displayUri)}</span>
    </div>`
        : ""
    }
  </div>

  <div id="walletInfo">
    <div class="connected-row">
      <div style="display:flex;align-items:center;gap:0.5rem;min-width:0;">
        <div class="connected-dot"></div>
        <span class="connected-addr" id="addrDisplay"></span>
      </div>
      <button id="disconnectBtn" type="button">disconnect</button>
    </div>
  </div>

  <div id="walletSection">
    <div class="section-label" id="discovering">Discovering wallets</div>
    <div id="walletList"></div>
  </div>

  <button id="registerBtn" disabled>Register Agent</button>

  <div class="status" id="status"></div>
</div>

<script>
  const REGISTRY = ${safeJsonEmbed(registryAddress)};
  const CALLDATA = ${safeJsonEmbed(calldata)};
  const CHAIN_ID_HEX = ${safeJsonEmbed(chainIdHex)};
  const CHAIN_ID = ${chainId};
  const GAS = ${gas ? safeJsonEmbed(`0x${gas.toString(16)}`) : "undefined"};

  const registerBtn = document.getElementById("registerBtn");
  const statusEl = document.getElementById("status");
  const walletInfo = document.getElementById("walletInfo");
  const addrDisplay = document.getElementById("addrDisplay");
  const walletListEl = document.getElementById("walletList");
  const walletSectionEl = document.getElementById("walletSection");
  const discoveringEl = document.getElementById("discovering");
  const disconnectBtn = document.getElementById("disconnectBtn");

  let account = null;
  let selectedProvider = null;

  disconnectBtn.addEventListener("click", () => {
    account = null;
    selectedProvider = null;
    walletInfo.style.display = "none";
    registerBtn.style.display = "none";
    registerBtn.disabled = true;
    registerBtn.textContent = "Register Agent";
    walletSectionEl.style.display = "";
    statusEl.className = "status";
    if (discoveredWallets.size > 0) {
      renderWalletList();
    } else if (window.ethereum) {
      showLegacyConnect();
    }
  });

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "status " + type;
  }

  // --- EIP-6963 wallet discovery ---
  const discoveredWallets = new Map(); // keyed by rdns for dedup

  window.addEventListener("eip6963:announceProvider", (event) => {
    const { info, provider } = event.detail;
    if (!info || !info.rdns) return;
    if (discoveredWallets.has(info.rdns)) return;
    discoveredWallets.set(info.rdns, { info, provider });
    renderWalletList();
  });

  window.dispatchEvent(new Event("eip6963:requestProvider"));

  // Fallback after 500ms if no EIP-6963 wallets discovered
  setTimeout(() => {
    if (discoveredWallets.size > 0) return;
    discoveringEl.style.display = "none";

    if (window.ethereum) {
      showLegacyConnect();
    } else {
      setStatus("No wallet detected. Install a browser wallet extension.", "error");
    }
  }, 500);

  function renderWalletList() {
    discoveringEl.style.display = "none";
    walletListEl.replaceChildren();

    for (const [rdns, detail] of discoveredWallets) {
      const btn = document.createElement("button");
      btn.className = "wallet-btn";
      btn.type = "button";

      if (detail.info.icon && /^data:image\\//.test(detail.info.icon)) {
        const img = document.createElement("img");
        img.src = detail.info.icon;
        img.alt = "";
        img.width = 24;
        img.height = 24;
        btn.appendChild(img);
      }

      const label = document.createElement("span");
      label.textContent = detail.info.name || rdns;
      btn.appendChild(label);

      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "\\u2192";
      btn.appendChild(arrow);

      btn.addEventListener("click", () => connectWallet(detail, btn));
      walletListEl.appendChild(btn);
    }
  }

  function showLegacyConnect() {
    discoveringEl.style.display = "none";
    walletListEl.replaceChildren();
    const btn = document.createElement("button");
    btn.className = "legacy-btn";
    btn.type = "button";
    btn.textContent = "Connect Wallet";
    btn.addEventListener("click", () => {
      connectWallet({ info: { name: "Browser Wallet", rdns: "_legacy" }, provider: window.ethereum }, btn);
    });
    walletListEl.appendChild(btn);
  }

  async function connectWallet(detail, btn) {
    try {
      // Disable all wallet buttons while connecting
      walletListEl.querySelectorAll("button").forEach(b => { b.disabled = true; });
      btn.textContent = "Connecting...";

      selectedProvider = detail.provider;
      const accounts = await selectedProvider.request({ method: "eth_requestAccounts" });
      account = accounts[0];

      // Check chain
      const currentChainId = await selectedProvider.request({ method: "eth_chainId" });
      if (currentChainId !== CHAIN_ID_HEX) {
        setStatus("Switching chain...", "info");
        try {
          await selectedProvider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: CHAIN_ID_HEX }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            setStatus("Chain not found in wallet. Please add it manually and try again.", "error");
            walletListEl.querySelectorAll("button").forEach(b => { b.disabled = false; });
            renderWalletList();
            return;
          }
          throw switchErr;
        }
      }

      addrDisplay.textContent = account;
      walletInfo.style.display = "block";
      walletSectionEl.style.display = "none";
      registerBtn.style.display = "block";
      registerBtn.disabled = false;
      setStatus("Wallet connected. Ready to register.", "success");

      // Listen for account/chain changes on the selected provider
      if (selectedProvider.on) {
        selectedProvider.on("accountsChanged", () => location.reload());
        selectedProvider.on("chainChanged", () => location.reload());
      }
    } catch (err) {
      if (err.code === 4001) {
        setStatus("Connection rejected by user.", "error");
      } else {
        setStatus("Connection failed: " + err.message, "error");
      }
      walletListEl.querySelectorAll("button").forEach(b => { b.disabled = false; });
      renderWalletList();
    }
  }

  registerBtn.addEventListener("click", async () => {
    if (!selectedProvider || !account) return;
    try {
      registerBtn.disabled = true;
      registerBtn.textContent = "Sign in wallet...";
      setStatus("Please sign the transaction in your wallet.", "info");

      const txParams = { from: account, to: REGISTRY, data: CALLDATA };
      if (GAS) txParams.gas = GAS;

      const txHash = await selectedProvider.request({
        method: "eth_sendTransaction",
        params: [txParams],
      });

      if (typeof txHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(txHash)) {
        throw new Error("Wallet returned invalid transaction hash");
      }

      const explorers = { 1: "https://etherscan.io", 11155111: "https://sepolia.etherscan.io", 84532: "https://sepolia.basescan.org" };
      const explorerBase = explorers[CHAIN_ID];

      statusEl.textContent = "";
      const msgDiv = document.createElement("div");
      msgDiv.style.marginBottom = "0.5rem";
      msgDiv.appendChild(document.createTextNode("Transaction sent! "));
      if (explorerBase) {
        const link = document.createElement("a");
        link.href = explorerBase + "/tx/" + txHash;
        link.target = "_blank";
        link.rel = "noopener";
        link.style.color = "inherit";
        link.style.textDecoration = "underline";
        link.textContent = explorerBase + "/tx/" + txHash;
        msgDiv.appendChild(link);
      } else {
        msgDiv.appendChild(document.createTextNode(txHash));
      }
      const hintDiv = document.createElement("div");
      hintDiv.style.color = "var(--text-dim)";
      hintDiv.textContent = "You can safely close this page and return to the CLI.";
      statusEl.appendChild(msgDiv);
      statusEl.appendChild(hintDiv);
      statusEl.className = "status success";
      registerBtn.textContent = "Sent!";

      await fetch("/result/" + ${safeJsonEmbed(nonce)}, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
    } catch (err) {
      if (err.code === 4001) {
        setStatus("Transaction rejected. You can try again.", "error");
      } else {
        setStatus("Failed: " + err.message + " — You can try again.", "error");
      }
      registerBtn.disabled = false;
      registerBtn.textContent = "Register Agent";
    }
  });
</script>
</body>
</html>`;
}
