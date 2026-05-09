"use client";

import { useState, useEffect } from "react";

interface CurrencyInputProps {
  value: number; // forint
  onChange: (forint: number) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function CurrencyInput({
  value,
  onChange,
  disabled,
  className,
  placeholder = "0",
}: CurrencyInputProps) {
  const [inputValue, setInputValue] = useState(String(Math.round(value)));

  useEffect(() => {
    setInputValue(String(Math.round(value)));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBlur = () => {
    const parsed = parseFloat(inputValue.replace(/[\s]/g, ""));
    const forint = isNaN(parsed) ? 0 : Math.round(parsed);
    onChange(forint);
    setInputValue(String(forint));
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={`pr-8 px-2 py-1.5 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-500 ${className ?? ""}`}
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
        Ft
      </span>
    </div>
  );
}
