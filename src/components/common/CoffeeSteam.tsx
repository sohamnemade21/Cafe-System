import React from 'react';

interface CoffeeSteamProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CoffeeSteam: React.FC<CoffeeSteamProps> = ({ className = '', size = 'md' }) => {
  const height = size === 'sm' ? 24 : size === 'lg' ? 44 : 32;
  const width = size === 'sm' ? 28 : size === 'lg' ? 52 : 38;

  return (
    <div className={`relative inline-flex items-center justify-center pointer-events-none ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 40 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        {/* Steam strand 1 */}
        <path
          d="M12 32C10 24 16 18 13 10C11 5 15 2 15 0"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="text-amber-600/50 animate-steam-1"
        />
        {/* Steam strand 2 */}
        <path
          d="M20 34C18 25 24 19 21 11C19 6 23 3 22 0"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          className="text-amber-700/60 animate-steam-2"
        />
        {/* Steam strand 3 */}
        <path
          d="M28 32C26 23 32 18 29 10C27 4 30 2 30 0"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="text-amber-600/40 animate-steam-3"
        />
      </svg>
    </div>
  );
};
