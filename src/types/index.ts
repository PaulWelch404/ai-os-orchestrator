export type Agent = {
  id: string;
  name: string;
  endpoint: string;
  model: string;
  status: 'online' | 'offline' | 'busy';
  lastResponseTime: number;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  agentId?: string;
  timestamp: number;
};

export type OrchestratorState = {
  agents: Agent[];
  activeAgentId: string | null;
};
