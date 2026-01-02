import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// IMPORTANT: The API key is injected via process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Sends a specific question about a screen capture to Gemini.
 */
export const askAboutScreen = async (base64Image: string, question: string): Promise<string> => {
  try {
    // Remove data URL prefix if present
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    // Using Gemini 2.5 Flash for speed and multimodal capabilities
    const model = "gemini-2.5-flash-latest"; 
    
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: "image/png",
            },
          },
          {
            text: `You are a helpful screen assistant. The user has provided a screenshot of their device.
            
            User Question: "${question}"
            
            Instructions:
            1. Analyze the image or the specific part relevant to the question.
            2. Provide a clear, direct, and concise answer.
            3. If the user asks to solve a problem (math, code), solve it.
            4. If the user asks for design details, describe them.
            
            Answer in plain text. Do not use markdown blocks unless providing code.`,
          },
        ],
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return text.trim();

  } catch (error) {
    console.error("Gemini Q&A Error:", error);
    return "I couldn't analyze the screen right now. Please try capturing again.";
  }
};