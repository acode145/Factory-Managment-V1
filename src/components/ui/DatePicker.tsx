"use client";

import { useEffect, useState } from "react";
import { getPakistanTodayIso } from "@/lib/dateUtils";

interface DatePickerProps {
  name: string;
  defaultValue?: string | Date; // YYYY-MM-DD format or Date instance
  value?: string | Date; // YYYY-MM-DD format or Date instance
  onChange?: (val: string) => void;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

function normalizeToIso(d?: string | Date): string {
  if (!d) return "";
  if (d instanceof Date) {
    return d.toISOString().split("T")[0];
  }
  return d;
}

export default function DatePicker({
  name,
  defaultValue,
  value,
  onChange,
  required = false,
  className = "",
  disabled = false,
}: DatePickerProps) {
  const isControlled = value !== undefined;
  const initialIso =
    normalizeToIso(isControlled ? value : defaultValue) ||
    getPakistanTodayIso();

  const [isoDate, setIsoDate] = useState<string>(initialIso);

  useEffect(() => {
    if (isControlled && value !== undefined) {
      setIsoDate(normalizeToIso(value));
    }
  }, [isControlled, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setIsoDate(newVal);
    if (onChange) onChange(newVal);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        type="date"
        name={name}
        required={required}
        disabled={disabled}
        value={isoDate}
        onChange={handleChange}
        className="w-full h-11 px-3.5 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 font-mono tracking-wider focus:outline-hidden focus:ring-2 focus:ring-zinc-900 cursor-pointer touch-manipulation"
      />
    </div>
  );
}
