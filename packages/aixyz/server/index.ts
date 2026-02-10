import { DefaultRequestHandler, TaskStore, AgentExecutor } from "@a2a-js/sdk/server";
import { AgentCard } from "@a2a-js/sdk";
import { loadAixyzConfig } from "../config";

export function getAgentCard(): AgentCard {
  const config = loadAixyzConfig();
  return {
    name: config.name,
    description: config.description,
    protocolVersion: "0.3.0",
    version: config.version,
    url: new URL("/agent", config.url).toString(),
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: config.skills,
  };
}

export class AixyzRequestHandler extends DefaultRequestHandler {
  constructor(taskStore: TaskStore, agentExecutor: AgentExecutor) {
    super(getAgentCard(), taskStore, agentExecutor);
  }
}
