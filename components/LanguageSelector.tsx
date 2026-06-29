import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, LanguageType } from '../utils/LanguageContext';

const languages: { code: LanguageType; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' }
];

export const LanguageSelector: React.FC<{ light?: boolean }> = ({ light = false }) => {
  const { language, setLanguage, isRtl } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeLang = languages.find(l => l.code === language) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-start" ref={containerRef} id="lang-selector-container">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black tracking-wide uppercase transition-all duration-300 outline-none select-none ${
          light 
            ? 'bg-white/10 hover:bg-white/20 text-white border-white/20' 
            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm'
        }`}
        id="lang-selector-btn"
      >
        <span className="text-sm leading-none">{activeLang.flag}</span>
        <span>{activeLang.name}</span>
        <i className={`fa-solid fa-chevron-down text-[9px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {isOpen && (
        <div 
          className={`absolute z-[200] mt-1.5 w-40 rounded-xl bg-white border border-slate-100 shadow-xl py-1.5 animate-fadeIn duration-200 ${
            isRtl ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
          }`}
          id="lang-selector-dropdown"
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2 text-xs font-bold transition-all duration-200 ${
                language === lang.code 
                  ? 'bg-indigo-50 text-indigo-600' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
              style={{ direction: lang.code === 'ar' ? 'rtl' : 'ltr' }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base leading-none">{lang.flag}</span>
                <span>{lang.name}</span>
              </div>
              {language === lang.code && (
                <i className="fa-solid fa-check text-[10px] text-indigo-600"></i>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
