import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Agent, OrchestratorState } from '@/types';

interface AIOSStore extends OrchestratorState {
  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  updateAgentStatus: (id: string, status: Agent['status'], responseTime?: number) => void;
  setActiveAgent: (id: string | null) => void;
}

export const useAIOSStore = create<AIOSStore>()(
  persist(
    (set) => ({
      agents: [],
      activeAgentId: null,
      addAgent: (agent) => 
        set((state) => ({ agents: [...state.agents, agent] })),
      removeAgent: (id) => 
        set((state) => ({ 
          agents: state.agents.filter(a => a.id !== id),
          activeAgentId: state.activeAgentId === id ? null : state.activeAgentId
        })),
      updateAgentStatus: (id, status, responseTime) => 
        set((state) => ({
          agents: state.agents.map(a => 
            a.id === id ? { ...a, status, lastResponseTime: responseTime ?? a.lastResponseTime } : a
          ),
        })),
      setActiveAgent: (id) => set({ activeAgentId: id }),
    }),
    {
      name: 'ai-os-storage',
    }
  )
);
