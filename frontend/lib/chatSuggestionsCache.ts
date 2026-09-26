export type PromptTemplate = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  order: number;
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  order: number;
};

type CacheEntry<T> = {
  items: T[];
  fetchedAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const PROMPT_KEY = "chat_prompt_templates_cache_v1";
const FAQ_KEY = "chat_faq_items_cache_v1";

let promptCache: CacheEntry<PromptTemplate> | null = null;
let faqCache: CacheEntry<FaqItem> | null = null;
let promptsInFlight: Promise<PromptTemplate[]> | null = null;
let faqInFlight: Promise<FaqItem[]> | null = null;

function isFresh<T>(entry: CacheEntry<T>) {
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

function readStorage<T>(key: string): CacheEntry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || !Array.isArray(parsed.items) || typeof parsed.fetchedAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, entry: CacheEntry<T>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore storage errors
  }
}

function setPromptCache(items: PromptTemplate[]) {
  const entry: CacheEntry<PromptTemplate> = { items, fetchedAt: Date.now() };
  promptCache = entry;
  writeStorage(PROMPT_KEY, entry);
}

function setFaqCache(items: FaqItem[]) {
  const entry: CacheEntry<FaqItem> = { items, fetchedAt: Date.now() };
  faqCache = entry;
  writeStorage(FAQ_KEY, entry);
}

function getPromptEntry() {
  if (promptCache) return promptCache;
  promptCache = readStorage<PromptTemplate>(PROMPT_KEY);
  return promptCache;
}

function getFaqEntry() {
  if (faqCache) return faqCache;
  faqCache = readStorage<FaqItem>(FAQ_KEY);
  return faqCache;
}

export function getCachedPromptTemplates() {
  return getPromptEntry()?.items ?? null;
}

export function getCachedFaqItems() {
  return getFaqEntry()?.items ?? null;
}

async function fetchPromptTemplates() {
  const response = await fetch("/api/prompts", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load prompt cards");
  }
  const payload = (await response.json()) as { items: PromptTemplate[] };
  setPromptCache(payload.items);
  return payload.items;
}

async function fetchFaqItems() {
  const response = await fetch("/api/faq", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load FAQ items");
  }
  const payload = (await response.json()) as { items: FaqItem[] };
  setFaqCache(payload.items);
  return payload.items;
}

export async function loadPromptTemplates(options?: { force?: boolean }) {
  const force = options?.force ?? false;
  const cached = getPromptEntry();

  if (!force && cached && isFresh(cached)) {
    return cached.items;
  }

  if (!force && promptsInFlight) {
    return promptsInFlight;
  }

  promptsInFlight = fetchPromptTemplates().finally(() => {
    promptsInFlight = null;
  });

  return promptsInFlight;
}

export async function loadFaqItems(options?: { force?: boolean }) {
  const force = options?.force ?? false;
  const cached = getFaqEntry();

  if (!force && cached && isFresh(cached)) {
    return cached.items;
  }

  if (!force && faqInFlight) {
    return faqInFlight;
  }

  faqInFlight = fetchFaqItems().finally(() => {
    faqInFlight = null;
  });

  return faqInFlight;
}

export function warmChatSuggestionCaches() {
  const prompts = getPromptEntry();
  const faq = getFaqEntry();

  if (!prompts || !isFresh(prompts)) {
    void loadPromptTemplates({ force: true });
  }
  if (!faq || !isFresh(faq)) {
    void loadFaqItems({ force: true });
  }
}
