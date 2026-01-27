import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    primary?: boolean;
    children: React.ReactNode;
}

/**
 * @description Reusable button component with basic Tailwind styles.
 */
export default function Button({ primary = true, children, className, disabled, ...props }: ButtonProps) {
    const baseStyle = "px-4 py-2 rounded-lg font-semibold transition-colors duration-150";
    const primaryStyle = "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300";
    const secondaryStyle = "bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100";

    return (
        <button
            className={`${baseStyle} ${primary ? primaryStyle : secondaryStyle} ${className || ''}`}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    );
}



