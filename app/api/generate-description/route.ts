import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Connect to the AI using your secret key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { name } = await request.json();

    // The Prompt Engineering: We teach the AI how to be a Gambian marketer
    const prompt = `You are a professional sales expert for Gambia Store. 
    Write a short, catchy, and premium product description for: "${name}".
    
    Target Audience: Gambian locals and tourists.
    Tone: Authentic, trustworthy, enthusiastic.
    Requirements:
    - Mention it is high quality.
    - Mention "Available for instant delivery".
    - Keep it under 3 sentences.
    - Add 2 relevant emojis.`;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
    });

    const description = completion.choices[0].message.content;

    return NextResponse.json({ description });
  } catch (error) {
    console.error('AI Error:', error);
    return NextResponse.json({ error: 'AI failed to generate.' }, { status: 500 });
  }
}