"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

export interface LocationValue {
  state: string;
  lga: string;
  address: string;
}

interface SearchableDropdownProps {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  emptyMessage?: string;
}

function SearchableDropdown({
  label,
  placeholder,
  value,
  options,
  onSelect,
  disabled,
  emptyMessage = "No matches",
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="space-y-1.5" ref={ref}>
      <Label>{label}</Label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <span className={cn("truncate text-left", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>

        {open && !disabled && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</div>
              )}
              {filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onSelect(opt);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    opt === value && "bg-accent/50 font-medium"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface LocationPickerProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  className?: string;
}

/**
 * Structured location input: searchable State dropdown (only admin-activated
 * states are selectable) -> searchable LGA dropdown for that state -> free
 * address text field. Used both pre-registration (guest wizard) and
 * post-login (PostProjectDialog/EditProjectDialog) so the two flows stay in
 * sync automatically.
 */
export function LocationPicker({ value, onChange, className }: LocationPickerProps) {
  const [states, setStates] = useState<string[]>([]);
  const [lgas, setLgas] = useState<string[]>([]);
  const [loadingLgas, setLoadingLgas] = useState(false);

  useEffect(() => {
    api
      .activeStates()
      .then((rows) => setStates(rows.map((r) => r.name)))
      .catch(() => setStates([]));
  }, []);

  useEffect(() => {
    if (!value.state) {
      setLgas([]);
      return;
    }
    setLoadingLgas(true);
    api
      .lgasForState(value.state)
      .then(setLgas)
      .catch(() => setLgas([]))
      .finally(() => setLoadingLgas(false));
  }, [value.state]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SearchableDropdown
          label="State"
          placeholder="Select state"
          value={value.state}
          options={states}
          onSelect={(state) => onChange({ state, lga: "", address: value.address })}
          emptyMessage="No states available"
        />
        <SearchableDropdown
          label="Local Government Area"
          placeholder={value.state ? (loadingLgas ? "Loading..." : "Select LGA") : "Select a state first"}
          value={value.lga}
          options={lgas}
          disabled={!value.state || loadingLgas}
          onSelect={(lga) => onChange({ ...value, lga })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Address</Label>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Street address, area, or landmark"
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
