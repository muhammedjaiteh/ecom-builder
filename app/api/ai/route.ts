import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    // 🚀 Check for a real OpenAI Key in your .env.local file
    const apiKey = process.env.OPENAI_API_KEY;

    // 🛑 SIMULATION MODE: If no API key is found, we simulate the AI for testing!
    if (!apiKey) {
      // Fake a 1.5 second loading delay so the UI feels real
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      return NextResponse.json({
        description: `Experience the perfect blend of luxury and comfort with the ${prompt}. Crafted with premium materials, this piece elevates your everyday style. Featuring a sleek silhouette and unparalleled attention to detail, it is a must-have addition to your collection.\n\n• Premium quality materials\n• Designed for maximum comfort\n• Highly versatile and stylish\n• Limited District availability`
      });
    }

    // 🟢 REAL AI MODE: If you have an OpenAI key, it calls the real AI.
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an elite luxury fashion copywriter for a high-end boutique marketplace called Sanndikaa. Write a persuasive, SEO-optimized, luxury product description (under 80 words) with 3-4 bullet points at the end.'
          },
          {
            role: 'user',
            content: `Write a product description for: ${prompt}`
          }
        ],
      }),
    });

    const data = await response.json();
    return NextResponse.json({ description: data.choices[0].message.content });

  } catch (error) {
    console.error('AI Error:', error);
    return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 });
  }
}