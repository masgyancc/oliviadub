import { NextResponse } from "next/server";

// BrewCC: neutral 404 for short-link domains (root, unknown slugs, unavailable links).
// Self-contained HTML with no branding, links, scripts or external assets, and a real
// 404 status. Not cached, so a link created later is reachable right away.
const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>404 - Page Not Found</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #fff; color: #111; text-align: center; padding: 0 16px;
  }
  h1 { font-size: 28px; font-weight: 600; margin: 0 0 12px; }
  p { font-size: 16px; color: #555; margin: 0; }
  @media (prefers-color-scheme: dark) {
    body { background: #111; color: #eee; }
    p { color: #aaa; }
  }
</style>
</head>
<body>
<main>
<h1>404 - Page Not Found</h1>
<p>The page you are looking for doesn't exist or has been moved.</p>
</main>
</body>
</html>`;

export function genericNotFound() {
  return new NextResponse(HTML, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
