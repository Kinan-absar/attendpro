
import React from 'react';

interface Props {
  text: string;
  className?: string;
}

const Linkify: React.FC<Props> = ({ text, className }) => {
  // Regex to match [text](url) or raw https?:// urls
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;
  
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Push text before the match
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // It's a Markdown link: [text](url)
      elements.push(
        <a
          key={match.index}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 underline font-bold hover:text-indigo-800 break-all"
        >
          {match[1]}
        </a>
      );
    } else if (match[3]) {
      // It's a raw URL
      elements.push(
        <a
          key={match.index}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 underline font-bold hover:text-indigo-800 break-all"
        >
          {match[3]}
        </a>
      );
    }
    lastIndex = regex.lastIndex;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return (
    <span className={className}>
      {elements.length > 0 ? elements : text}
    </span>
  );
};

export default Linkify;
