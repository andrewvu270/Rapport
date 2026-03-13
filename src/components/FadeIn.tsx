'use client';

import { useEffect, useState } from 'react';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  from?: 'bottom' | 'none';
}

export default function FadeIn({ children, delay = 0, className = '', from = 'bottom' }: FadeInProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`transition-all duration-500 ease-out ${
        visible
          ? 'opacity-100 translate-y-0'
          : from === 'bottom' ? 'opacity-0 translate-y-4' : 'opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}
