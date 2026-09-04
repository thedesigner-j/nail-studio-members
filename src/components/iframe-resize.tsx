"use client";

import { useEffect } from "react";

// Posts the document height to the parent window so the Webflow embed
// script can size the iframe to fit content instead of scrolling inside it.
export default function IframeResize() {
  useEffect(() => {
    if (window.parent === window) return;

    const postHeight = () => {
      window.parent.postMessage(
        { type: "nail-members:resize", height: document.documentElement.scrollHeight },
        "*",
      );
    };

    const observer = new ResizeObserver(postHeight);
    observer.observe(document.documentElement);
    postHeight();

    return () => observer.disconnect();
  }, []);

  return null;
}
