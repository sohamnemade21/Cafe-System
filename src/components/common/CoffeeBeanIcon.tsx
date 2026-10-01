import React from 'react';

interface CoffeeBeanIconProps {
  className?: string;
  size?: number;
}

export const CoffeeBeanIcon: React.FC<CoffeeBeanIconProps> = ({ className = 'w-4 h-4', size = 16 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.58 20 4 16.42 4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20Z"
        fillOpacity="0.08"
      />
      <path
        d="M12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3ZM12.8 18.5C12.3 17.2 11.5 15.5 11.2 13.9C10.8 12.1 11.2 10.4 12.1 8.9C12.7 7.9 13.5 6.9 14.2 5.8C14.4 5.5 14.7 5.7 14.6 6C13.9 7.3 13.2 8.7 12.9 10.1C12.5 12 12.9 13.8 13.8 15.4C14.4 16.5 15.2 17.5 15.9 18.5C16.1 18.8 15.8 19.1 15.5 19C14.6 18.7 13.6 18.5 12.8 18.5Z"
      />
    </svg>
  );
};
