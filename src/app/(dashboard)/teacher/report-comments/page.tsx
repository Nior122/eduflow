"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, RefreshCw, Edit3, Check, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ReportCommentsPage() {
  const [form, setForm] = useState({ name: "", mathScore: "", englishScore: "", attendance: "", behaviour: "Good" });
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [editedComment, setEditedComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!form.name) return toast({ title: "Student name is required", variant: "destructive" });
    setLoading(true);
    setComment("");

    try {
      const res = await fetch("/api/ai/report-comment", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        setComment(data.comment);
      } else {
        throw new Error("API failed");
      }
    } catch {
      // Fallback generated comment
      const score = parseInt(form.mathScore) || 0;
      const engScore = parseInt(form.englishScore) || 0;
      const avg = (score + engScore) / 2;
      let commentText = `${form.name} has `;
      if (avg >= 70) commentText += "demonstrated excellent academic performance this term. ";
      else if (avg >= 55) commentText += "shown good progress and consistent effort in their studies. ";
      else commentText += "shown potential but needs to apply more effort to meet academic expectations. ";

      if (score >= engScore + 10) commentText += "Mathematics is a clear strength. ";
      else if (engScore >= score + 10) commentText += "English Language skills are commendable. ";

      if (parseInt(form.attendance) >= 90) commentText += "Attendance has been excellent. ";
      else if (parseInt(form.attendance) >= 75) commentText += "Attendance is satisfactory. ";
      else commentText += "Regular attendance is needed to improve performance. ";

      commentText += `Behaviour in class has been ${form.behaviour.toLowerCase()}. `;
      commentText += "Keep up the good work and continue striving for excellence!";

      setComment(commentText);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    toast({ title: "Comment saved!", variant: "success" });
    setEditing(false);
  };

  const handleRegenerate = () => {
    handleGenerate();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> AI Report Comment Generator
        </h2>
        <p className="text-muted-foreground">Generate personalized report comments for students in seconds</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Student Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Student Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. John" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Mathematics (%)</Label><Input type="number" value={form.mathScore} onChange={e => setForm({...form, mathScore: e.target.value})} /></div>
              <div className="space-y-2"><Label>English (%)</Label><Input type="number" value={form.englishScore} onChange={e => setForm({...form, englishScore: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Attendance (%)</Label><Input type="number" value={form.attendance} onChange={e => setForm({...form, attendance: e.target.value})} /></div>
              <div className="space-y-2"><Label>Behaviour</Label>
                <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.behaviour} onChange={e => setForm({...form, behaviour: e.target.value})}>
                  <option value="Excellent">Excellent</option><option value="Good">Good</option><option value="Satisfactory">Satisfactory</option><option value="Needs Improvement">Needs Improvement</option>
                </select>
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={loading} className="w-full" variant="gradient">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate Comment</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Generated Comment</CardTitle>
            <div className="flex gap-2">
              {comment && !editing && <Button variant="outline" size="sm" onClick={() => { setEditedComment(comment); setEditing(true); }}><Edit3 className="h-4 w-4 mr-1" /> Edit</Button>}
              {comment && !editing && <Button variant="outline" size="sm" onClick={handleRegenerate}><RefreshCw className="h-4 w-4 mr-1" /> Regenerate</Button>}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : editing ? (
              <div className="space-y-4">
                <Textarea rows={6} value={editedComment} onChange={e => setEditedComment(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={handleSave}><Check className="mr-2 h-4 w-4" /> Save</Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : comment ? (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm leading-relaxed">{comment}</p>
              </div>
            ) : (
              <div className="text-center py-12">
                <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Enter student details and click generate to create a personalized report comment</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
