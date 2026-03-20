/** @jsxImportSource @kitajs/html */
import Html from "@kitajs/html";
import type { AixyzConfigRuntime, Entrypoint, ProtocolInfo } from "./index";

// ---------------------------------------------------------------------------
// Icons (Lucide-style, matching shadcn conventions)
// ---------------------------------------------------------------------------

const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const SPARKLES_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>`;

// ---------------------------------------------------------------------------
// Chip class constants (shared between JSX and inline script)
// ---------------------------------------------------------------------------

const CHIP_ACTIVE = "border-primary/50 bg-primary/10 text-primary";
const CHIP_INACTIVE = "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground";

// ---------------------------------------------------------------------------
// Safe JSON serialization for embedding in <script> tags.
// JSON.stringify alone doesn't prevent the HTML parser from seeing </script>
// or <!-- sequences inside string literals, which can break out of the tag.
// ---------------------------------------------------------------------------

function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

// ---------------------------------------------------------------------------
// shadcn-style Primitives
// ---------------------------------------------------------------------------

function Badge({
  children,
  variant = "secondary",
}: {
  children: string;
  variant?: "secondary" | "outline" | "destructive" | "success";
}) {
  const styles: Record<string, string> = {
    secondary: "bg-secondary text-secondary-foreground border-transparent",
    outline: "bg-transparent text-muted-foreground border-border",
    destructive: "bg-chart-4/10 text-chart-4 border-chart-4/20",
    success: "bg-success/10 text-success border-success/20",
  };
  return (
    <span
      class={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase font-mono transition-colors ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  variant = "default",
  size = "sm",
  onclick,
}: {
  children: string;
  variant?: "default" | "secondary" | "ghost" | "outline";
  size?: "sm" | "xs" | "icon";
  onclick?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer border-none";
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
    ghost: "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
    outline:
      "border border-border bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 rounded-md px-3 text-[12px]",
    xs: "h-7 rounded-md px-2.5 text-[11px]",
    icon: "h-8 w-8 rounded-md",
  };
  return (
    <button class={`${base} ${variants[variant]} ${sizes[size]}`} onclick={onclick}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }: { children: JSX.Element; className?: string }) {
  return (
    <div class={`rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>
  );
}

function Separator() {
  return <div class="shrink-0 bg-border h-px w-full" />;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function TopNav({ config, protocolBadges }: { config: AixyzConfigRuntime; protocolBadges: string[] }) {
  return (
    <nav class="flex items-center justify-between h-14 border-b border-border">
      <div class="flex items-center gap-3">
        <img
          src="/icon.png"
          alt=""
          class="w-7 h-7 rounded-lg object-cover"
          // On error, hide the image and show the fallback svg
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
        />
        <div class="w-7 h-7 rounded-lg items-center justify-center overflow-hidden" style="display:none">
          <svg width="256" height="256" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="3" fill="black" />
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M6.96388 5.15701C7.13522 5.05191 7.33432 4.99702 7.53297 5.00012C7.73163 5.00323 7.91978 5.06416 8.07077 5.1743L17.1705 11.8148C17.3129 11.9186 17.4156 12.0614 17.4657 12.2251C17.5158 12.3888 17.5109 12.5659 17.4518 12.7342C17.3927 12.9024 17.2819 13.0541 17.1335 13.1702C16.9851 13.2862 16.8058 13.3613 16.6182 13.386L13.9133 13.7438L16.5299 17.6214C16.6588 17.8126 16.6964 18.0487 16.6343 18.2779C16.5722 18.507 16.4155 18.7103 16.1988 18.8431C15.982 18.9759 15.723 19.0274 15.4785 18.9861C15.2341 18.9448 15.0244 18.8142 14.8954 18.623L12.2804 14.7461L10.817 16.9431C10.7157 17.0957 10.5696 17.2201 10.3973 17.3008C10.2249 17.3814 10.0341 17.4146 9.84892 17.3961C9.66375 17.3776 9.49259 17.3083 9.35712 17.1969C9.22166 17.0855 9.12798 16.9371 9.08796 16.7704L6.52209 6.12374C6.47934 5.94713 6.49896 5.75862 6.57819 5.58491C6.65742 5.41121 6.79223 5.26112 6.96353 5.15591L6.96388 5.15701Z"
              fill="#ffffff"
            />
          </svg>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-[14px] font-semibold text-foreground">{Html.escapeHtml(config.name)}</span>
          <span class="text-[11px] font-mono text-muted-foreground hidden xs:inline">
            {"v" + Html.escapeHtml(config.version)}
          </span>
        </div>
      </div>
      {protocolBadges.length > 0 && <div class="flex items-center gap-1.5 flex-wrap">{protocolBadges.join("")}</div>}
    </nav>
  );
}

function HeroBanner({ config }: { config: AixyzConfigRuntime }) {
  return (
    <div class="py-8 sm:py-14 text-center">
      <h1 class="text-[1.75rem] sm:text-[2rem] font-bold tracking-[-0.025em] text-foreground leading-[1.2]">
        {Html.escapeHtml(config.name)}
      </h1>
      <p class="text-[15px] text-muted-foreground leading-relaxed mt-3 max-w-[420px] mx-auto">
        {Html.escapeHtml(config.description)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prompt script builder
// ---------------------------------------------------------------------------

type ContinuationWithMessages = {
  label: string;
  protocol: string;
  text: string;
  hasMessage: boolean;
  messages: string[];
};

function buildPromptScript(
  basePrompt: string,
  continuations: ContinuationWithMessages[],
  id: string,
  defaultMsg: string,
  hasExamples: boolean,
): string {
  return `
(function(){
  var base=${safeJsonStringify(basePrompt)};
  var conts=${safeJsonStringify(continuations.map((c) => c.text))};
  var hasMsg=${safeJsonStringify(continuations.map((c) => c.hasMessage))};
  var msgSets=${safeJsonStringify(continuations.map((c) => c.messages))};
  var activeChipIdx=0;
  var activeMsg=${safeJsonStringify(defaultMsg)};
  var isCustom=${hasExamples ? "false" : "true"};
  window.__promptBase=base;
  var ACT=${safeJsonStringify(CHIP_ACTIVE)};
  var INACT=${safeJsonStringify(CHIP_INACTIVE)};
  function animateHeight(el){
    var oldH=el.scrollHeight;
    el.style.maxHeight=oldH+'px';
    return function(){
      requestAnimationFrame(function(){
        var newH=el.scrollHeight;
        if(newH!==oldH){el.style.maxHeight=newH+'px';}
        setTimeout(function(){el.style.maxHeight='none';},250);
      });
    };
  }
  function render(animate){
    var el=document.getElementById(${safeJsonStringify(id)});
    var finish=animate&&el?animateHeight(el):null;
    var t=conts[activeChipIdx]||'';
    if(hasMsg[activeChipIdx]){t=t.replaceAll('%MSG%',activeMsg);}
    window.__promptCont=t;
    if(el)el.textContent=base+t;
    if(finish)finish();
  }
  render(false);
  function swapClass(el,from,to){el.className=el.className.replace(from,to);}
  function rebuildMsgChips(idx){
    var msgs=msgSets[idx]||[];
    var container=document.getElementById('msg-chips');
    if(!container)return;
    var finishChips=animateHeight(container);
    container.innerHTML='';
    for(var i=0;i<msgs.length;i++){
      var btn=document.createElement('button');
      btn.className='msg-chip inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 sm:py-1 text-[11px] font-medium font-mono transition-colors cursor-pointer border w-full text-left '+(i===0?ACT:INACT);
      btn.dataset.msgIndex=String(i);
      btn.onclick=function(){window.__selectMessage(this);};
      btn.textContent=msgs[i];
      container.appendChild(btn);
    }
    var custom=document.createElement('button');
    custom.className='msg-chip inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 sm:py-1 text-[11px] font-medium font-mono transition-colors cursor-pointer border w-full text-left '+(msgs.length===0?ACT:INACT);
    custom.dataset.msgIndex='custom';
    custom.onclick=function(){window.__selectMessage(this);};
    custom.innerHTML='&#9998; Custom';
    container.appendChild(custom);
    finishChips();
    var customRow=document.getElementById('custom-input-row');
    if(msgs.length===0){
      isCustom=true;
      if(customRow){customRow.classList.remove('collapsed');customRow.style.maxHeight='60px';}
      var inp=document.getElementById('custom-msg-input');
      activeMsg=inp?inp.value||'<your message>':'<your message>';
    } else {
      isCustom=false;
      if(customRow){customRow.style.maxHeight='0';customRow.classList.add('collapsed');}
      activeMsg=msgs[0];
    }
  }
  window.__selectChip=function(el){
    var idx=parseInt(el.dataset.index,10);
    activeChipIdx=idx;
    var chips=document.querySelectorAll('.prompt-chip');
    for(var i=0;i<chips.length;i++){
      if(i===idx){swapClass(chips[i],INACT,ACT);}
      else{swapClass(chips[i],ACT,INACT);}
    }
    rebuildMsgChips(idx);
    render(true);
  };
  window.__selectMessage=function(el){
    var midx=el.dataset.msgIndex;
    var chips=document.querySelectorAll('.msg-chip');
    for(var i=0;i<chips.length;i++){swapClass(chips[i],ACT,INACT);}
    swapClass(el,INACT,ACT);
    var customRow=document.getElementById('custom-input-row');
    var msgs=msgSets[activeChipIdx]||[];
    if(midx==='custom'){
      isCustom=true;
      if(customRow){customRow.classList.remove('collapsed');customRow.style.maxHeight='60px';}
      var inp=document.getElementById('custom-msg-input');
      activeMsg=inp?inp.value||'<your message>':'<your message>';
    } else {
      isCustom=false;
      if(customRow){customRow.style.maxHeight='0';customRow.classList.add('collapsed');}
      activeMsg=msgs[parseInt(midx,10)]||'<your message>';
    }
    render(true);
  };
  window.__onCustomInput=function(el){
    activeMsg=el.value||'<your message>';
    render(true);
  };
})();
          `;
}

// ---------------------------------------------------------------------------
// Prompt Section
// ---------------------------------------------------------------------------

function PromptSection({
  basePrompt,
  continuations,
  id,
}: {
  basePrompt: string;
  continuations: ContinuationWithMessages[];
  id: string;
}) {
  const hasContinuations = continuations.length > 0;
  const firstCont = hasContinuations ? continuations[0] : null;
  const firstMessages = firstCont?.messages ?? [];
  const defaultMsg = firstMessages.length > 0 ? firstMessages[0] : "<your message>";
  const defaultContinuation = firstCont
    ? firstCont.hasMessage
      ? firstCont.text.replaceAll("%MSG%", defaultMsg)
      : firstCont.text
    : "";
  const fullPrompt = basePrompt + defaultContinuation;

  return (
    <Card>
      <>
        <div class="flex items-center justify-between px-3.5 sm:px-5 py-3 border-b border-border">
          <div class="flex items-center gap-2">
            <span class="text-primary">{SPARKLES_ICON}</span>
            <span class="text-[13px] font-semibold text-foreground">System Prompt</span>
            <span class="text-[11px] text-muted-foreground hidden sm:inline">— paste into any LLM</span>
          </div>
          <Button
            variant="default"
            size="xs"
            onclick={`navigator.clipboard.writeText(window.__promptBase+(window.__promptCont||'')).then(()=>{this.querySelector('.cp-l').textContent='Copied!';setTimeout(()=>{this.querySelector('.cp-l').textContent='Copy'},1500)})`}
          >
            {COPY_ICON + '<span class="cp-l">Copy</span>'}
          </Button>
        </div>
        <div class={`p-3.5 sm:p-5 bg-muted/30${hasContinuations ? "" : " rounded-b-xl"}`}>
          <code
            class="block text-[11.5px] sm:text-[12.5px] leading-[1.7] sm:leading-[1.8] font-mono text-muted-foreground whitespace-pre-wrap break-words"
            id={id}
          >
            {Html.escapeHtml(fullPrompt)}
          </code>
        </div>
        {hasContinuations && (
          <div class="px-3.5 sm:px-5 py-3 border-t border-border">
            <span class="block text-[11px] text-muted-foreground font-medium mb-1.5">Use via:</span>
            <div class="flex flex-wrap gap-1.5">
              {continuations.map((c, i) => (
                <button
                  class={`prompt-chip inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 sm:py-1 text-[11px] font-medium font-mono transition-colors cursor-pointer border ${i === 0 ? CHIP_ACTIVE : CHIP_INACTIVE}`}
                  data-index={String(i)}
                  onclick="window.__selectChip(this)"
                >
                  {Html.escapeHtml(c.label) +
                    " " +
                    `<span class="text-[9px] opacity-60 uppercase">${Html.escapeHtml(c.protocol)}</span>`}
                </button>
              ))}
            </div>
          </div>
        )}
        {hasContinuations && (
          <div id="msg-row" class="px-3.5 sm:px-5 pb-3 border-t-0">
            <span class="block text-[11px] text-muted-foreground font-medium mb-1.5">Message:</span>
            <div id="msg-chips" class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {firstMessages.map((m, i) => (
                <button
                  class={`msg-chip inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 sm:py-1 text-[11px] font-medium font-mono transition-colors cursor-pointer border w-full text-left ${i === 0 ? CHIP_ACTIVE : CHIP_INACTIVE}`}
                  data-msg-index={String(i)}
                  onclick="window.__selectMessage(this)"
                >
                  {Html.escapeHtml(m)}
                </button>
              ))}
              <button
                class={`msg-chip inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 sm:py-1 text-[11px] font-medium font-mono transition-colors cursor-pointer border w-full text-left ${firstMessages.length === 0 ? CHIP_ACTIVE : CHIP_INACTIVE}`}
                data-msg-index="custom"
                onclick="window.__selectMessage(this)"
              >
                {"&#9998; Custom"}
              </button>
            </div>
            <div
              id="custom-input-row"
              class={`mt-2${firstMessages.length === 0 ? "" : " collapsed"}`}
              style={firstMessages.length === 0 ? "max-height:60px" : "max-height:0"}
            >
              <input
                type="text"
                id="custom-msg-input"
                placeholder="Type your message..."
                class="w-full rounded-md border border-border bg-background px-2.5 py-2 sm:py-1.5 text-[12px] sm:text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                oninput="window.__onCustomInput(this)"
              />
            </div>
          </div>
        )}
        {hasContinuations && (
          <script>{buildPromptScript(basePrompt, continuations, id, defaultMsg, firstMessages.length > 0)}</script>
        )}
      </>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skill-to-tool matching
// ---------------------------------------------------------------------------

type Skill = NonNullable<AixyzConfigRuntime["skills"]>[number];

export function getExamplesForTool(toolName: string, skills: Skill[]): string[] {
  const name = toolName.toLowerCase();
  const matched = skills.filter((s) => {
    const sId = s.id.toLowerCase();
    const sName = s.name.toLowerCase();
    const sTags = (s.tags ?? []).map((t) => t.toLowerCase());
    return (
      sId.includes(name) ||
      sName.includes(name) ||
      name.includes(sId.replace(/-/g, "")) ||
      sTags.some((t) => name.includes(t) || t.includes(name))
    );
  });
  const examples =
    matched.length > 0 ? matched.flatMap((s) => s.examples ?? []) : skills.flatMap((s) => s.examples ?? []);
  return examples;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildAgentPrompt(config: AixyzConfigRuntime): string {
  const agentUrl = config.url ?? "AGENT_URL";
  const skillsList =
    config.skills && config.skills.length > 0
      ? config.skills.map((s) => `- ${s.name}: ${s.description}`).join("\n")
      : "";

  let prompt = `You have access to an AI agent called "${config.name}" at ${agentUrl} — ${config.description.replace(/\.$/, "").toLowerCase()}. Use the \`use-agently\` CLI (npx use-agently) to interact with it.`;
  if (skillsList) prompt += `\n\nSkills:\n${skillsList}`;
  return prompt;
}

const CONTINUATION_SUFFIX = `\n\nWhen I ask for something this agent can help with, send it a clear message using the command above. Share the agent's response with me. You can send multiple messages to follow up or refine.`;

function buildContinuation(
  entry: Entrypoint,
  agentUrl: string,
  configName: string,
): { label: string; protocol: string; text: string; hasMessage: boolean } {
  if (entry.protocol === "a2a") {
    const prefix = entry.path.slice(1, -"/agent".length);
    const uri = prefix ? `${agentUrl}${prefix}/` : agentUrl;
    const label = prefix || configName;
    return {
      label,
      protocol: "A2A",
      text:
        `\n\nTo call this agent, run:\nnpx use-agently a2a send --uri ${uri} -m "<your message>"\n\nMy request: "%MSG%"` +
        CONTINUATION_SUFFIX,
      hasMessage: true,
    };
  }
  const uri = agentUrl.replace(/\/$/, "") + entry.path;
  const args = entry.inputSchema ? JSON.stringify(entry.inputSchema) : "{}";
  return {
    label: entry.name,
    protocol: "MCP",
    text:
      `\n\nTo call the "${entry.name}" tool, run:\nnpx use-agently mcp call --uri ${uri} --tool ${entry.name} --args '${args}'` +
      `\n\nMy request: "%MSG%"` +
      `\n\nWhen I ask for something this tool can help with, determine the appropriate --args from my request and run the command above. Share the tool's response with me. You can run the command multiple times to refine.`,
    hasMessage: true,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function renderHtml(config: AixyzConfigRuntime, protocols: ProtocolInfo): string {
  const agentUrl = config.url ?? "AGENT_URL";
  const basePrompt = buildAgentPrompt(config);

  const rawContinuations = protocols.entrypoints.map((e) => buildContinuation(e, agentUrl, config.name));

  const allSkills = config.skills ?? [];
  const allExamples = allSkills.flatMap((s) => s.examples ?? []);
  const continuations: ContinuationWithMessages[] = rawContinuations.map((c, i) => ({
    ...c,
    messages:
      protocols.entrypoints[i].protocol === "a2a"
        ? allExamples
        : getExamplesForTool(protocols.entrypoints[i].name, allSkills),
  }));

  const protocolBadges: string[] = [];
  if (protocols.a2a) protocolBadges.push((<Badge variant="secondary">A2A</Badge>) as string);
  if (protocols.mcp) protocolBadges.push((<Badge variant="secondary">MCP</Badge>) as string);
  if (protocols.entrypoints.some((e) => e.paid))
    protocolBadges.push((<Badge variant="destructive">x402</Badge>) as string);

  return (
    "<!doctype html>" +
    (
      <html lang="en" class="dark">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>{Html.escapeHtml(config.name)}</title>
          <link rel="icon" href="/favicon.ico" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Manrope:wght@300..800&family=JetBrains+Mono:wght@400;500&display=swap"
            rel="stylesheet"
          />
          <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
          <style type="text/tailwindcss">{`
            @theme {
              --font-sans: "Manrope", ui-sans-serif, system-ui, -apple-system, sans-serif;
              --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
              --radius: 0.625rem;

              --color-background: hsl(240 6% 6%);
              --color-foreground: hsl(240 5% 90%);
              --color-card: hsl(240 5% 8%);
              --color-card-foreground: hsl(240 5% 90%);
              --color-popover: hsl(240 5% 8%);
              --color-popover-foreground: hsl(240 5% 90%);
              --color-primary: hsl(239 84% 67%);
              --color-primary-foreground: hsl(0 0% 100%);
              --color-secondary: hsl(240 5% 13%);
              --color-secondary-foreground: hsl(240 4% 65%);
              --color-muted: hsl(240 5% 13%);
              --color-muted-foreground: hsl(240 4% 55%);
              --color-accent: hsl(240 5% 15%);
              --color-accent-foreground: hsl(240 5% 90%);
              --color-destructive: hsl(0 63% 31%);
              --color-destructive-foreground: hsl(0 0% 98%);
              --color-border: hsl(240 4% 14%);
              --color-input: hsl(240 4% 14%);
              --color-ring: hsl(239 84% 67%);
              --color-chart-1: hsl(239 84% 67%);
              --color-chart-4: hsl(38 92% 50%);
              --color-success: hsl(142 71% 45%);
            }

            body {
              background: var(--color-background);
              color: var(--color-foreground);
              font-feature-settings: "cv11", "ss01";
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }

            /* Top accent bar */
            body::before {
              content: "";
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              height: 1px;
              background: linear-gradient(
                90deg,
                transparent 5%,
                color-mix(in srgb, var(--color-primary) 40%, transparent) 20%,
                var(--color-primary) 50%,
                color-mix(in srgb, var(--color-primary) 40%, transparent) 80%,
                transparent 95%
              );
              z-index: 9999;
            }

            /* Glow */
            .glow {
              background: radial-gradient(
                ellipse 450px 160px at 50% 0%,
                color-mix(in srgb, var(--color-primary) 4%, transparent),
                transparent
              );
            }

            /* Smooth layout transitions */
            #agent-prompt, #msg-chips {
              transition: max-height 0.2s ease-out;
              overflow: hidden;
            }
            #custom-input-row {
              transition: max-height 0.2s ease-out, opacity 0.15s ease-out, margin 0.2s ease-out;
              overflow: hidden;
            }
            #custom-input-row.collapsed {
              max-height: 0 !important;
              opacity: 0;
              margin-top: 0;
            }

            /* Entrance */
            @keyframes enter {
              from { opacity: 0; transform: translateY(4px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .anim { animation: enter 0.25s ease-out both; }

            /* Scrollbar */
            ::-webkit-scrollbar { width: 5px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 9999px; }

            /* Selection */
            ::selection {
              background: color-mix(in srgb, var(--color-primary) 20%, transparent);
              color: var(--color-foreground);
            }
          `}</style>
        </head>
        <body class="font-sans min-h-screen">
          <div class="glow fixed inset-x-0 top-0 h-[300px] pointer-events-none" />

          <div class="relative max-w-[620px] mx-auto px-4 sm:px-5 py-5 sm:py-8">
            {/* ── Nav ─────────────────────────────────── */}
            <div class="anim" style="animation-delay: 0ms">
              <TopNav config={config} protocolBadges={protocolBadges} />
            </div>

            {/* ── Hero ────────────────────────────────── */}
            <div class="anim" style="animation-delay: 30ms">
              <HeroBanner config={config} />
            </div>

            {/* ── Prompt ──────────────────────────────── */}
            <div class="anim" style="animation-delay: 60ms">
              <PromptSection basePrompt={basePrompt} continuations={continuations} id="agent-prompt" />
            </div>

            {/* ── Footer ──────────────────────────────── */}
            <footer class="mt-14 pb-6 anim" style="animation-delay: 120ms">
              <Separator />
              <div class="flex items-center justify-center gap-1.5 mt-5">
                <span class="text-[11px] text-muted-foreground/60">powered by</span>
                <span class="text-[11px] text-primary font-semibold">aixyz</span>
              </div>
            </footer>
          </div>
        </body>
      </html>
    )
  );
}
