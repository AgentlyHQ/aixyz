import t from "@bomb.sh/tab";

// Define the dev command with completions
const devCmd = t.command("dev", "Start a local development server");
devCmd.option("port", "Port to listen on", (complete) => {
  complete("3000", "Default development port");
  complete("8080", "Alternative port");
  complete("4000", "Alternative port");
});

// Define the build command
t.command("build", "Build the aixyz agent for Vercel deployment");

// Define the complete command (for shell setup)
t.command("complete", "Generate shell completion script");

export { t };
