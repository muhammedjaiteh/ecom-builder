import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.OPENAI_API_KEY;

    // 🟢 REAL AI MODE: Attempt to use OpenAI if a key exists
    if (apiKey) {
      try {
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

        // If OpenAI successfully gives us a description, return it!
        if (data.choices && data.choices[0]) {
          return NextResponse.json({ description: data.choices[0].message.content });
        } else {
          console.warn("OpenAI API rejected the request (likely invalid key or out of credits). Falling back to simulation.", data);
        }
      } catch (openAiError) {
        console.error("Failed to connect to OpenAI. Falling back to simulation.", openAiError);
      }
    }

    // 🛑 SIMULATION MODE: Fallback if there is no key, or if the key failed
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Fake 1.5s delay
    
    return NextResponse.json({
      description: `Experience the perfect blend of luxury and comfort with the ${prompt}. Crafted with premium materials, this piece elevates your everyday style. Featuring a sleek silhouette and unparalleled attention to detail, it is a must-have addition to your collection.\n\n• Premium quality materials\n• Designed for maximum comfort\n• Highly versatile and stylish\n• Limited District availability`
    });

  } catch (error) {
    console.error('Fatal API Error:', error);
    return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 });
  }
}