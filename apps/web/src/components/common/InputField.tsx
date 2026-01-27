import React from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    label: string;
    id: string;
    type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'textarea';
    rows?: number;
}

/**
 * @description Reusable input/textarea component.
 */
export default function InputField({ label, id, type = 'text', rows = 1, className, ...props }: InputFieldProps) {
    const inputStyle = "w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 text-sm";

    return (
        <div className={`space-y-1 ${className}`}>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700">
                {label}
            </label>
            {type === 'textarea' ? (
                <textarea
                    id={id}
                    className={inputStyle}
                    rows={rows}
                    {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>}
                />
            ) : (
                <input
                    id={id}
                    type={type}
                    className={inputStyle}
                    {...props as React.InputHTMLAttributes<HTMLInputElement>}
                />
            )}
        </div>
    );
}



