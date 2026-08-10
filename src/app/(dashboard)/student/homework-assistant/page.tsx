"use client";

import { Sparkles } from "lucide-react";
import { ChatPanel } from "@/components/ai/chat-panel";

export default function HomeworkAssistantPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Homework Assistant
        </h2>
        <p className="text-muted-foreground">
          Ask questions about any subject. I explain concepts, work through examples and give hints — never just the answer.
        </p>
      </div>
      <ChatPanel
        endpoint="/api/ai/homework-assistant"
        placeholder="Ask a question… e.g. Explain photosynthesis, or help me solve 2x + 5 = 13"
        subjectTopicLabel="any subject"
      />
    </div>
  );
}
