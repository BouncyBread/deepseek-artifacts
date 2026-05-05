export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: {
    results?: BraveSearchResult[];
  };
}

export async function braveSearch(query: string): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY not configured");

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Brave Search error: ${res.status} ${res.statusText}`);
  }

  const data: BraveSearchResponse = await res.json();
  return data.web?.results ?? [];
}

export async function fetchPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "RecipeForge/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    // Strip HTML tags for rough text extraction
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 8000);
  } catch {
    return "";
  }
}
