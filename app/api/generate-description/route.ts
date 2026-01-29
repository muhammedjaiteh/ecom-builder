import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { productName } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // We use the model your scanner found. 
    // If this fails due to account warm-up, we catch the error below.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Write a short, catchy product description (max 2 sentences) for a product named "${productName}". Use emojis. Make it sound exciting for a customer in The Gambia.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ description: text });
  } catch (error: any) {
    console.error("AI Error:", error);
    // Graceful Fallback: If AI fails, return this generic text so the user isn't stuck.
    return NextResponse.json({ description: "A high-quality product from our collection. ✨" });
  }
}