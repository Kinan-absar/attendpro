
import { GoogleGenAI, Type } from "@google/genai";
import { AttendanceRecord } from "../types";

export const geminiService = {
  analyzeAttendance: async (history: AttendanceRecord[]) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Anonymize/Clean data for AI
    const historySummary = history.slice(0, 15).filter(r => r.checkOut).map(r => ({
      date: r.checkIn.toLocaleDateString(),
      duration: r.duration
    }));

    if (historySummary.length === 0) return null;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze these recent employee attendance duration records and provide a professional, encouraging work habit summary.
      Data (Durations in minutes): ${JSON.stringify(historySummary)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            trend: { type: Type.STRING, description: "positive, neutral, or negative" }
          },
          required: ["summary", "suggestions", "trend"]
        }
      }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      return null;
    }
  }
};
