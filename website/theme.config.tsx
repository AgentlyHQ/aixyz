import type { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: <span style={{ fontSize: "1.5rem" }}>🐁 ai-xyz.dev</span>,
  project: {
    link: "https://github.com/AgentlyHQ/aixyz",
  },
  docsRepositoryBase: "https://github.com/AgentlyHQ/aixyz/tree/main/website",
  footer: {
    content: (
      <span>
        MIT {new Date().getFullYear()} ©{" "}
        <a href="https://github.com/AgentlyHQ" target="_blank" rel="noreferrer">
          Agently
        </a>
      </span>
    ),
  },
  useNextSeoProps() {
    return {
      titleTemplate: "%s – ai-xyz.dev",
    };
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="ai-xyz.dev" />
      <meta property="og:description" content="Bundle AI agents from any framework into deployable services" />
    </>
  ),
};

export default config;
