import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

const ROOT_DIR = resolve(import.meta.dir, "../../..");
const CLI_PATH = resolve(import.meta.dir, "../src/index.ts");

let tmpDir: string;
let projectDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "create-aixyz-test-"));

  // Run the create-aixyz-app CLI to scaffold a project
  Bun.spawnSync(["bun", CLI_PATH, "--yes", "test-agent"], {
    cwd: tmpDir,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, npm_config_user_agent: "bun/1.0.0" },
  });

  projectDir = join(tmpDir, "test-agent");

  // Remove workspace:* deps from package.json so bun install can succeed
  const pkgPath = join(projectDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

  for (const section of ["dependencies", "devDependencies"] as const) {
    for (const [name, version] of Object.entries((pkg[section] as Record<string, string>) || {})) {
      if (version.startsWith("workspace:")) {
        delete pkg[section][name];
      }
    }
  }

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  const install = Bun.spawnSync(["bun", "install"], {
    cwd: projectDir,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (install.exitCode !== 0) {
    throw new Error("bun install failed");
  }

  // Symlink all workspace packages into node_modules
  const nodeModules = join(projectDir, "node_modules");
  const binDir = join(nodeModules, ".bin");
  mkdirSync(binDir, { recursive: true });

  for (const entry of readdirSync(join(ROOT_DIR, "packages"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(ROOT_DIR, "packages", entry.name);
    const pkgJsonPath = join(dir, "package.json");
    if (!existsSync(pkgJsonPath)) continue;
    const { name, bin } = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

    // Symlink the package
    const parts = name.split("/");
    const target = join(nodeModules, ...parts);
    if (parts.length > 1) {
      mkdirSync(join(nodeModules, parts[0]), { recursive: true });
    }
    rmSync(target, { recursive: true, force: true });
    symlinkSync(dir, target);

    // Create .bin entries
    if (typeof bin === "string") {
      symlinkSync(join(dir, bin), join(binDir, name));
    } else if (typeof bin === "object") {
      for (const [cmd, file] of Object.entries(bin as Record<string, string>)) {
        symlinkSync(join(dir, file), join(binDir, cmd));
      }
    }
  }
}, 120_000);

afterAll(() => {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe("create-aixyz-app", () => {
  test("scaffolded project has correct files", () => {
    expect(existsSync(join(projectDir, "package.json"))).toBe(true);
    expect(existsSync(join(projectDir, "aixyz.config.ts"))).toBe(true);
    expect(existsSync(join(projectDir, "app/agent.ts"))).toBe(true);
    expect(existsSync(join(projectDir, "app/tools/temperature.ts"))).toBe(true);
    expect(existsSync(join(projectDir, "app/icon.png"))).toBe(true);
    expect(existsSync(join(projectDir, ".gitignore"))).toBe(true);
    expect(existsSync(join(projectDir, ".env.local"))).toBe(true);
    expect(existsSync(join(projectDir, "vercel.json"))).toBe(true);
    expect(existsSync(join(projectDir, "tsconfig.json"))).toBe(true);
  });

  test("placeholders are replaced", () => {
    const config = readFileSync(join(projectDir, "aixyz.config.ts"), "utf8");
    expect(config).not.toContain("{{AGENT_NAME}}");
    expect(config).not.toContain("{{PKG_NAME}}");
    expect(config).not.toContain("{{PAY_TO}}");
    expect(config).toContain("test-agent");
    expect(config).toContain("0x");

    const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8"));
    expect(pkg.name).toBe("test-agent");
  });

  test("build succeeds", () => {
    const result = Bun.spawnSync(["bun", "run", "build"], {
      cwd: projectDir,
      stdout: "inherit",
      stderr: "inherit",
    });

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(projectDir, ".aixyz/output/server.js"))).toBe(true);
    expect(existsSync(join(projectDir, ".aixyz/output/package.json"))).toBe(true);
    expect(existsSync(join(projectDir, ".aixyz/output/icon.png"))).toBe(true);
  }, 30_000);

  test("dev server starts and serves agent card", async () => {
    const port = "19876";
    const proc = Bun.spawn(["bun", "run", "dev", "-p", port], {
      cwd: projectDir,
      stdout: "inherit",
      stderr: "inherit",
    });

    try {
      let agentCard: Record<string, unknown> | null = null;

      // Poll until the server is ready (max 30s)
      for (let i = 0; i < 30; i++) {
        await Bun.sleep(1000);
        try {
          const res = await fetch(`http://localhost:${port}/.well-known/agent-card.json`);
          if (res.ok) {
            agentCard = (await res.json()) as Record<string, unknown>;
            break;
          }
        } catch {
          // Server not ready yet
        }
      }

      expect(agentCard).not.toBeNull();
      expect(agentCard!.name).toBe("test-agent");
    } finally {
      proc.kill();
      await proc.exited;
    }
  }, 60_000);
});
