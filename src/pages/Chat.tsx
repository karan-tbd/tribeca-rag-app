import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import Header from "@/components/Header";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
}

interface Session {
  id: string;
  title: string;
  agent: { name: string };
}

export default function Chat() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    loadAgents();
    loadSessions();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAgents = async () => {
    const { data } = await supabase
      .from("agents")
      .select("id, name")
      .order("updated_at", { ascending: false });
    setAgents(data || []);
    if (data && data.length > 0) setSelectedAgent(data[0].id);
  };

  const loadSessions = async () => {
    const { data } = await supabase
      .from("sessions")
      .select("id, title, agent:agents(name)")
      .order("created_at", { ascending: false });
    setSessions(data || []);
  };

  const loadMessages = async (sessionId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    setMessages((data || []).map(msg => ({
      ...msg,
      role: msg.role as 'user' | 'assistant'
    })));
  };

  const createSession = async () => {
    if (!selectedAgent) {
      toast({ title: "Please select an agent first" });
      return;
    }

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: user!.id,
        agent_id: selectedAgent,
        title: "New Chat"
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Failed to create session", description: error.message });
      return;
    }

    setCurrentSession(data.id);
    setMessages([]);
    loadSessions();
  };

  const selectSession = (sessionId: string) => {
    setCurrentSession(sessionId);
    loadMessages(sessionId);
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentSession || !selectedAgent || loading) return;

    setLoading(true);
    const userMessage = input.trim();
    setInput("");

    // Add user message to UI immediately
    const tempUserMessage = {
      id: 'temp-user',
      role: 'user' as const,
      content: userMessage,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      // Save user message
      await supabase.from("messages").insert({
        session_id: currentSession,
        role: 'user',
        content: userMessage
      });

      // Query the agent
      const { data, error } = await supabase.functions.invoke('query-agent', {
        body: {
          query: userMessage,
          agentId: selectedAgent,
          sessionId: currentSession,
          userId: user!.id
        }
      });

      if (error) throw error;

      const assistantMessage = {
        id: 'temp-assistant',
        role: 'assistant' as const,
        content: data.answer || "I couldn't process your request.",
        created_at: new Date().toISOString()
      };

      // Save assistant message
      await supabase.from("messages").insert({
        session_id: currentSession,
        role: 'assistant',
        content: assistantMessage.content
      });

      // Reload messages from database
      loadMessages(currentSession);

    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast({ title: "Failed to send message", description: error.message });
      // Remove temporary user message on error
      setMessages(prev => prev.filter(m => m.id !== 'temp-user'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-muted/30 border-r p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Agent</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>
          
          <Button onClick={createSession} className="w-full">
            New Chat
          </Button>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Recent Sessions</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => selectSession(session.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-muted transition-colors ${
                    currentSession === session.id ? 'bg-muted' : ''
                  }`}
                >
                  <div className="truncate">{session.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {session.agent?.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {currentSession ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={`${message.id}-${index}`}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <Card className={`max-w-[80%] ${
                      message.role === 'user' ? 'bg-primary text-primary-foreground' : ''
                    }`}>
                      <CardContent className="p-3">
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <Card className="max-w-[80%]">
                      <CardContent className="p-3">
                        <p className="text-sm text-muted-foreground">Thinking...</p>
                      </CardContent>
                    </Card>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask a question..."
                    disabled={loading}
                  />
                  <Button onClick={sendMessage} disabled={loading || !input.trim()}>
                    Send
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Welcome to Chat</h2>
                <p className="text-muted-foreground mb-4">
                  Select an agent and create a new session to start chatting
                </p>
                {agents.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No agents found. Please create an agent first.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}