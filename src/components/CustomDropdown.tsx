"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type DropdownValue = string | number;

export type DropdownBadge = {
  label: string;
  tone: "quality" | "effect" | "info";
};

export type DropdownOption = {
  value: DropdownValue;
  label: string;
  badges?: DropdownBadge[];
};

type CustomDropdownProps = {
  options: DropdownOption[];
  value: DropdownValue;
  disabled?: boolean;
  loading?: boolean;
  onChange: (value: DropdownValue) => void;
  id?: string;
  ariaLabel?: string;
  menuClassName?: string;
};

export function CustomDropdown({
  options,
  value,
  disabled,
  loading,
  onChange,
  id,
  ariaLabel,
  menuClassName,
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = useMemo(() => options.find((item) => item.value === value), [options, value]);
  const selectedBadges = selectedOption?.badges ?? [];

  useEffect(() => {
    if (!open || disabled) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [disabled, open]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleSelection = (selectedValue: DropdownValue) => {
    onChange(selectedValue);
    setOpen(false);
  };

  const selectedLabel = selectedOption?.label ?? "";
  const isDisabled = Boolean(disabled);
  const isMenuOpen = !isDisabled && open;

  return (
    <div className={`custom-dropdown ${isDisabled ? "disabled" : ""}`} ref={containerRef}>
      <button
        type="button"
        className={`dropdown-trigger ${loading ? "loading" : ""}`}
        onClick={() => !isDisabled && setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isMenuOpen}
        disabled={isDisabled}
        id={id}
        aria-label={ariaLabel}
      >
        <div className="dropdown-trigger-content">
          <span className="dropdown-value">{selectedLabel}</span>
          {selectedBadges.length > 0 && (
            <div className="option-badges">
              {selectedBadges.map((badge) => (
                <span key={badge.label} className={`option-badge ${badge.tone}`}>
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="dropdown-icons">
          {loading && <span className="dropdown-spinner" aria-hidden="true" />}
          <svg
            className={`chevron ${isMenuOpen ? "open" : ""}`}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>
      {isMenuOpen && (
        <div className={`dropdown-menu ${menuClassName ?? ""}`} role="listbox">
          {options.map((option) => {
            const isActive = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={`dropdown-option ${isActive ? "active" : ""}`}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelection(option.value)}
              >
                <div className="option-line">
                  <span className="option-label">{option.label}</span>
                  {option.badges && option.badges.length > 0 && (
                    <div className="option-badges">
                      {option.badges.map((badge) => (
                        <span key={`${option.value}-${badge.label}`} className={`option-badge ${badge.tone}`}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CustomDropdown;
