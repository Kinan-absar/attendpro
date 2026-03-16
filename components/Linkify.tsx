
import React from 'react';

interface Props {
  text: string;
  className?: string;
}

const Linkify: React.FC<Props> = ({ text, className }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 underline font-bold hover:text-indigo-800 break-all"
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </span>
  );
};

export default Linkify;
