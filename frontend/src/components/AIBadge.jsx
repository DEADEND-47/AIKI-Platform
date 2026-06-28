import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * AIBadge — small gradient chip indicating AI-powered features.
 * Usage: <AIBadge label="AI Indexed" />
 */
export function AIBadge({ label = 'AI', className = '' }) {
  return (
    <span
      className={`ai-badge ${className}`}
      title="AI-powered feature"
      aria-label={`AI feature: ${label}`}
    >
      <Sparkles className="w-2.5 h-2.5" strokeWidth={2.5} />
      {label}
    </span>
  );
}

export default AIBadge;
