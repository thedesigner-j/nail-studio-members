"use client";

import { useEffect } from "react";
import { markEarlyAccessSeen } from "./actions";

// Fires once an actual page view happens (not on link prefetch, which a
// server-rendered side effect in the page itself would risk triggering).
export default function MarkSeen() {
  useEffect(() => {
    markEarlyAccessSeen();
  }, []);

  return null;
}
