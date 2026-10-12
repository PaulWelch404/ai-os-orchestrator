"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAIOSStore } from '@/store/useAIOSStore';
import { Agent, ChatMessage } from '@/types';
import { Send, Server, Plus, Trash2, Activity, Terminal, Cpu } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function AIOSDashboard() {
  const { agents, addAgent, removeAgent, updateAgentStatus, activeAgentId, setActiveAgent } = useAIOSStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Agent Form State
  const [newAgent, setNewAgent] = useState({ name: '', endpoint: 'http://localhost:11434', model: '' });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-discover local agents if registry is empty
  useEffect(() => {
    if (agents.length === 0) {
      const discoveredAgents = [
        { id: 'qwen35', name: 'Qwen 3.5', endpoint: 'http://localhost:11434', model: 'qwen3.5:4b' },
        { id: 'gemma4', name: 'Gemma 4', endpoint: 'http://localhost:11434', model: 'gemma4:12b' },
        { id: 'qwen-coder', name: 'Qwen Coder', endpoint: 'http://localhost:11434', model: 'qwen2.5-coder:latest' },
      ];

      discoveredAgents.forEach(agent => {
        addAgent({
          ...agent,
          status: 'online',
          lastResponseTime: 0,
        });
      });
    }
  }, []);

  const handleAddAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgent.name || !newAgent.model) return;
    
    const agent: Agent = {
      id: Math.random().toString(36).substr(2, 9),
      ...newAgent,
      status: 'online',
      lastResponseTime: 0,
    };
    addAgent(agent);
    setNewAgent({ name: '', endpoint: 'http://localhost:11434', model: '' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || agents.length === 0) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // --- LOAD BALANCING LOGIC ---
    // 1. Filter online agents
    const availableAgents = agents.filter(a => a.status !== 'offline');
    if (availableAgents.length === 0) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'System Error: No online agents available.', 
        timestamp: Date.now() 
      }]);
      setIsTyping(false);
      return;
    }

    // 2. Simple Load Balancer: Pick the one with the lowest lastResponseTime
    // (or random if all are 0)
    const sortedAgents = [...availableAgents].sort((a, b) => a.lastResponseTime - b.lastResponseTime);
    const selectedAgent = sortedAgents[0];
    setActiveAgent(selectedAgent.id);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg.content,
          agentId: selectedAgent.id,
          endpoint: selectedAgent.endpoint,
          model: selectedAgent.model,
        }),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.content,
        agentId: selectedAgent.id,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      
      // Update agent stats
      updateAgentStatus(selectedAgent.id, 'online', data.responseTime);
    } catch (err: any) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Agent ${selectedAgent.name} failed: ${err.message}`, 
        timestamp: Date.now() 
      }]);
      updateAgentStatus(selectedAgent.id, 'offline');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-slate-300 font-mono overflow-hidden">
      {/* Sidebar: Agent Management */}
      <aside className="w-80 border-r border-slate-800 bg-[#0f0f11] flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <Cpu className="text-cyan-500" size={24} />
          <h1 className="text-lg font-bold text-white tracking-tighter">AI-OS CORE</h1>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Server size={14} /> Registered Agents
          </h2>
          
          <div className="space-y-3 mb-8">
            {agents.map(agent => (
              <div 
                key={agent.id} 
                className={cn(
                  "p-3 rounded-lg border transition-all cursor-pointer group",
                  activeAgentId === agent.id 
                    ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400" 
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                )}
                onClick={() => setActiveAgent(agent.id)}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm">{agent.name}</span>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      agent.status === 'online' ? "bg-green-500 animate-pulse" : "bg-red-500"
                    )} />
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeAgent(agent.id); }}
                      className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 truncate">{agent.model}</div>
                <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-1">
                  <Activity size={10} /> {agent.lastResponseTime}ms
                </div>
              </div>
            ))}
            {agents.length === 0 && (
              <div className="text-xs text-slate-600 italic text-center py-4">No agents configured</div>
            )}
          </div>

          <div className="border-t border-slate-800 pt-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Plus size={14} /> Add New Agent
            </h2>
            <form onSubmit={handleAddAgent} className="space-y-3">
              <input 
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="Agent Name (e.g. Llama-Local)"
                value={newAgent.name}
                onChange={e => setNewAgent({...newAgent, name: e.target.value})}
              />
              <input 
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="Endpoint (http://localhost:11434)"
                value={newAgent.endpoint}
                onChange={e => setNewAgent({...newAgent, endpoint: e.target.value})}
              />
              <input 
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                placeholder="Model Name (e.g. llama3)"
                value={newAgent.model}
                onChange={e => setNewAgent({...newAgent, model: e.target.value})}
              />
              <button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-2">
                <Plus size={14} /> Register Agent
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-[#0a0a0b]/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <Terminal size={20} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-400">SYSTEM_TERMINAL // Unified_Session</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">
              STATUS: <span className="text-green-500">OPERATIONAL</span>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
              <Terminal size={48} className="text-slate-700" />
              <p className="max-w-xs text-sm">
                Welcome to AI-OS. Add local agents in the sidebar to begin orchestrating requests.
              </p>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={cn(
                "flex flex-col max-w-3xl mx-auto group",
                msg.role === 'user' ? "items-end" : "items-start"
              )}
            >
              <div className={cn(
                "text-[10px] mb-1 uppercase tracking-widest opacity-50",
                msg.role === 'user' ? "text-right" : "text-left"
              )}>
                {msg.role === 'user' ? 'User_Entity' : (msg.agentId ? `Agent_${msg.agentId}` : 'System')}
              </div>
              <div className={cn(
                "p-3 rounded-lg text-sm leading-relaxed",
                msg.role === 'user' 
                  ? "bg-cyan-600 text-white rounded-tr-none" 
                  : "bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none"
              )}>
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex flex-col items-start max-w-3xl mx-auto">
              <div className="text-[10px] mb-1 uppercase tracking-widest opacity-50 text-left">
                Orchestrator_Processing...
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg rounded-tl-none text-sm">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-6 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b] to-transparent">
          <form 
            onSubmit={handleSendMessage}
            className="max-w-3xl mx-auto relative group"
          >
            <input 
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 pl-4 pr-14 text-sm focus:outline-none focus:border-cyan-500 transition-all shadow-2xl"
              placeholder="Send instruction to AI-OS..."
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button 
              type="submit"
              disabled={!input.trim() || agents.length === 0}
              className="absolute right-2 top-2 p-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 transition-all"
            >
              <Send size={18} />
            </button>
          </form>
          <div className="text-center mt-3">
            <p className="text-[10px] text-slate-600">
              Routed through LoadBalancer v1.0 // LocalModel-Proxy active
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
