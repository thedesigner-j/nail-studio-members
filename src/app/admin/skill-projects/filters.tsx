"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PROJECT_STATUSES, SKILL_TYPES } from "@/lib/skill-projects";

export default function ProjectFilters({ techs }: { techs: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <select
        aria-label="Status"
        value={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        className="field-input col-span-2 py-2 sm:col-span-1"
      >
        <option value="">All active</option>
        {PROJECT_STATUSES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.key === "submitted" ? "Waiting for review" : s.label}
          </option>
        ))}
        <option value="archived">Archived</option>
      </select>
      <select
        aria-label="Skill type"
        value={searchParams.get("skill") ?? ""}
        onChange={(e) => setParam("skill", e.target.value)}
        className="field-input py-2"
      >
        <option value="">All skills</option>
        {SKILL_TYPES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Tech"
        value={searchParams.get("tech") ?? ""}
        onChange={(e) => setParam("tech", e.target.value)}
        className="field-input py-2"
      >
        <option value="">All techs</option>
        {techs.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
