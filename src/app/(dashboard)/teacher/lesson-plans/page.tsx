"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Loader2, BookMarked, Copy, Check, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function LessonPlansPage() {
  const [form, setForm] = useState({ subject: "", class: "", topic: "", duration: "40" });
  const [plan, setPlan] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!form.subject || !form.class || !form.topic) {
      return toast({ title: "Please fill in all required fields", variant: "destructive" });
    }
    setLoading(true);
    setPlan(null);

    try {
      const res = await fetch("/api/ai/lesson-plan", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setPlan(data.plan);
    } catch {
      toast({ title: "Failed to generate lesson plan", description: "Check your AI API key", variant: "destructive" });
      // Fallback demo data
      setPlan({
        topic: form.topic,
        objectives: "By the end of this lesson, students should be able to:\n1. Define and explain the key concepts\n2. Identify the main components\n3. Apply the knowledge to solve related problems",
        materials: "Whiteboard, markers, textbook, handouts, projector (if available)",
        introduction: "Begin with a thought-provoking question related to the topic. Ask students what they already know and build on their prior knowledge.",
        activities: "1. Interactive lecture with visual aids\n2. Group discussion\n3. Hands-on practice exercise\n4. Question and answer session",
        teacherActivity: "Explain concepts clearly using examples. Circulate around the class to provide individual support. Ask guiding questions.",
        studentActivity: "Listen actively, take notes, participate in discussions, complete practice exercises, ask questions.",
        assessment: "1. Oral questions during the lesson\n2. Short quiz at the end\n3. Homework assignment\n4. Observation of student participation",
        homework: "Research and write a one-page summary on the topic. Be prepared to discuss in the next class.",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!plan) return;
    const text = Object.entries(plan).map(([k, v]) => `${k.toUpperCase()}\n${v}`).join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast({ title: "Copied to clipboard!", variant: "success" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" /> AI Lesson Plan Generator
        </h2>
        <p className="text-muted-foreground">Generate comprehensive lesson plans with AI in seconds</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2"><Label>Subject *</Label><Input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="e.g. Basic Science" /></div>
            <div className="space-y-2"><Label>Class *</Label><Input value={form.class} onChange={e => setForm({...form, class: e.target.value})} placeholder="e.g. Primary 5" /></div>
            <div className="space-y-2"><Label>Topic *</Label><Input value={form.topic} onChange={e => setForm({...form, topic: e.target.value})} placeholder="e.g. Digestive System" /></div>
            <div className="space-y-2"><Label>Duration (min)</Label>
              <Select value={form.duration} onValueChange={v => setForm({...form, duration: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["20", "30", "40", "45", "60", "80"].map(m => <SelectItem key={m} value={m}>{m} min</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={loading} className="mt-4" variant="gradient">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Brain className="mr-2 h-4 w-4" /> Generate Lesson Plan</>}
          </Button>
        </CardContent>
      </Card>

      {plan && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookMarked className="h-5 w-5 text-primary" />
              {form.subject}: {form.topic}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                {copied ? <><Check className="mr-1 h-4 w-4" /> Copied</> : <><Copy className="mr-1 h-4 w-4" /> Copy</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(plan).map(([key, value]) => (
              <div key={key}>
                <h4 className="text-sm font-semibold text-primary mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{value}</p>
              </div>
            ))}
            <div className="pt-4 border-t flex justify-end">
              <Button variant="gradient" size="sm"><Save className="mr-2 h-4 w-4" /> Save Lesson Plan</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!plan && !loading && (
        <Card className="gradient-card border-primary/10">
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 mx-auto text-primary/60 mb-4" />
            <h3 className="text-lg font-semibold mb-2">AI-Powered Lesson Planning</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Fill in the subject, class, and topic. Our AI will generate a complete lesson plan 
              with objectives, materials, activities, assessments, and homework.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
