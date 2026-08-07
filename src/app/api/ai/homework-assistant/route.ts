import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`ai:${session.user.id}`, { limit: 60, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = z.object({ question: z.string().min(1, "Question is required").max(2000) }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    const { question } = parsed.data;

    if (process.env.OPENAI_API_KEY) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a helpful homework assistant for primary and secondary school students. Give clear, age-appropriate explanations with examples. Encourage critical thinking." },
            { role: "user", content: question },
          ],
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          answer: data.choices?.[0]?.message?.content || "I'm not sure about that. Can you ask another question?",
        });
      }
    }

    // Keyword-based fallback
    const q = question.toLowerCase();
    let answer = "";
    if (q.includes("photosynthesis")) {
      answer = "**Photosynthesis** is how plants make their own food.\n\n🌱 Plants use **sunlight**, **water**, and **carbon dioxide** to produce **glucose** (food) and **oxygen**.\n\n**Simple formula:**\nSunlight + Water + CO₂ → Glucose + Oxygen\n\n**Fun fact:** The oxygen we breathe comes mostly from photosynthesis!";
    } else if (q.includes("math") || q.includes("algebra") || q.includes("equation")) {
      answer = "**Let's solve this step by step!** 📐\n\n1. First, identify what the problem is asking\n2. Write down what you know\n3. Choose the right formula or method\n4. Solve step by step\n5. Check your answer\n\nWant to give me a specific problem to work through?";
    } else if (q.includes("gravity") || q.includes("force")) {
      answer = "**Gravity** is a force that pulls objects toward each other. 🌍\n\n- Sir Isaac Newton discovered gravity when an apple fell from a tree\n- Earth's gravity keeps us on the ground\n- Gravity is what makes things fall down, not up\n- The moon stays in orbit because of Earth's gravity\n\n**Try this:** Drop a pen and a book at the same time — they fall at the same speed!";
    } else {
      answer = "Great question! 🎯\n\nLet me explain:\n\n**Key concept:** This topic is important because it helps us understand how things work.\n\n**Simple explanation:** Think of it like building blocks — each piece connects to the next.\n\n**Example:** Try breaking down the problem into smaller steps. Start with what you know and work forward.\n\n**Practice tip:** The more you practice, the easier it gets! Can you tell me more about what specific part you're working on?";
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Homework assistant error:", error);
    return NextResponse.json({
      answer: "I'm having trouble answering right now. Please try asking your question in a different way!",
    });
  }
}
