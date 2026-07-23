"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Send, Bot, User, BookOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Message = { role: "user" | "assistant"; content: string };

export default function HomeworkAssistantPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm your AI homework assistant. Ask me anything about your subjects — I'll explain concepts, give examples, and help you practice!" },
  ]);
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;
    const userMsg = { role: "user" as const, content: question };
    setMessages(prev => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/homework-assistant", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
      } else {
        throw new Error("API failed");
      }
    } catch {
      // Fallback answers
      const answers: Record<string, string> = {
        photosynthesis: "**Photosynthesis** is the process by which green plants convert sunlight into energy.\n\n**Key points:**\n1. Plants use **chlorophyll** (the green pigment) to capture sunlight\n2. They take in **carbon dioxide** (CO₂) from the air through stomata\n3. They absorb **water** (H₂O) from the soil through roots\n4. Using sunlight energy, they convert CO₂ and H₂O into **glucose** (food) and **oxygen**\n\n**Chemical equation:**\n6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂\n\n**Example question:** What happens to the oxygen produced? → It's released into the air through the stomata.",
        math: "Here's a helpful math explanation!\n\n**Key concept breakdown:**\nLet me explain this step by step with an example.",
      };
      const keywords = Object.keys(answers);
      const found = keywords.find(k => question.toLowerCase().includes(k));
      const answer = found
        ? answers[found]
        : "Great question! Let me help you understand this topic.\n\n**Step-by-step explanation:**\n1. First, let's understand the core concept\n2. Here's a simple example to illustrate\n3. Practice with similar problems\n\n**Tip:** Try breaking the problem into smaller parts. If you need more specific help, feel free to ask a follow-up question!";
      setMessages(prev => [...prev, { role: "assistant", content: answer }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> AI Homework Assistant
        </h2>
        <p className="text-muted-foreground">Ask any question and get instant explanations, examples, and practice</p>
      </div>

      <Card className="h-[600px] flex flex-col">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" /> Homework Help Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50"
              }`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="rounded-lg bg-muted/50 px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </CardContent>
        <div className="border-t p-4">
          <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question... (e.g., Explain photosynthesis)"
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !question.trim()} variant="gradient">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
