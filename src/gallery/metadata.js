

import {
  readGallery,
  persistGallery,
  getImage as repositoryGetImage,
  addImage as repositoryAddImage,
  updateImage as repositoryUpdateImage,
  deleteImage as repositoryDeleteImage
} from "./repository.js";

/**
 * Build metadata for a newly added image.
 */
export function buildImageMetadata({
  album,
  filename,
  driveId,
  thumbId,
  mimeType,
  size,
  thumbSize,
  width = null,
  height = null
}) {
  const id = crypto.randomUUID();

  return {
    id,

    album,
    filename,

    basename: filename
      ? filename.replace(/\.[^/.]+$/, "")
      : "",

    extension: filename
      ? filename.includes(".")
        ? filename.slice(filename.lastIndexOf("."))
        : ""
      : "",

    driveId,
    thumbId,

    url: `/image/${id}`,
    thumb: `/thumb/${id}`,

    preview: driveId
      ? `https://drive.google.com/file/d/${driveId}/view`
      : null,

    mimeType,

    size,
    thumbSize,

    width,
    height,

    aspectRatio:
      width && height
        ? `${width}:${height}`
        : null,

    orientation:
      width && height
        ? width > height
          ? "landscape"
          : width < height
            ? "portrait"
            : "square"
        : null,

    hash: null,

    favorite: false,
    hidden: false,
    deleted: false,

    tags: [],
    description: "",
    location: "",

    albumOrder: 0,

    viewCount: 0,
    lastViewed: null,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}


/**
 * IMAGE CRUD
 */

export async function addImage(env, image) {
  return repositoryAddImage(env, image);
}

export async function getImage(env, id) {
  return repositoryGetImage(env, id);
}

export async function findImage(env, album, filename) {
  const gallery = await readGallery(env);

  return (
    gallery.find(
      image =>
        image.album === album &&
        image.filename === filename
    ) || null
  );
}

export async function updateImage(env, id, updates) {
  return repositoryUpdateImage(env, id, updates);
}

export async function deleteImage(env, album, filename) {
  return repositoryDeleteImage(env, album, filename);
}


/**
 * ALBUMS
 */

export async function getAlbumImages(env, album) {
  const gallery = await readGallery(env);

  return gallery.filter(
    image =>
      image.filename &&
      image.album === album
  );
}

export async function renameAlbum(
  env,
  oldName,
  newName
) {
  const gallery = await readGallery(env);

  let changed = false;

  for (const image of gallery) {
    if (image.album === oldName) {
      image.album = newName;
      image.updatedAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) {
    await persistGallery(env, gallery);
  }

  return changed;
}

export async function moveImages(
  env,
  ids,
  album
) {
  const gallery = await readGallery(env);

  let moved = 0;

  for (const image of gallery) {
    if (ids.includes(image.id)) {
      image.album = album;
      image.updatedAt = new Date().toISOString();
      moved++;
    }
  }

  if (moved) {
    await persistGallery(env, gallery);
  }

  return moved;
}


/**
 * SEARCH
 */

export async function searchImages(env, query) {
  query = String(query || "")
    .toLowerCase()
    .trim();

  const gallery = await readGallery(env);

  return gallery.filter(image => {
    const text = [
      image.filename,
      image.album,
      ...(image.tags || [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(query);
  });
}


/**
 * FAVORITES
 */

export async function toggleFavorite(env, id) {
  const image = await getImage(env, id);

  if (!image) {
    return null;
  }

  return updateImage(
    env,
    id,
    {
      favorite: !image.favorite
    }
  );
}


/**
 * VIEWS
 */

export async function incrementViews(env, id) {
  const image = await getImage(env, id);

  if (!image) {
    return null;
  }

  return updateImage(
    env,
    id,
    {
      viewCount:
        (image.viewCount || 0) + 1,

      lastViewed:
        new Date().toISOString()
    }
  );
}


/**
 * STATS
 */

export async function getStats(env) {
  const gallery = await readGallery(env);

  const albums = new Set(
    gallery.map(image => image.album)
  );

  const totalSize = gallery.reduce(
    (sum, image) =>
      sum + (image.size || 0),
    0
  );

  const favorites = gallery.filter(
    image => image.favorite
  ).length;

  return {
    albums: albums.size,
    images: gallery.length,
    favorites,
    totalSize
  };
}


/**
 * DUPLICATES
 */

export async function findDuplicates(env) {
  const gallery = await readGallery(env);

  const map = new Map();
  const duplicates = [];

  for (const image of gallery) {
    if (!image.hash) {
      continue;
    }

    if (map.has(image.hash)) {
      duplicates.push(image);
    } else {
      map.set(image.hash, image);
    }
  }

  return duplicates;
}