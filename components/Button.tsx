import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon, 
  className = '', 
  ...props 
}) => {
  const baseStyle = "flex items-center justify-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-white text-black hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.15)]",
    secondary: "bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700",
    danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20",
    ghost: "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/50"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="text-lg">{icon}</span>}
      {children}
    </button>
  );
};
