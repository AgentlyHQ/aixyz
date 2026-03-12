import { getAixyzConfigRuntime } from "@aixyz/config";
import { BasePlugin } from "../plugin";
import type { AixyzApp } from "../index";

/** Plugin that registers a plain-text index page displaying the agent's name, description, version, and skills. */
export class IndexPagePlugin extends BasePlugin {
  readonly name = "index-page";

  constructor(private path = "/") {
    super();
  }

  register(app: AixyzApp): void {
    const config = getAixyzConfigRuntime();
    if (!this.path.startsWith("/")) {
      throw new Error(`Invalid path: ${this.path}. Path must start with "/"`);
    }

    app.route("GET", this.path, () => {
      let text = `${config.name}\n`;
      text += `${"=".repeat(config.name.length)}\n\n`;
      text += `Description: ${config.description}\n`;
      text += `Version: ${config.version}\n\n`;

      if (config.skills && config.skills.length > 0) {
        text += `Skills:\n`;
        config.skills.forEach((skill, index) => {
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

      return new Response(text, { headers: { "Content-Type": "text/plain" } });
    });
  }
}
