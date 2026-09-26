import { AttendanceRecord } from "../types";

export const geminiService = {
  analyzeAttendance: async (history: AttendanceRecord[]) => {
    const historySummary = history
      .slice(0, 15)
      .filter((r) => r.checkOut)
      .map((r) => ({
        date: r.checkIn instanceof Date ? r.checkIn.toLocaleDateString() : new Date(r.checkIn).toLocaleDateString(),
        duration: r.duration,
      }));

    if (historySummary.length === 0) return null;

    try {
      const response = await fetch("/api/ai/analyze-attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ historySummary }),
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (e) {
      console.error("Failed to analyze attendance:", e);
      return null;
    }
  },
};
