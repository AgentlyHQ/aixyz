import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: {
    default: "ai-xyz.dev",
    template: "%s – ai-xyz.dev",
  },
  description: "Bundle AI agents from any framework into deployable services",
  openGraph: {
    title: "ai-xyz.dev",
    description: "Bundle AI agents from any framework into deployable services",
  },
};

const navbar = (
  <Navbar logo={<span style={{ fontSize: "1.5rem" }}>⟡ aixyz</span>} projectLink="https://github.com/AgentlyHQ/aixyz" />
);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/AgentlyHQ/aixyz/tree/main/website"
        >
          {children}
        </Layout>
        <Analytics />
      </body>
    </html>
  );
}
