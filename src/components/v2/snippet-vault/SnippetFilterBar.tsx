"use client";

import type { SnippetFilterState, SnippetInterface, SnippetPlatform } from "@/src/types/snippets";

interface SnippetFilterBarProps {
  value: SnippetFilterState;
  onChange: (next: SnippetFilterState) => void;
}

const INTERFACE_OPTIONS: Array<SnippetInterface | "ALL"> = ["ALL", "I2C", "SPI", "UART", "GPIO", "Unknown"];
const PLATFORM_OPTIONS: Array<SnippetPlatform | "ALL"> = ["ALL", "esp32", "arduino"];

export default function SnippetFilterBar({ value, onChange }: SnippetFilterBarProps) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-black/[0.06] bg-gray-50/70 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <input
        value={value.dependency}
        onChange={(event) => onChange({ ...value, dependency: event.target.value })}
        placeholder="Dependency (Wire.h)"
        className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#111]"
      />
      <select
        value={value.interface}
        onChange={(event) =>
          onChange({
            ...value,
            interface: event.target.value as SnippetFilterState["interface"],
          })
        }
        className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#111]"
      >
        {INTERFACE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option === "ALL" ? "All interfaces" : option}
          </option>
        ))}
      </select>
      <select
        value={value.targetHw}
        onChange={(event) =>
          onChange({
            ...value,
            targetHw: event.target.value as SnippetFilterState["targetHw"],
          })
        }
        className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#111]"
      >
        {PLATFORM_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option === "ALL" ? "All targets" : option.toUpperCase()}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-3 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#4f5059]">
        Min conf.
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value.minConfidence}
          onChange={(event) =>
            onChange({
              ...value,
              minConfidence: Number(event.target.value),
            })
          }
          className="w-full"
        />
        <span className="w-10 text-right text-[11px] text-[#111]">
          {value.minConfidence}%
        </span>
      </label>
    </div>
  );
}
