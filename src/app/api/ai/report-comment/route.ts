import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const inputSchema = z.object({
  name: z.string().max(200).optional(),
  mathScore: z.string().or(z.number()).optional(),
  englishScore: z.string().or(z.number()).optional(),
  attendance: z.string().or(z.number()).optional(),
  behaviour: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`ai:${session.user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    const { name = "the student", mathScore, englishScore, attendance, behaviour = "Good" } = parsed.data;

    if (process.env.OPENAI_API_KEY) {
      const prompt = `Generate a brief, professional report comment for a student named ${name}.
Math Score: ${mathScore ?? "N/A"}%
English Score: ${englishScore ?? "N/A"}%
Attendance: ${attendance ?? "N/A"}%
Behaviour: ${behaviour}

Write 3-4 sentences in a supportive, constructive tone. Mention strengths and areas for improvement.`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 300,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const comment = data.choices?.[0]?.message?.content ?? "";
        if (comment) return NextResponse.json({ comment });
      }
    }

    // Fallback
    const m = parseFloat(String(mathScore ?? 0)) || 0;
    const e = parseFloat(String(englishScore ?? 0)) || 0;
    const avg = (m + e) / 2;
    let comment = `${name} has `;
    if (avg >= 70) comment += "demonstrated excellent academic performance this term, showing a strong grasp of the material. ";
    else if (avg >= 55) comment += "shown good progress and consistent effort in their studies this term. ";
    else comment += "shown potential but needs to apply more effort to meet academic expectations. ";

    if (m > e + 10) comment += "Mathematics is a clear strength. ";
    else if (e > m + 10) comment += "English Language skills are commendable. ";

    const att = parseInt(String(attendance ?? 0)) || 0;
    if (att >= 90) comment += "Attendance has been excellent. ";
    else if (att >= 75) comment += "Attendance is satisfactory. ";
    else comment += "Regular attendance is needed to improve performance. ";

    comment += `Behaviour in class has been ${behaviour.toLowerCase() || "good"}. Continue striving for excellence!`;

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("Report comment generation error:", error);
    return NextResponse.json({ error: "Failed to generate comment" }, { status: 500 });
  }
}
