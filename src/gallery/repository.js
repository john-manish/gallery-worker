import {
  getDriveFile,
  listDriveFiles,
  downloadDriveFile,
  updateDriveFileMedia,
  createDriveFile
} from "../drive/google.js";


const GALLERY_FILE = "gallery.json";


// ─────────────────────────────────────────────
// Cloudflare persistent edge cache
// Cloudflare KV cache
// ─────────────────────────────────────────────

const GALLERY_CACHE_KEY = "gallery.json";
 
// ─────────────────────────────────────────────
// Gallery memory cache
// ─────────────────────────────────────────────

let memoryGallery = null;
let memoryGalleryLoadedAt = 0;

const MEMORY_CACHE_TTL = 30 * 1000;


// ─────────────────────────────────────────────
// Metadata file cache
// ─────────────────────────────────────────────
//
// Resolving gallery.json by searching Drive is
// unnecessary on every request.
//
// Once resolved, keep the Drive file ID in memory.
//
// This cache disappears when the Worker isolate
// is recycled, which is fine because Drive remains
// the source of truth.
//

let metadataFileIdCache = null;
let metadataFileIdLoadedAt = 0;

const METADATA_CACHE_TTL = 5 * 60 * 1000;


// Prevent multiple simultaneous requests from
// all resolving gallery.json independently.
let metadataResolvePromise = null;


// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function escapeDriveQuery(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}


function isFolder(file) {
  return (
    file?.mimeType ===
    "application/vnd.google-apps.folder"
  );
}


function isGalleryFile(file) {
  if (!file) {
    return false;
  }

  return (
    file.name === GALLERY_FILE ||
    file.mimeType === "application/json"
  );
}


// ─────────────────────────────────────────────
// Resolve gallery.json
// ─────────────────────────────────────────────
//
// DRIVE_METADATA_ID can be:
//
// 1. The actual gallery.json file ID
//
// OR
//
// 2. The Drive folder containing gallery.json
//
// This keeps compatibility with the current
// environment while allowing the cleaner
// direct-file-ID configuration long term.
//

async function resolveMetadataFileId(env) {
  const configuredId =
    env.GALLERY_METADATA_FILE_ID ||
    env.DRIVE_METADATA_ID;

  if (!configuredId) {
    throw new Error(
      "GALLERY_METADATA_FILE_ID or DRIVE_METADATA_ID is missing"
    );
  }


  // ───────────────────────────────────────────
  // First: treat configured ID as a Drive file
  // ───────────────────────────────────────────

  try {
    const file =
      await getDriveFile(
        env,
        configuredId
      );

    // Direct gallery.json file.
    if (
      !isFolder(file) &&
      (
        file.name === GALLERY_FILE ||
        file.mimeType === "application/json"
      )
    ) {
      return file.id;
    }


    // If configured ID is a folder,
    // search inside it below.
    if (!isFolder(file)) {
      throw new Error(
        `Configured metadata ID points to "${file.name}", not ${GALLERY_FILE}`
      );
    }

  } catch (error) {

    // If the ID itself could not be fetched,
    // retain the folder-search fallback.
    //
    // This is important for compatibility with
    // the existing DRIVE_METADATA_ID setup.
  }


  // ───────────────────────────────────────────
  // Second: treat configured ID as parent folder
  // ───────────────────────────────────────────

  const name =
    escapeDriveQuery(GALLERY_FILE);

  const result =
    await listDriveFiles(
      env,
      `name='${name}' and '${configuredId}' in parents and trashed=false`,
      "files(id,name,mimeType,size,modifiedTime)"
    );

  const files =
    result.files || [];

  if (!files.length) {
    throw new Error(
      `Unable to find ${GALLERY_FILE} in configured Drive location`
    );
  }

  // Prefer an exact gallery.json file.
  const galleryFile =
    files.find(
      file =>
        file.name === GALLERY_FILE
    );

  if (!galleryFile) {
    throw new Error(
      `Drive metadata file ${GALLERY_FILE} was not found`
    );
  }

  return galleryFile.id;
}


// ─────────────────────────────────────────────
// Get cached metadata file ID
// ─────────────────────────────────────────────

async function getMetadataFileId(env, options = {}) {

  const now =
    Date.now();


  // Force resolution when explicitly requested.
  if (
    !options.force &&
    metadataFileIdCache &&
    now - metadataFileIdLoadedAt <
      METADATA_CACHE_TTL
  ) {
    return metadataFileIdCache;
  }


  // Prevent concurrent Drive lookups.
  if (
    !options.force &&
    metadataResolvePromise
  ) {
    return metadataResolvePromise;
  }


  metadataResolvePromise =
    resolveMetadataFileId(env);

  try {

    const fileId =
      await metadataResolvePromise;

    metadataFileIdCache =
      fileId;

    metadataFileIdLoadedAt =
      Date.now();

    return fileId;

  } finally {

    metadataResolvePromise =
      null;
  }
}


// HELPER

// ─────────────────────────────────────────────
// Cloudflare KV cache
// ─────────────────────────────────────────────

async function readKVGalleryCache(env) {
  if (!env.GALLERY_CACHE) {
    return null;
  }

  const cached =
    await env.GALLERY_CACHE.get(
      GALLERY_CACHE_KEY
    );

  if (!cached) {
    return null;
  }

  try {
    const gallery =
      JSON.parse(cached);

    if (!Array.isArray(gallery)) {
      return null;
    }

    return gallery;

  } catch {
    return null;
  }
}


async function writeKVGalleryCache(
  env,
  gallery
) {
  if (!env.GALLERY_CACHE) {
    return;
  }

  await env.GALLERY_CACHE.put(
    GALLERY_CACHE_KEY,
    JSON.stringify(gallery)
  );
}


async function deleteKVGalleryCache(env) {
  if (!env.GALLERY_CACHE) {
    return;
  }

  await env.GALLERY_CACHE.delete(
    GALLERY_CACHE_KEY
  );
}


// ─────────────────────────────────────────────
// Read gallery.json from Drive
// ─────────────────────────────────────────────

async function readDriveGallery(
  env,
  options = {}
) {
  
  if (!options.force) {
    const cached =
      await readKVGalleryCache(env);

    if (cached) {
      return cached;
    }
  }

  const fileId =
    await getMetadataFileId(
      env,
      options
    );


  const response =
    await downloadDriveFile(
      env,
      fileId
    );


  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `Unable to download ${GALLERY_FILE}: ${response.status} ${errorText}`
    );
  }


  const text =
    await response.text();


  let gallery;

  try {

    gallery =
      JSON.parse(text);

  } catch (error) {

    throw new Error(
      `${GALLERY_FILE} contains invalid JSON`
    );
  }


  if (!Array.isArray(gallery)) {

    throw new Error(
      `${GALLERY_FILE} must contain a JSON array`
    );
  }


  await writeKVGalleryCache(
    env,
    gallery
  );

  return gallery;
}


// ─────────────────────────────────────────────
// Read gallery
// ─────────────────────────────────────────────

export async function readGallery(
  env,
  options = {}
) {

  const now =
    Date.now();


  if (
    !options.force &&
    memoryGallery &&
    now - memoryGalleryLoadedAt <
      MEMORY_CACHE_TTL
  ) {

    return memoryGallery;
  }


  const gallery =
    await readDriveGallery(
      env,
      options
    );


  memoryGallery =
    gallery;

  memoryGalleryLoadedAt =
    Date.now();


  return gallery;
}


// ─────────────────────────────────────────────
// Persist gallery
// ─────────────────────────────────────────────

export async function persistGallery(
  env,
  gallery
) {

  if (!Array.isArray(gallery)) {

    throw new Error(
      "Gallery must be an array"
    );
  }


  const body =
    JSON.stringify(
      gallery,
      null,
      2
    );


  const fileId =
    await getMetadataFileId(
      env
    );


  let result;


  // Existing gallery.json
  if (fileId) {

    result =
      await updateDriveFileMedia(
        env,
        fileId,
        body,
        "application/json"
      );

  } else {

    // This branch is mostly a safety fallback.
    //
    // Normally resolveMetadataFileId() throws
    // when the metadata file cannot be found.
    //
    // DRIVE_METADATA_ID must therefore point to
    // a folder for creation to work.

    const parentId =
      env.DRIVE_METADATA_ID;

    if (!parentId) {

      throw new Error(
        "Cannot create gallery.json: metadata parent folder is missing"
      );
    }


    result =
      await createDriveFile(
        env,
        GALLERY_FILE,
        parentId,
        body,
        "application/json"
      );
  }


  // Drive succeeded, so update KV with the
  // exact same gallery that was just persisted.
  await writeKVGalleryCache(
    env,
    gallery
  );

  // Update memory only after both Drive and KV
  // have succeeded.
  memoryGallery =
    gallery;

  memoryGalleryLoadedAt =
    Date.now();

  // The metadata file itself now exists.
  if (result?.id) {

    metadataFileIdCache =
      result.id;

    metadataFileIdLoadedAt =
      Date.now();
  }

  return {
    gallery,
    file: result
  };
}


// ─────────────────────────────────────────────
// Clear caches
// ─────────────────────────────────────────────

export function clearGalleryCache() {

  memoryGallery =
    null;

  memoryGalleryLoadedAt =
    0;

  metadataFileIdCache =
    null;

  metadataFileIdLoadedAt =
    0;

  metadataResolvePromise =
    null;
}


// ─────────────────────────────────────────────
// Update gallery
// ─────────────────────────────────────────────

export async function updateGallery(
  env,
  updater
) {

  const gallery =
    await readGallery(env);


  const updated =
    await updater(gallery);


  await persistGallery(
    env,
    updated
  );


  return updated;
}


// ─────────────────────────────────────────────
// Find image by internal UUID
// ─────────────────────────────────────────────

export async function getImage(
  env,
  id
) {

  if (!id) {
    return null;
  }


  const gallery =
    await readGallery(env);


  return (
    gallery.find(
      image =>
        image &&
        String(image.id) ===
          String(id)
    ) ||
    null
  );
}


// ─────────────────────────────────────────────
// Add image
// ─────────────────────────────────────────────

export async function addImage(
  env,
  image
) {

  if (!image || !image.id) {

    throw new Error(
      "Image with a valid id is required"
    );
  }


  const gallery =
    await readGallery(env);


  gallery.push(image);


  await persistGallery(
    env,
    gallery
  );


  return image;
}


// ─────────────────────────────────────────────
// Update image
// ─────────────────────────────────────────────

export async function updateImage(
  env,
  id,
  updates
) {

  const gallery =
    await readGallery(env);


  const image =
    gallery.find(
      image =>
        image &&
        String(image.id) ===
          String(id)
    );


  if (!image) {
    return null;
  }


  Object.assign(
    image,
    updates,
    {
      updatedAt:
        new Date().toISOString()
    }
  );


  await persistGallery(
    env,
    gallery
  );


  return image;
}


// ─────────────────────────────────────────────
// Delete images
// ─────────────────────────────────────────────

export async function deleteImage(
  env,
  album,
  filename
) {

  const gallery =
    await readGallery(env);


  const filtered =
    gallery.filter(
      image =>
        !(
          image.album === album &&
          image.filename === filename
        )
    );


  await persistGallery(
    env,
    filtered
  );


  return true;
}