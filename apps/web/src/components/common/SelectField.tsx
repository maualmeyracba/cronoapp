import React from 'react';

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    id: string;
    children: React.ReactNode;
}

/**
 * @description Reusable select (dropdown) component.
 */
export default function SelectField({ label, id, children, className, ...props }: SelectFieldProps) {
    const selectStyle = "w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 text-sm";
    
    return (
        <div className={`space-y-1 ${className}`}>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700">
                {label}
            </label>
            <select
                id={id}
                className={selectStyle}
                {...props}
            >
                {children}
            </select>
        </div>
    );
}



