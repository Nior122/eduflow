import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { validate, lessonPlanSchema } from "@/lib/validations";

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
    const parsed = validate(lessonPlanSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.issues }, { status: 400 });
    }
    const { subject, class: cls, topic, duration } = parsed.data;

    // Try OpenAI-compatible API if available
    if (process.env.OPENAI_API_KEY) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an expert teacher creating detailed lesson plans. Return a JSON object with these keys: topic, objectives, materials, introduction, activities, teacherActivity, studentActivity, assessment, homework. Each value should be a string with clear, actionable content.",
            },
            {
              role: "user",
              content: `Create a ${duration}-minute lesson plan for ${subject} (${cls}) on the topic "${topic}".`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const plan = JSON.parse(data.choices?.[0]?.message?.content || "{}");
        return NextResponse.json({ plan });
      }
    }

    // Fallback structured response
    return NextResponse.json({
      plan: {
        topic,
        objectives:
          "By the end of this lesson, students should be able to:\n1. Define and explain the key concepts related to " +
          topic +
          "\n2. Identify the main components and their relationships\n3. Apply the knowledge to practical examples and problems",
        materials: "Whiteboard and markers, Textbook, Handouts/worksheets, Projector (if available), Relevant visual aids",
        introduction:
          "Begin with an engaging question or scenario related to " +
          topic +
          ". Ask students what they already know. Share the learning objectives for the lesson.",
        activities:
          "1. Concept explanation and discussion (10 min)\n2. Group activity or pair work (10 min)\n3. Guided practice (10 min)\n4. Independent work (remaining time)",
        teacherActivity:
          "Explain concepts with clear examples. Use questioning to check understanding. Provide scaffolding and support. Circulate and give feedback during practice.",
        studentActivity:
          "Listen and take notes. Ask and answer questions. Work in groups to solve problems. Complete individual practice exercises.",
        assessment:
          "Formative: Oral questions during lesson, observation of group work\nSummative: End-of-lesson quiz, homework assignment\nPeer assessment during group activities",
        homework:
          "Complete the practice worksheet. Write a short paragraph explaining what you learned about " +
          topic +
          ". Be prepared for a quick review next lesson.",
      },
    });
  } catch (error) {
    console.error("Lesson plan generation error:", error);
    return NextResponse.json({ error: "Failed to generate lesson plan" }, { status: 500 });
  }
}
