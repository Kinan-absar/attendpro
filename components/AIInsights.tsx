
import React, { useState, useEffect } from 'react';
import { AttendanceRecord, AIInsight } from '../types';
import { geminiService } from '../services/geminiService';

interface Props {
  history: AttendanceRecord[];
}

const AIInsights: React.FC<Props> = ({ history }) => {
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInsight = async () => {
    if (history.length === 0) return;
    setLoading(true);
    try {
      const res = await geminiService.analyzeAttendance(history);
      setInsight(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex items-center space-x-4">
        <div className="p-4 bg-violet-600 rounded-2xl text-white">
          <i className="fa-solid fa-sparkles text-2xl"></i>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Shift Analysis</h1>
          <p className="text-slate-500">Gemini-powered insights for your workplace habits</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="flex justify-center space-x-2 mb-4">
              <div className="w-3 h-3 bg-violet-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-3 h-3 bg-violet-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-3 h-3 bg-violet-600 rounded-full animate-bounce"></div>
            </div>
            <p className="text-slate-500 font-medium">Gemini is analyzing your logs...</p>
          </div>
        ) : insight ? (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-6">
              <div className={`flex-1 p-6 rounded-2xl border ${
                insight.trend === 'positive' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
                insight.trend === 'negative' ? 'bg-rose-50 border-rose-100 text-rose-900' :
                'bg-slate-50 border-slate-100 text-slate-900'
              }`}>
                <div className="flex items-center space-x-2 mb-2 font-bold uppercase text-xs">
                  <i className={`fa-solid ${insight.trend === 'positive' ? 'fa-arrow-trend-up' : insight.trend === 'negative' ? 'fa-arrow-trend-down' : 'fa-minus'}`}></i>
                  <span>Recent Trend: {insight.trend}</span>
                </div>
                <p className="text-lg leading-relaxed font-medium">{insight.summary}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-slate-900">Personalized Recommendations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insight.suggestions.map((s, i) => (
                  <div key={i} className="flex items-start space-x-3 p-4 bg-slate-50 rounded-xl">
                    <div className="mt-1 w-5 h-5 flex-shrink-0 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-[10px]">
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-600 leading-snug">{s}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-center">
              <button 
                onClick={fetchInsight}
                className="px-6 py-2 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-slate-800 transition-colors"
              >
                Re-analyze Habits
              </button>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center">
            <i className="fa-solid fa-robot text-4xl text-slate-200 mb-4"></i>
            <p className="text-slate-500">Not enough data to generate insights yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsights;
