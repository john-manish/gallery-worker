import {
  listDriveFiles,
  downloadDriveFile,
  createDriveFile,
  updateDriveFile,
  updateDriveFileMedia,
  driveFetch
} from "../drive/google.js";

import {
  getCachedArticle,
  setCachedArticle,
  deleteCachedArticle,
  getCachedArticleIndex,
  setCachedArticleIndex,
  deleteCachedArticleIndex
} from "./articleCache.js";

const JSON_MIME = "application/json";

function requireDatabaseFolder(env) {
  if (!env.DRIVE_ARTICLES_DATABASE_ID) {
    throw new Error(
      "DRIVE_ARTICLES_DATABASE_ID is not configured."
    );
  }

  return env.DRIVE_ARTICLES_DATABASE_ID;
}

function escapeDriveQuery(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function articleFileName(slug) {
  return `${slug}.json`;
}

async function findArticleFile(env, slug) {
  const folderId =
    requireDatabaseFolder(env);

  const fileName =
    articleFileName(slug);

  const result =
    await listDriveFiles(
      env,
      [
        `name='${escapeDriveQuery(fileName)}'`,
        `'${folderId}' in parents`,
        "trashed=false"
      ].join(" and "),
      "files(id,name,mimeType,createdTime,modifiedTime)"
    );

  return result.files?.[0] || null;
}

async function readArticleFile(env, file) {
  const response =
    await downloadDriveFile(
      env,
      file.id
    );

  const text =
    await response.text();

  let article;

  try {
    article = JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid article JSON: ${file.name}`
    );
  }

  if (
    !article ||
    typeof article !== "object" ||
    Array.isArray(article)
  ) {
    throw new Error(
      `Invalid article JSON: ${file.name}`
    );
  }

  return article;
}

function normalizeArticle(data, existing = null) {
  const now =
    new Date().toISOString();

  return {
    ...(existing || {}),
    ...(data || {}),

    $id:
      existing?.$id ||
      data?.$id ||
      crypto.randomUUID(),

    $createdAt:
      existing?.$createdAt ||
      data?.$createdAt ||
      now,

    $updatedAt: now
  };
}

async function writeArticleFile(
  env,
  article,
  existingFile = null
) {
  const folderId =
    requireDatabaseFolder(env);

  const slug =
    String(article?.slug || "").trim();

  if (!slug) {
    throw new Error(
      "Article slug is required."
    );
  }

  const fileName =
    articleFileName(slug);

  const body =
    JSON.stringify(
      article,
      null,
      4
    );

  if (existingFile) {
    return updateDriveFileMedia(
      env,
      existingFile.id,
      body,
      JSON_MIME
    );
  }

  return createDriveFile(
    env,
    fileName,
    folderId,
    body,
    JSON_MIME
  );
}

export async function createArticle(
  env,
  data
) {
  const slug =
    String(data?.slug || "").trim();

  if (!slug) {
    throw new Error(
      "Article slug is required."
    );
  }

  const existing =
    await findArticleFile(
      env,
      slug
    );

  if (existing) {
    throw new Error(
      "Article already exists in Google Drive."
    );
  }

  const article =
    normalizeArticle(data);

  await writeArticleFile(
    env,
    article
  );

  // Keep KV cache synchronized with Google Drive.
  await setCachedArticle(env, article);

  const cachedIndex = await getCachedArticleIndex(env);
  const nextIndex = Array.isArray(cachedIndex)
    ? cachedIndex.filter(item => item?.slug !== article.slug)
    : [];

  nextIndex.push(article);

  await setCachedArticleIndex(env, nextIndex);

  return article;
}

export async function getArticleBySlug(
  env,
  slug
) {
  const cleanSlug =
    String(slug || "").trim();

  if (!cleanSlug) {
    return null;
  }

  // =========================================================
  // 1. KV CACHE FIRST
  // =========================================================

  const cached =
    await getCachedArticle(
      env,
      cleanSlug
    );

  if (cached) {
    return cached;
  }


  // =========================================================
  // 2. CACHE MISS → GOOGLE DRIVE
  // =========================================================

  const file =
    await findArticleFile(
      env,
      cleanSlug
    );

  if (!file) {
    return null;
  }

  const article =
    await readArticleFile(
      env,
      file
    );

  // =========================================================
  // 3. SAVE VALID DRIVE ARTICLE TO KV
  // =========================================================

  await setCachedArticle(
    env,
    article
  );

  return article;
}

export async function updateArticle(
  env,
  slug,
  data
) {
  const oldSlug =
    String(slug || "").trim();

  if (!oldSlug) {
    throw new Error(
      "Article slug is required."
    );
  }

  const existingFile =
    await findArticleFile(
      env,
      oldSlug
    );

  if (!existingFile) {
    throw new Error(
      "Article not found in Google Drive."
    );
  }

  const existingArticle =
    await readArticleFile(
      env,
      existingFile
    );
    
    
  await saveArticleHistory(
    env,
    existingArticle
  );

  const nextSlug =
    String(
      data?.slug ||
      existingArticle.slug ||
      oldSlug
    ).trim();

  if (!nextSlug) {
    throw new Error(
      "Article slug is required."
    );
  }

  const updated =
    normalizeArticle(
      {
        ...data,
        slug: nextSlug
      },
      existingArticle
    );

  if (nextSlug !== oldSlug) {
    const newFile =
      await findArticleFile(
        env,
        nextSlug
      );

    if (newFile) {
      throw new Error(
        "Another article already uses this slug."
      );
    }

    await writeArticleFile(
      env,
      updated
    );

    await deleteDriveFile(
      env,
      existingFile.id
    );

    // Keep KV synchronized after slug rename.
    await deleteCachedArticle(env, oldSlug);
    await setCachedArticle(env, updated);

    const cachedIndex = await getCachedArticleIndex(env);
    const nextIndex = Array.isArray(cachedIndex)
      ? cachedIndex.filter(item =>
          item?.slug !== oldSlug &&
          item?.slug !== updated.slug
        )
      : [];

    nextIndex.push(updated);

    await setCachedArticleIndex(env, nextIndex);

    return updated;
  }

  await writeArticleFile(
    env,
    updated,
    existingFile
  );

  // Keep KV synchronized after normal update.
  await setCachedArticle(env, updated);

  const cachedIndex = await getCachedArticleIndex(env);
  const nextIndex = Array.isArray(cachedIndex)
    ? cachedIndex.filter(item => item?.slug !== updated.slug)
    : [];

  nextIndex.push(updated);

  await setCachedArticleIndex(env, nextIndex);

  return updated;
}

async function deleteDriveFile(
  env,
  fileId
) {
  const response =
    await driveFetch(
      env,
      `/files/${encodeURIComponent(fileId)}`,
      {
        method: "DELETE"
      }
    );

  if (!response.ok) {
    const error =
      await response.text();

    throw new Error(
      `Google Drive delete failed: ${response.status} ${error}`
    );
  }
}



// =========================================================
// ARTICLE HISTORY
// =========================================================

function requireHistoryFolder(env) {
  if (!env.DRIVE_ARTICLES_HISTORY_ID) {
    throw new Error(
      "DRIVE_ARTICLES_HISTORY_ID is not configured."
    );
  }

  return env.DRIVE_ARTICLES_HISTORY_ID;
}

function historyFolderName(slug) {
  return String(slug || "").trim();
}

function historyFileName(version) {
  return `${version}.json`;
}

async function findHistoryFolder(env, slug) {
  const parentId =
    requireHistoryFolder(env);

  const name =
    historyFolderName(slug);

  const result =
    await listDriveFiles(
      env,
      [
        `name='${escapeDriveQuery(name)}'`,
        `'${parentId}' in parents`,
        "mimeType='application/vnd.google-apps.folder'",
        "trashed=false"
      ].join(" and "),
      "files(id,name,mimeType,createdTime,modifiedTime)"
    );

  return result.files?.[0] || null;
}

async function createHistoryFolder(env, slug) {
  const parentId =
    requireHistoryFolder(env);

  const name =
    historyFolderName(slug);

  const metadata = {
    name,
    parents: [parentId],
    mimeType:
      "application/vnd.google-apps.folder"
  };

  const response =
    await driveFetch(
      env,
      "/files",
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json"
        },
        body:
          JSON.stringify(metadata)
      }
    );

  if (!response.ok) {
    const error =
      await response.text();

    throw new Error(
      `Google Drive history folder creation failed: ${response.status} ${error}`
    );
  }

  return response.json();
}

async function getOrCreateHistoryFolder(
  env,
  slug
) {
  const existing =
    await findHistoryFolder(
      env,
      slug
    );

  if (existing) {
    return existing;
  }

  return createHistoryFolder(
    env,
    slug
  );
}

export async function saveArticleHistory(
  env,
  article
) {
  if (!article?.slug) {
    throw new Error(
      "Article slug is required for history."
    );
  }

  const folder =
    await getOrCreateHistoryFolder(
      env,
      article.slug
    );

  const version =
    new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\./g, "-");

  const fileName =
    historyFileName(version);

  const snapshot = {
    ...article,
    $historyVersion: version,
    $historyCreatedAt:
      new Date().toISOString()
  };

  return createDriveFile(
    env,
    fileName,
    folder.id,
    JSON.stringify(
      snapshot,
      null,
      2
    ),
    "application/json"
  );
}

async function listHistoryFiles(
  env,
  slug
) {
  const folder =
    await findHistoryFolder(
      env,
      slug
    );

  if (!folder) {
    return [];
  }

  const result =
    await listDriveFiles(
      env,
      [
        `'${folder.id}' in parents`,
        "trashed=false",
        "mimeType='application/json'"
      ].join(" and "),
      "files(id,name,mimeType,size,createdTime,modifiedTime)",
      null,
      1000
    );

  return (result.files || [])
    .sort(
      (a, b) =>
        String(b.name)
          .localeCompare(
            String(a.name)
          )
    );
}

export async function getArticleHistory(
  env,
  slug
) {
  const files =
    await listHistoryFiles(
      env,
      slug
    );

  return files.map(
    (file, index) => ({
      version:
        file.name.replace(
          /\.json$/,
          ""
        ),

      file:
        file.name,

      size:
        Number(file.size || 0),

      summary:
        index === files.length - 1
          ? "Original snapshot"
          : "Updated content"
    })
  );
}

async function getHistorySnapshot(
  env,
  slug,
  version
) {
  const folder =
    await findHistoryFolder(
      env,
      slug
    );

  if (!folder) {
    return null;
  }

  const fileName =
    historyFileName(
      version
    );

  const result =
    await listDriveFiles(
      env,
      [
        `name='${escapeDriveQuery(fileName)}'`,
        `'${folder.id}' in parents`,
        "trashed=false"
      ].join(" and "),
      "files(id,name,mimeType,size,createdTime,modifiedTime)"
    );

  const file =
    result.files?.[0];

  if (!file) {
    return null;
  }

  const response =
    await downloadDriveFile(
      env,
      file.id
    );

  const text =
    await response.text();

  return {
    file,
    article:
      JSON.parse(text)
  };
}




// =========================================================
// RESTORE ARTICLE HISTORY
// =========================================================

export async function restoreArticleHistory(
  env,
  slug,
  version
) {

  const cleanSlug =
    String(slug || "").trim();

  const cleanVersion =
    String(version || "").trim();


  if (!cleanSlug) {
    throw new Error(
      "Article slug is required."
    );
  }

  if (!cleanVersion) {
    throw new Error(
      "History version is required."
    );
  }


  // Make sure the current article exists.
  const current =
    await getArticleBySlug(
      env,
      cleanSlug
    );


  if (!current) {
    throw new Error(
      "Article not found."
    );
  }


  // Get selected snapshot.
  const snapshot =
    await getHistorySnapshot(
      env,
      cleanSlug,
      cleanVersion
    );


  if (!snapshot) {
    throw new Error(
      "History version not found."
    );
  }


  const restored =
    {
      ...snapshot.article
    };


  // Never carry history metadata back
  // into the actual article.
  delete restored.$historyVersion;
  delete restored.$historyCreatedAt;


  // updateArticle() automatically creates
  // a backup of the current article before
  // replacing it.
  const updated =
    await updateArticle(
      env,
      cleanSlug,
      restored
    );


  return updated;
}


// =========================================================
// DELETE ONE HISTORY VERSION
// =========================================================

export async function deleteArticleHistory(
  env,
  slug,
  version
) {

  const cleanSlug =
    String(slug || "").trim();

  const cleanVersion =
    String(version || "").trim();


  if (!cleanSlug) {
    throw new Error(
      "Article slug is required."
    );
  }

  if (!cleanVersion) {
    throw new Error(
      "History version is required."
    );
  }


  const snapshot =
    await getHistorySnapshot(
      env,
      cleanSlug,
      cleanVersion
    );


  if (!snapshot) {
    throw new Error(
      "History version not found."
    );
  }


  await deleteDriveFile(
    env,
    snapshot.file.id
  );


  return true;
}


// =========================================================
// DELETE OLD HISTORY
// Keep newest 20 versions.
// =========================================================

export async function deleteOldArticleHistory(
  env,
  slug
) {

  const files =
    await listHistoryFiles(
      env,
      slug
    );


  // Keep newest 20.
  const oldFiles =
    files.slice(20);


  for (
    const file of oldFiles
  ) {

    await deleteDriveFile(
      env,
      file.id
    );

  }


  return oldFiles.length;
}


// =========================================================
// CLEAR HISTORY
// Keep newest version.
// =========================================================

export async function clearArticleHistory(
  env,
  slug
) {

  const files =
    await listHistoryFiles(
      env,
      slug
    );


  // Keep newest snapshot.
  const filesToDelete =
    files.slice(1);


  for (
    const file of filesToDelete
  ) {

    await deleteDriveFile(
      env,
      file.id
    );

  }


  return filesToDelete.length;
}





export async function deleteArticle(
  env,
  slug
) {
  const cleanSlug =
    String(slug || "").trim();

  if (!cleanSlug) {
    return;
  }

  const file =
    await findArticleFile(
      env,
      cleanSlug
    );

  if (!file) {
    return;
  }

  await deleteDriveFile(
    env,
    file.id
  );

  // Keep KV synchronized after deletion.
  await deleteCachedArticle(env, cleanSlug);

  const cachedIndex = await getCachedArticleIndex(env);
  if (Array.isArray(cachedIndex)) {
    const nextIndex = cachedIndex.filter(
      item => item?.slug !== cleanSlug
    );

    await setCachedArticleIndex(env, nextIndex);
  }
}

export async function listArticles(env) {
  // =========================================================
  // 1. KV INDEX CACHE FIRST
  // =========================================================

  const cached =
    await getCachedArticleIndex(env);

  if (
    Array.isArray(cached) &&
    cached.length > 0
  ) {

  
    return {
      total: cached.length,
      rows: cached
    };
  }

  // =========================================================
  // 2. CACHE MISS → GOOGLE DRIVE
  // =========================================================

  const folderId =
    requireDatabaseFolder(env);

  const rows = [];

  let pageToken = null;

  do {
    const params =
      new URLSearchParams({
        q: [
          `'${folderId}' in parents`,
          "trashed=false",
          "mimeType='application/json'"
        ].join(" and "),
        fields:
          "nextPageToken,files(id,name,mimeType,createdTime,modifiedTime)",
        pageSize: "100"
      });

    if (pageToken) {
      params.set(
        "pageToken",
        pageToken
      );
    }

    const result =
      await listDriveFiles(
        env,
        params.get("q"),
        params.get("fields"),
        pageToken,
        100
      );

    for (const file of result.files || []) {
      try {
        const article =
          await readArticleFile(
            env,
            file
          );

        if (
          article &&
          typeof article.slug === "string" &&
          article.slug.trim()
        ) {
          rows.push(article);

          // Cache each valid article.
          await setCachedArticle(
            env,
            article
          );
        }
      } catch (error) {
        console.error(
          `Failed to read ${file.name}:`,
          error.message
        );
      }
    }

    pageToken =
      result.nextPageToken || null;

  } while (pageToken);

  // =========================================================
  // 3. SAVE ARTICLE INDEX
  // =========================================================

  await setCachedArticleIndex(
    env,
    rows
  );

  return {
    total: rows.length,
    rows
  };
}

export async function ensureArticleDatabase(env) {
  requireDatabaseFolder(env);
  return true;
}
