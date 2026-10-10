const PREFIX = "article:";
const INDEX_KEY = "articles:index";

function articleKey(slug) {
  return `${PREFIX}${slug}`;
}

export async function getCachedArticle(env, slug) {
  if (!env.ARTICLE_CACHE) {
    throw new Error("ARTICLE_CACHE binding is not configured.");
  }

  const cleanSlug = String(slug || "").trim();

  if (!cleanSlug) {
    return null;
  }

  try {
    const article = await env.ARTICLE_CACHE.get(
      articleKey(cleanSlug),
      "json"
    );

    // Basic validation so malformed cached objects are ignored.
    if (
      !article ||
      typeof article !== "object" ||
      Array.isArray(article) ||
      typeof article.slug !== "string" ||
      article.slug.trim() !== cleanSlug
    ) {
      if (article !== null) {
        await env.ARTICLE_CACHE.delete(articleKey(cleanSlug));
      }

      return null;
    }

    return article;
  } catch (error) {
    // Corrupt JSON or invalid KV data.
    console.warn(
      `[ARTICLE CACHE] Invalid cache for "${cleanSlug}", rebuilding from Google Drive.`
    );

    try {
      await env.ARTICLE_CACHE.delete(articleKey(cleanSlug));
    } catch {}

    return null;
  }
}

export async function setCachedArticle(env, article) {
  if (!env.ARTICLE_CACHE) {
    throw new Error("ARTICLE_CACHE binding is not configured.");
  }

  const slug = String(article?.slug || "").trim();

  if (!slug) {
    throw new Error("Cannot cache article without slug.");
  }

  await env.ARTICLE_CACHE.put(
    articleKey(slug),
    JSON.stringify(article),
    { expirationTtl: 60 }
  );

  return article;
}

export async function deleteCachedArticle(env, slug) {
  if (!env.ARTICLE_CACHE) {
    throw new Error("ARTICLE_CACHE binding is not configured.");
  }

  const cleanSlug = String(slug || "").trim();

  if (!cleanSlug) {
    return;
  }

  await env.ARTICLE_CACHE.delete(
    articleKey(cleanSlug)
  );
}

export async function getCachedArticleIndex(env) {
  if (!env.ARTICLE_CACHE) {
    throw new Error("ARTICLE_CACHE binding is not configured.");
  }

  try {
    const index = await env.ARTICLE_CACHE.get(
      INDEX_KEY,
      "json"
    );

    // A valid empty array is a valid cached index.
    if (Array.isArray(index)) {
      return index;
    }

    if (index !== null) {
      await env.ARTICLE_CACHE.delete(INDEX_KEY);
    }

    return null;
  } catch (error) {
    console.warn(
      "[ARTICLE CACHE] Invalid index cache, rebuilding from Google Drive."
    );

    try {
      await env.ARTICLE_CACHE.delete(INDEX_KEY);
    } catch {}

    return null;
  }
}

export async function setCachedArticleIndex(env, articles) {
  if (!env.ARTICLE_CACHE) {
    throw new Error("ARTICLE_CACHE binding is not configured.");
  }

  await env.ARTICLE_CACHE.put(
    INDEX_KEY,
    JSON.stringify(articles),
    { expirationTtl: 60 }
  );

  return articles;
}

export async function deleteCachedArticleIndex(env) {
  if (!env.ARTICLE_CACHE) {
    throw new Error("ARTICLE_CACHE binding is not configured.");
  }

  await env.ARTICLE_CACHE.delete(INDEX_KEY);
}
