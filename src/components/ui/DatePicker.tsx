"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
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

// Convert YYYY-MM-DD -> DD/MM/YYYY
function toDisplayFormat(isoString: string): string {
  if (!isoString) return "";
  const parts = isoString.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }
  return isoString;
}

// Convert DD/MM/YYYY -> YYYY-MM-DD
function toIsoFormat(dmyString: string): string {
  if (!dmyString) return "";
  const clean = dmyString.replace(/\D/g, "");
  if (clean.length === 8) {
    const day = clean.slice(0, 2);
    const month = clean.slice(2, 4);
    const year = clean.slice(4, 8);
    return `${year}-${month}-${day}`;
  }
  return "";
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
  const [displayText, setDisplayText] = useState<string>(toDisplayFormat(initialIso));
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isControlled && value !== undefined) {
      const normalized = normalizeToIso(value);
      setIsoDate(normalized);
      setDisplayText(toDisplayFormat(normalized));
    }
  }, [isControlled, value]);

  const handleIsoChange = (newIso: string) => {
    setIsoDate(newIso);
    setDisplayText(toDisplayFormat(newIso));
    if (onChange) onChange(newIso);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayText(raw);
    const maybeIso = toIsoFormat(raw);
    if (maybeIso && !isNaN(new Date(maybeIso).getTime())) {
      setIsoDate(maybeIso);
      if (onChange) onChange(maybeIso);
    }
  };

  const openCalendar = () => {
    if (disabled || !hiddenInputRef.current) return;
    const el = hiddenInputRef.current as any;
    try {
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        el.focus();
      }
    } catch {
      el.focus();
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Visual Input Displaying DD/MM/YYYY */}
      <div className="relative flex items-center">
        <input
          type="text"
          value={displayText}
          onChange={handleTextChange}
          onClick={openCalendar}
          placeholder="DD/MM/YYYY"
          disabled={disabled}
          className="w-full h-11 px-3.5 pr-10 bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 font-mono tracking-wider focus:outline-hidden focus:ring-2 focus:ring-zinc-900 cursor-pointer"
        />

        <button
          type="button"
          onClick={openCalendar}
          disabled={disabled}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-zinc-900 rounded transition-colors"
          tabIndex={-1}
          aria-label="Open Calendar"
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {/* Hidden Native Picker that handles the calendar popup and form submission */}
      <input
        ref={hiddenInputRef}
        type="date"
        name={name}
        required={required}
        value={isoDate}
        onChange={(e) => handleIsoChange(e.target.value)}
        disabled={disabled}
        tabIndex={-1}
        className="sr-only"
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
      />
    </div>
  );
}
