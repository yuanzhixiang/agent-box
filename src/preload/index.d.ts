import type { AgentBoxApi } from "../shared/types";

declare global {
  interface Window {
    agentBox: AgentBoxApi;
  }
}
