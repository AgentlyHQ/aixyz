import nextra from "nextra";

const withNextra = nextra({
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.tsx",
});

export default withNextra({
  output: "standalone",
  // If you'd like to enable static export for Vercel, uncomment:
  // output: "export",
  // images: { unoptimized: true },
});
