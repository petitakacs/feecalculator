"use client";

import { useState, useEffect } from "react";

interface CurrencyInputProps {
  value: number; // cents
  onChange: (cents: number) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function CurrencyInput({
  value,
  onChange,
  disabled,
  className,
  placeholder = "0.00",
}: CurrencyInputProps) {
  const [inputValue, setInputValue] = useState((value / 100).toFixed(2));

  useEffect(() => {
    setInputValue((value / 100).toFixed(2));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBlur = () => {
    const parsed = parseFloat(inputValue.replace(/,/g, ""));
    const cents = isNaN(parsed) ? 0 : Math.round(parsed * 100);
    onChange(cents);
    setInputValue((cents / 100).toFixed(2));
  };

  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
        €
      </span>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={`pl-6 pr-2 py-1.5 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-500 ${className ?? ""}`}
      />
    </div>
  );
}
