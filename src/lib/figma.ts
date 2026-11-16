// Minimal Figma REST API client for the Trace sync. Server-only: it reads
// FIGMA_ACCESS_TOKEN, which must never reach the browser.
//
// Figma rate-limits these calls by the plan that owns the file. Files on the
// free Starter plan get only a handful of the heavier calls per month, so the
// sync makes as few as it can and turns Figma's errors into plain language.

export type FigmaPaint = {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: { r: number; g: number; b: number; a?: number };
};

export type FigmaGeometry = { path: string; windingRule?: string };

export type FigmaNode = {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  children?: FigmaNode[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  characters?: string;
  fills?: FigmaPaint[];
  isMask?: boolean;
  componentId?: string;
  fillGeometry?: FigmaGeometry[];
  strokeGeometry?: FigmaGeometry[];
};

export class FigmaError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

export function figmaConfig() {
  const token = process.env.FIGMA_ACCESS_TOKEN?.trim() || "";
  const fileKey = process.env.FIGMA_FILE_KEY?.trim() || "";
  return { token, fileKey, configured: !!token && !!fileKey };
}

// Overridable so the sync can be tested against a local stand-in.
function apiBase() {
  return (process.env.FIGMA_API_BASE || "https://api.figma.com").replace(/\/$/, "");
}

function describeWait(retryAfter: string | null) {
  const seconds = Number(retryAfter);
  if (!retryAfter || !Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 120) return " Try again in a couple of minutes.";
  if (seconds < 2 * 3600) return ` Try again in about ${Math.ceil(seconds / 60)} minutes.`;
  if (seconds < 2 * 86400) return ` Try again in about ${Math.ceil(seconds / 3600)} hours.`;
  return ` Try again in about ${Math.ceil(seconds / 86400)} days.`;
}

export async function figmaGet<T>(path: string): Promise<T> {
  const { token } = figmaConfig();
  if (!token) throw new FigmaError("Figma isn't connected yet: FIGMA_ACCESS_TOKEN is missing.");

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      headers: { "X-Figma-Token": token },
      cache: "no-store",
    });
  } catch {
    throw new FigmaError("Couldn't reach Figma. Check your internet connection and try again.");
  }

  if (res.ok) return (await res.json()) as T;

  if (res.status === 429) {
    const lowTier = res.headers.get("x-figma-rate-limit-type") === "low";
    throw new FigmaError(
      "Figma says this file has been synced too often for now." +
        describeWait(res.headers.get("retry-after")) +
        (lowTier
          ? " Files on Figma's free plan can only be synced a few times a month; moving the file to a paid team raises that limit."
          : ""),
      429,
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new FigmaError(
      "Figma turned down the access token. It may have expired or been deleted: make a new one and update FIGMA_ACCESS_TOKEN.",
      res.status,
    );
  }
  if (res.status === 404) {
    throw new FigmaError(
      "Figma can't find that file. Check FIGMA_FILE_KEY, and that the token's account can open the file.",
      404,
    );
  }

  let detail = "";
  try {
    const body = (await res.json()) as { err?: string; message?: string };
    detail = body.err || body.message || "";
  } catch {
    // Not JSON; keep the status alone.
  }
  throw new FigmaError(
    `Figma returned an error (${res.status}${detail ? `: ${detail}` : ""}). Please try again.`,
    res.status,
  );
}

// Figma's temporary export links point at its own storage. Downloaded
// server-side, so they're fetched only from Figma's export response.
export async function downloadExport(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
