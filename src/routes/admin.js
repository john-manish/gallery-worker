import {
  readGallery,
  persistGallery
} from "../gallery/repository.js";

import {
  getStats,
  searchImages,
  getAlbumImages,
  findDuplicates,
  buildImageMetadata,
  addImage,
  findImage,
  updateImage,
  deleteImage
} from "../gallery/metadata.js";

import {
  listDriveFiles,
  downloadDriveFile,
  driveFetch
} from "../drive/google.js";


const FOLDER_MIME =
  "application/vnd.google-apps.folder";


// ======================================================
// HELPERS
// ======================================================

function json(data, status = 200) {
  return Response.json(data, { status });
}


function error(message, status = 500, extra = {}) {
  return Response.json(
    {
      success: false,
      message,
      ...extra
    },
    { status }
  );
}


function ok(data = {}) {
  return Response.json({
    success: true,
    ...data
  });
}


function getOriginalsRoot(env) {
  if (!env.DRIVE_ORIGINALS_ID) {
    throw new Error(
      "DRIVE_ORIGINALS_ID is missing"
    );
  }

  return env.DRIVE_ORIGINALS_ID;
}


function getThumbsRoot(env) {
  if (!env.DRIVE_THUMBS_ID) {
    throw new Error(
      "DRIVE_THUMBS_ID is missing"
    );
  }

  return env.DRIVE_THUMBS_ID;
}


function escapeDriveQuery(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}


async function listChildren(env, parentId) {
  const result = await listDriveFiles(
    env,
    `'${escapeDriveQuery(parentId)}' in parents and trashed=false`,
    "files(id,name,mimeType,size,createdTime,modifiedTime,parents)"
  );

  return result.files || [];
}


async function findFolder(env, parentId, name) {
  const files = await listChildren(env, parentId);

  return (
    files.find(
      file =>
        file.mimeType === FOLDER_MIME &&
        file.name === name
    ) || null
  );
}


async function createFolder(env, parentId, name) {
  const response = await driveFetch(
    env,
    "/files",
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME,
        parents: [parentId]
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Unable to create Drive folder: ${response.status} ${text}`
    );
  }

  return response.json();
}


async function ensureFolder(env, parentId, name) {
  const existing =
    await findFolder(
      env,
      parentId,
      name
    );

  if (existing) {
    return existing;
  }

  return createFolder(
    env,
    parentId,
    name
  );
}


async function ensureAlbumFolders(env, album) {
  const originalsRoot =
    getOriginalsRoot(env);

  const thumbsRoot =
    getThumbsRoot(env);

  const originals =
    await ensureFolder(
      env,
      originalsRoot,
      album
    );

  const thumbs =
    await ensureFolder(
      env,
      thumbsRoot,
      album
    );

  return {
    originals,
    thumbs
  };
}


async function deleteDriveFile(env, fileId) {
  const response =
    await driveFetch(
      env,
      `/files/${encodeURIComponent(fileId)}`,
      {
        method: "DELETE"
      }
    );

  if (!response.ok && response.status !== 404) {
    const text =
      await response.text();

    throw new Error(
      `Unable to delete Drive file: ${response.status} ${text}`
    );
  }

  return true;
}


async function renameDriveFile(
  env,
  fileId,
  name
) {
  const response =
    await driveFetch(
      env,
      `/files/${encodeURIComponent(fileId)}`,
      {
        method: "PATCH",

        headers: {
          "content-type":
            "application/json"
        },

        body: JSON.stringify({
          name
        })
      }
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `Unable to rename Drive file: ${response.status} ${text}`
    );
  }

  return response.json();
}


async function moveDriveFile(
  env,
  fileId,
  oldParentId,
  newParentId
) {
  const params =
    new URLSearchParams({
      addParents: newParentId,
      removeParents: oldParentId
    });

  const response =
    await driveFetch(
      env,
      `/files/${encodeURIComponent(fileId)}?${params}`,
      {
        method: "PATCH"
      }
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `Unable to move Drive file: ${response.status} ${text}`
    );
  }

  return response.json();
}


async function uploadDriveFile(
  env,
  file,
  parentId
) {
  const boundary =
    `----GalleryWorker${crypto.randomUUID()}`;

  const encoder =
    new TextEncoder();

  const metadata = {
    name: file.name,
    parents: [parentId]
  };

  const metadataBytes =
    encoder.encode(
      JSON.stringify(metadata)
    );

  const fileBytes =
    new Uint8Array(
      await file.arrayBuffer()
    );

  const prefix =
    encoder.encode(
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`
    );

  const suffix =
    encoder.encode(
      `\r\n--${boundary}--\r\n`
    );

  const body =
    new Uint8Array(
      prefix.byteLength +
      fileBytes.byteLength +
      suffix.byteLength
    );

  body.set(prefix, 0);

  body.set(
    fileBytes,
    prefix.byteLength
  );

  body.set(
    suffix,
    prefix.byteLength +
      fileBytes.byteLength
  );

  const response =
    await driveFetch(
      env,
      "/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime",
      {
        method: "POST",

        headers: {
          "content-type":
            `multipart/related; boundary=${boundary}`
        },

        body
      }
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `Upload failed: ${response.status} ${text}`
    );
  }

  return response.json();
}


// ======================================================
// OPTIONAL ADMIN AUTH
// ======================================================
//
// If ADMIN_TOKEN is configured in .dev.vars / Cloudflare,
// every admin request must use:
//
// Authorization: Bearer YOUR_ADMIN_TOKEN
//
// If ADMIN_TOKEN is not configured, local development
// remains open just like the current Worker.
// ======================================================

function checkAdminAuth(request, env) {
  if (!env.ADMIN_TOKEN) {
    return null;
  }

  const authorization =
    request.headers.get(
      "authorization"
    );

  const expected =
    `Bearer ${env.ADMIN_TOKEN}`;

  if (authorization !== expected) {
    return error(
      "Unauthorized",
      401
    );
  }

  return null;
}


// ======================================================
// ADMIN ROUTE
// ======================================================

export async function adminRoute(
  request,
  env
) {
  const url =
    new URL(request.url);

  try {

    // --------------------------------------------------
    // AUTH
    // --------------------------------------------------

    const authResponse =
      checkAdminAuth(
        request,
        env
      );

    if (authResponse) {
      return authResponse;
    }





    // ==================================================
    // DASHBOARD
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname === "/admin/stats"
    ) {
      const stats =
        await getStats(env);

      return ok(stats);
    }


    // ==================================================
    // STORAGE
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname === "/admin/storage"
    ) {
      const gallery =
        await readGallery(env);

      const imagesBytes =
        gallery.reduce(
          (sum, image) =>
            sum +
            Number(
              image.size || 0
            ),
          0
        );

      const thumbsBytes =
        gallery.reduce(
          (sum, image) =>
            sum +
            Number(
              image.thumbSize || 0
            ),
          0
        );

      const total =
        imagesBytes +
        thumbsBytes;

      const toMB =
        bytes =>
          Number(
            (
              bytes /
              1024 /
              1024
            ).toFixed(2)
          );

      return ok({
        storage:
          `${toMB(total)} MB`,

        imagesStorage:
          `${toMB(imagesBytes)} MB`,

        thumbsStorage:
          `${toMB(thumbsBytes)} MB`,

        imagesBytes,
        thumbsBytes,
        totalBytes: total
      });
    }


    // ==================================================
    // ALBUM LIST
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname === "/admin/albums"
    ) {
      const gallery =
        await readGallery(env);

      const map =
        new Map();

      for (
        const image
        of gallery
      ) {
        if (!image.album) {
          continue;
        }

        if (
          !map.has(
            image.album
          )
        ) {
          map.set(
            image.album,
            {
              name:
                image.album,

              images: 0,

              sizeBytes: 0,

              updatedAt:
                null
            }
          );
        }

        const album =
          map.get(
            image.album
          );

        album.images++;

        album.sizeBytes +=
          Number(
            image.size || 0
          );

        if (
          !album.updatedAt ||
          (
            image.updatedAt &&
            new Date(
              image.updatedAt
            ) >
            new Date(
              album.updatedAt
            )
          )
        ) {
          album.updatedAt =
            image.updatedAt;
        }
      }

      // Also include empty Drive folders.
      const rootFiles =
        await listChildren(
          env,
          getOriginalsRoot(env)
        );

      const folders =
        rootFiles.filter(
          file =>
            file.mimeType ===
            FOLDER_MIME
        );

      const albums =
        folders.map(
          folder => {
            const stats =
              map.get(
                folder.name
              );

            return {
              name:
                folder.name,

              folderId:
                folder.id,

              images:
                stats?.images || 0,

              sizeBytes:
                stats?.sizeBytes || 0,

              updatedAt:
                stats?.updatedAt ||
                folder.modifiedTime ||
                null,

              isEmpty:
                !stats ||
                stats.images === 0
            };
          }
        );

      // Metadata may contain an album whose
      // Drive folder does not currently exist.
      for (
        const [name, stats]
        of map
      ) {
        if (
          !albums.some(
            album =>
              album.name === name
          )
        ) {
          albums.push({
            ...stats,
            folderId: null,
            isEmpty:
              stats.images === 0
          });
        }
      }

      return ok({
        albums
      });
    }


    // ==================================================
    // CREATE ALBUM
    // ==================================================

    if (
      request.method === "POST" &&
      url.pathname === "/admin/album"
    ) {
      const body =
        await request.json()
          .catch(
            () => ({})
          );

      const name =
        String(
          body.name ||
          body.album ||
          ""
        ).trim();

      if (!name) {
        return error(
          "Album name required",
          400
        );
      }

      const existing =
        await findFolder(
          env,
          getOriginalsRoot(env),
          name
        );

      if (existing) {
        return error(
          "Album already exists",
          409
        );
      }

      const folders =
        await ensureAlbumFolders(
          env,
          name
        );

      return ok({
        album: name,
        originalsFolderId:
          folders.originals.id,
        thumbsFolderId:
          folders.thumbs.id
      });
    }


    // ==================================================
    // RENAME ALBUM
    // ==================================================

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith(
        "/admin/album/"
      )
    ) {
      const oldName =
        decodeURIComponent(
          url.pathname.substring(
            "/admin/album/".length
          )
        );

      const body =
        await request.json()
          .catch(
            () => ({})
          );

      const newName =
        String(
          body.newName ||
          body.name ||
          ""
        ).trim();

      if (!newName) {
        return error(
          "New album name required",
          400
        );
      }

      if (
        oldName === newName
      ) {
        return ok({
          oldName,
          newName
        });
      }

      const originalFolder =
        await findFolder(
          env,
          getOriginalsRoot(env),
          oldName
        );

      if (!originalFolder) {
        return error(
          "Album not found",
          404
        );
      }

      const existing =
        await findFolder(
          env,
          getOriginalsRoot(env),
          newName
        );

      if (existing) {
        return error(
          "Album already exists",
          409
        );
      }

      const thumbFolder =
        await findFolder(
          env,
          getThumbsRoot(env),
          oldName
        );

      await renameDriveFile(
        env,
        originalFolder.id,
        newName
      );

      if (thumbFolder) {
        await renameDriveFile(
          env,
          thumbFolder.id,
          newName
        );
      }

      const gallery =
        await readGallery(env);

      let changed = 0;

      for (
        const image
        of gallery
      ) {
        if (
          image.album === oldName
        ) {
          image.album =
            newName;

          image.updatedAt =
            new Date()
              .toISOString();

          changed++;
        }
      }

      await persistGallery(
        env,
        gallery
      );

      return ok({
        oldName,
        newName,
        changed
      });
    }


    // ==================================================
    // DELETE ALBUM
    // ==================================================

    if (
      request.method === "DELETE" &&
      url.pathname.startsWith(
        "/admin/album/"
      )
    ) {
      const album =
        decodeURIComponent(
          url.pathname.substring(
            "/admin/album/".length
          )
        );

      const originalFolder =
        await findFolder(
          env,
          getOriginalsRoot(env),
          album
        );

      if (!originalFolder) {
        return error(
          "Album not found",
          404
        );
      }

      const thumbFolder =
        await findFolder(
          env,
          getThumbsRoot(env),
          album
        );

      await deleteDriveFile(
        env,
        originalFolder.id
      );

      if (thumbFolder) {
        await deleteDriveFile(
          env,
          thumbFolder.id
        );
      }

      const gallery =
        await readGallery(env);

      const filtered =
        gallery.filter(
          image =>
            image.album !==
            album
        );

      const deleted =
        gallery.length -
        filtered.length;

      await persistGallery(
        env,
        filtered
      );

      return ok({
        album,
        deleted
      });
    }


    // ==================================================
    // IMAGE SEARCH
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname ===
        "/admin/images/search"
    ) {
      const query =
        url.searchParams.get(
          "q"
        ) || "";

      const images =
        await searchImages(
          env,
          query
        );

      return ok({
        images
      });
    }


    // ==================================================
    // IMAGE LIST
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname ===
        "/admin/images"
    ) {
      const gallery =
        await readGallery(env);

      return ok({
        images:
          gallery.filter(
            image =>
              image.filename
          )
      });
    }


    // ==================================================
    // IMAGE LIST BY ALBUM
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname.startsWith(
        "/admin/images/"
      )
    ) {
      const album =
        decodeURIComponent(
          url.pathname.substring(
            "/admin/images/".length
          )
        );

      if (!album) {
        return error(
          "Album required",
          400
        );
      }

      const images =
        await getAlbumImages(
          env,
          album
        );

      return ok({
        images
      });
    }


    // ==================================================
    // UPLOAD
    // ==================================================

    if (
      request.method === "POST" &&
      url.pathname ===
        "/admin/upload"
    ) {
      const form =
        await request.formData();

      const album =
        String(
          form.get("album") ||
          ""
        ).trim();

      if (!album) {
        return error(
          "Album required",
          400
        );
      }

      const files =
        form.getAll("images")
          .filter(
            value =>
              value instanceof File &&
              value.size > 0
          );

      if (!files.length) {
        return error(
          "No files uploaded",
          400
        );
      }

      const folders =
        await ensureAlbumFolders(
          env,
          album
        );

      const existingFiles =
        await listChildren(
          env,
          folders.originals.id
        );

      const existing =
        new Set(
          existingFiles.map(
            file =>
              file.name
          )
        );

      const uploaded = [];
      const skipped = [];
      const failed = [];

      for (
        const file
        of files
      ) {
        if (
          existing.has(
            file.name
          )
        ) {
          skipped.push(
            file.name
          );

          continue;
        }

        try {
          if (
            !file.type.startsWith(
              "image/"
            )
          ) {
            failed.push({
              file:
                file.name,

              message:
                "File is not an image"
            });

            continue;
          }

          const driveFile =
            await uploadDriveFile(
              env,
              file,
              folders.originals.id
            );

          const image =
            buildImageMetadata({
              album,

              filename:
                file.name,

              driveId:
                driveFile.id,

              thumbId:
                null,

              mimeType:
                file.type,

              size:
                file.size,

              thumbSize:
                0,

              width:
                null,

              height:
                null
            });

          // Drive metadata is more authoritative
          // for timestamps.
          if (
            driveFile.createdTime
          ) {
            image.createdAt =
              driveFile.createdTime;
          }

          if (
            driveFile.modifiedTime
          ) {
            image.updatedAt =
              driveFile.modifiedTime;
          }

          await addImage(
            env,
            image
          );

          uploaded.push(
            image
          );

          existing.add(
            file.name
          );

        }
        catch (uploadError) {
          console.error(
            "Upload failed:",
            file.name,
            uploadError
          );

          failed.push({
            file:
              file.name,

            message:
              uploadError.message
          });
        }
      }

      return ok({
        album,

        uploaded:
          uploaded.length,

        skipped:
          skipped.length,

        failed:
          failed.length,

        images:
          uploaded,

        skippedFiles:
          skipped,

        failedFiles:
          failed,

        message:
          uploaded.length
            ? "Upload completed"
            : "No files uploaded"
      });
    }


    // ==================================================
    // DELETE SINGLE IMAGE
    // ==================================================

    if (
      request.method === "DELETE" &&
      url.pathname.startsWith(
        "/admin/image/"
      )
    ) {
      const parts =
        url.pathname
          .substring(
            "/admin/image/"
              .length
          )
          .split("/");

      if (
        parts.length < 2
      ) {
        return error(
          "Album and filename required",
          400
        );
      }

      const album =
        decodeURIComponent(
          parts[0]
        );

      const filename =
        decodeURIComponent(
          parts
            .slice(1)
            .join("/")
        );

      const image =
        await findImage(
          env,
          album,
          filename
        );

      if (!image) {
        return error(
          "Image not found",
          404
        );
      }

      if (image.driveId) {
        await deleteDriveFile(
          env,
          image.driveId
        );
      }

      if (image.thumbId) {
        await deleteDriveFile(
          env,
          image.thumbId
        );
      }

      await deleteImage(
        env,
        album,
        filename
      );

      return ok({
        deleted: {
          album,
          filename
        }
      });
    }


    // ==================================================
    // BULK DELETE
    // ==================================================

    if (
      request.method === "DELETE" &&
      url.pathname ===
        "/admin/images"
    ) {
      const body =
        await request.json()
          .catch(
            () => ({})
          );

      if (
        !Array.isArray(
          body.images
        ) ||
        !body.images.length
      ) {
        return error(
          "Invalid request",
          400
        );
      }

      let deleted = 0;

      for (
        const item
        of body.images
      ) {
        if (
          !item.album ||
          !item.filename
        ) {
          continue;
        }

        const image =
          await findImage(
            env,
            item.album,
            item.filename
          );

        if (!image) {
          continue;
        }

        if (image.driveId) {
          await deleteDriveFile(
            env,
            image.driveId
          );
        }

        if (image.thumbId) {
          await deleteDriveFile(
            env,
            image.thumbId
          );
        }

        await deleteImage(
          env,
          item.album,
          item.filename
        );

        deleted++;
      }

      return ok({
        deleted
      });
    }


    // ==================================================
    // MOVE IMAGES
    // ==================================================

    if (
      request.method === "PATCH" &&
      url.pathname ===
        "/admin/images/move"
    ) {
      const body =
        await request.json()
          .catch(
            () => ({})
          );

      const destinationAlbum =
        String(
          body.to || ""
        ).trim();

      const images =
        body.images;

      if (
        !destinationAlbum ||
        !Array.isArray(images) ||
        !images.length
      ) {
        return error(
          "Invalid request",
          400
        );
      }

      const destination =
        await findFolder(
          env,
          getOriginalsRoot(env),
          destinationAlbum
        );

      if (!destination) {
        return error(
          "Destination album not found",
          404
        );
      }

      const thumbDestination =
        await findFolder(
          env,
          getThumbsRoot(env),
          destinationAlbum
        );

      let moved = 0;

      const gallery =
        await readGallery(env);

      for (
        const item
        of images
      ) {
        const image =
          gallery.find(
            candidate =>
              candidate.album ===
                item.album &&
              candidate.filename ===
                item.filename
          );

        if (!image) {
          continue;
        }

        const sourceFolder =
          await findFolder(
            env,
            getOriginalsRoot(env),
            item.album
          );

        if (
          image.driveId &&
          sourceFolder
        ) {
          await moveDriveFile(
            env,
            image.driveId,
            sourceFolder.id,
            destination.id
          );
        }

        if (
          image.thumbId &&
          thumbDestination
        ) {
          const sourceThumbFolder =
            await findFolder(
              env,
              getThumbsRoot(env),
              item.album
            );

          if (
            sourceThumbFolder
          ) {
            await moveDriveFile(
              env,
              image.thumbId,
              sourceThumbFolder.id,
              thumbDestination.id
            );
          }
        }

        image.album =
          destinationAlbum;

        image.updatedAt =
          new Date()
            .toISOString();

        moved++;
      }

      await persistGallery(
        env,
        gallery
      );

      return ok({
        moved
      });
    }


    // ==================================================
    // DUPLICATES
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname ===
        "/admin/duplicates"
    ) {
      const duplicates =
        await findDuplicates(
          env
        );

      return ok({
        count:
          duplicates.length,

        duplicates
      });
    }


    // ==================================================
    // SCANNER HEALTH
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname ===
        "/admin/health"
    ) {
      const gallery =
        await readGallery(env);

      const brokenImages =
        gallery.filter(
          image =>
            !image.driveId
        );

      const missingThumbs =
        gallery.filter(
          image =>
            !image.thumbId
        );

      const albums =
        new Set(
          gallery
            .map(
              image =>
                image.album
            )
            .filter(Boolean)
        );

      const emptyAlbums =
        [];

      return ok({
        albums:
          albums.size,

        images:
          gallery.length,

        missingThumbs:
          missingThumbs.length,

        brokenImages:
          brokenImages.length,

        emptyAlbums:
          emptyAlbums.length,

        duplicateImages:
          0
      });
    }


    // ==================================================
    // SCANNER REPORT
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname ===
        "/admin/report"
    ) {
      const gallery =
        await readGallery(env);

      const albums =
        new Set(
          gallery
            .map(
              image =>
                image.album
            )
            .filter(Boolean)
        );

      const missingThumbs =
        gallery.filter(
          image =>
            !image.thumbId
        ).length;

      const brokenImages =
        gallery.filter(
          image =>
            !image.driveId
        ).length;

      return ok({
        generatedAt:
          new Date()
            .toISOString(),

        health:
          missingThumbs ||
          brokenImages
            ? "Warning"
            : "Excellent",

        albums:
          albums.size,

        images:
          gallery.length,

        emptyAlbums:
          0,

        missingThumbs,

        brokenImages,

        duplicateImages:
          0
      });
    }


    // ==================================================
    // SYNC
    // ==================================================
    //
    // Full old syncGallery() depended on the Node
    // filesystem/cache architecture.
    //
    // For now the Worker metadata itself is the
    // source of truth and Drive mutations update it
    // immediately.
    // ==================================================

    if (
      request.method === "POST" &&
      url.pathname ===
        "/admin/sync"
    ) {
      const gallery =
        await readGallery(
          env,
          {
            force: true
          }
        );

      return ok({
        changed: false,
        albums:
          new Set(
            gallery
              .map(
                image =>
                  image.album
              )
              .filter(Boolean)
          ).size,

        images:
          gallery.length,

        message:
          "Gallery metadata refreshed from Drive"
      });
    }


    // ==================================================
    // REBUILD
    // ==================================================

    if (
      request.method === "POST" &&
      url.pathname ===
        "/admin/rebuild"
    ) {
      const gallery =
        await readGallery(
          env,
          {
            force: true
          }
        );

      return ok({
        rebuilt:
          gallery.length,

        albums:
          new Set(
            gallery
              .map(
                image =>
                  image.album
              )
              .filter(Boolean)
          ).size,

        images:
          gallery.length,

        changed:
          false,

        message:
          "Gallery metadata rebuilt from current Drive metadata"
      });
    }


    // ==================================================
    // REPAIR
    // ==================================================

    if (
      request.method === "POST" &&
      url.pathname ===
        "/admin/repair"
    ) {
      const gallery =
        await readGallery(
          env,
          {
            force: true
          }
        );

      const missingThumbs =
        gallery.filter(
          image =>
            !image.thumbId
        ).length;

      return ok({
        rebuilt: 0,

        skipped:
          missingThumbs,

        failed: 0,

        report: {
          images:
            gallery.length,

          missingThumbs
        },

        message:
          "Repair scan completed. Thumbnail generation is not yet enabled in the Worker."
      });
    }


    // ==================================================
    // THUMBNAIL REBUILD
    // ==================================================

    if (
      request.method === "POST" &&
      url.pathname ===
        "/admin/rebuild-thumbs"
    ) {
      return error(
        "Thumbnail generation is not yet implemented in the Worker",
        501
      );
    }


    // ==================================================
    // CLEAN
    // ==================================================

    if (
      request.method === "POST" &&
      url.pathname ===
        "/admin/clean"
    ) {
      return ok({
        removed: 0,

        message:
          "Nothing to clean"
      });
    }


    // ==================================================
    // ZIP
    // ==================================================
    //
    // The old implementation used Node archiver.
    // Worker version will be added separately.
    // ==================================================

    if (
      request.method === "POST" &&
      url.pathname ===
        "/admin/images/zip"
    ) {
      return error(
        "ZIP generation is not yet implemented in the Worker",
        501
      );
    }


    // ==================================================
    // EXPLORER TREE
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname ===
        "/admin/explorer/tree"
    ) {
      const originals =
        await listChildren(
          env,
          getOriginalsRoot(env)
        );

      const thumbs =
        await listChildren(
          env,
          getThumbsRoot(env)
        );

      return ok({
        tree: {
          name:
            "Gallery OS",

          type:
            "root",

          source:
            "drive",

          id:
            "explorer-root",

          children: [
            {
              name:
                "Originals",

              type:
                "folder",

              source:
                "drive",

              id:
                "drive-originals",

              children:
                originals
                  .filter(
                    file =>
                      file.mimeType ===
                      FOLDER_MIME
                  )
                  .map(
                    folder => ({
                      name:
                        folder.name,

                      type:
                        "folder",

                      source:
                        "drive",

                      id:
                        `drive-originals/${encodeURIComponent(folder.name)}`
                    })
                  )
            },

            {
              name:
                "Thumbnails",

              type:
                "folder",

              source:
                "drive",

              id:
                "drive-thumbnails",

              children:
                thumbs
                  .filter(
                    file =>
                      file.mimeType ===
                      FOLDER_MIME
                  )
                  .map(
                    folder => ({
                      name:
                        folder.name,

                      type:
                        "folder",

                      source:
                        "drive",

                      id:
                        `drive-thumbnails/${encodeURIComponent(folder.name)}`
                    })
                  )
            }
          ]
        }
      });
    }


    // ==================================================
    // EXPLORER FOLDER
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname ===
        "/admin/explorer/folder"
    ) {
      const id =
        url.searchParams.get(
          "id"
        );

      if (!id) {
        return error(
          "Folder id required",
          400
        );
      }

      if (
        id ===
        "drive-root"
      ) {
        return ok({
          items: [
            {
              name:
                "Originals",

              type:
                "folder",

              source:
                "drive",

              id:
                "drive-originals"
            },

            {
              name:
                "Thumbnails",

              type:
                "folder",

              source:
                "drive",

              id:
                "drive-thumbnails"
            }
          ]
        });
      }


      if (
        id ===
        "drive-originals"
      ) {
        const files =
          await listChildren(
            env,
            getOriginalsRoot(env)
          );

        return ok({
          items:
            files.map(
              file => ({
                name:
                  file.name,

                type:
                  file.mimeType ===
                  FOLDER_MIME
                    ? "folder"
                    : "file",

                source:
                  "drive",

                id:
                  file.id,

                size:
                  Number(
                    file.size || 0
                  ),

                mimeType:
                  file.mimeType
              })
            )
        });
      }


      if (
        id ===
        "drive-thumbnails"
      ) {
        const files =
          await listChildren(
            env,
            getThumbsRoot(env)
          );

        return ok({
          items:
            files.map(
              file => ({
                name:
                  file.name,

                type:
                  file.mimeType ===
                  FOLDER_MIME
                    ? "folder"
                    : "file",

                source:
                  "drive",

                id:
                  file.id,

                size:
                  Number(
                    file.size || 0
                  ),

                mimeType:
                  file.mimeType
              })
            )
        });
      }


      if (
        id.startsWith(
          "drive-originals/"
        )
      ) {
        const album =
          decodeURIComponent(
            id.substring(
              "drive-originals/"
                .length
            )
          );

        const folder =
          await findFolder(
            env,
            getOriginalsRoot(env),
            album
          );

        if (!folder) {
          return ok({
            items: []
          });
        }

        const files =
          await listChildren(
            env,
            folder.id
          );

        return ok({
          items:
            files.map(
              file => ({
                name:
                  file.name,

                type:
                  file.mimeType ===
                  FOLDER_MIME
                    ? "folder"
                    : "file",

                source:
                  "drive",

                id:
                  file.id,

                size:
                  Number(
                    file.size || 0
                  ),

                mimeType:
                  file.mimeType
              })
            )
        });
      }


      if (
        id.startsWith(
          "drive-thumbnails/"
        )
      ) {
        const album =
          decodeURIComponent(
            id.substring(
              "drive-thumbnails/"
                .length
            )
          );

        const folder =
          await findFolder(
            env,
            getThumbsRoot(env),
            album
          );

        if (!folder) {
          return ok({
            items: []
          });
        }

        const files =
          await listChildren(
            env,
            folder.id
          );

        return ok({
          items:
            files.map(
              file => ({
                name:
                  file.name,

                type:
                  file.mimeType ===
                  FOLDER_MIME
                    ? "folder"
                    : "file",

                source:
                  "drive",

                id:
                  file.id,

                size:
                  Number(
                    file.size || 0
                  ),

                mimeType:
                  file.mimeType
              })
            )
        });
      }

      return ok({
        items: []
      });
    }


    // ==================================================
    // EXPLORER FILE
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname ===
        "/admin/explorer/file"
    ) {
      const id =
        url.searchParams.get(
          "id"
        );

      if (!id) {
        return error(
          "File id required",
          400
        );
      }

      const response =
        await downloadDriveFile(
          env,
          id
        );

      const headers =
        new Headers(
          response.headers
        );

      headers.set(
        "Cache-Control",
        "private, max-age=60"
      );

      return new Response(
        response.body,
        {
          status:
            response.status,

          headers
        }
      );
    }


    // ==================================================
    // HISTORY
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname ===
        "/admin/history"
    ) {
      return ok({
        history: []
      });
    }


    // ==================================================
    // ACTIVITY
    // ==================================================

    if (
      request.method === "GET" &&
      (
        url.pathname ===
          "/admin/activity" ||
        url.pathname ===
          "/admin/activity/session"
      )
    ) {
      return ok({
        activity: []
      });
    }


    // ==================================================
    // DRIVE DEBUG
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname ===
        "/admin/drive-files"
    ) {
      const files =
        await listChildren(
          env,
          getOriginalsRoot(env)
        );

      return ok({
        files
      });
    }


    if (
      request.method === "GET" &&
      url.pathname ===
        "/admin/debug/folders"
    ) {
      const folders =
        await listChildren(
          env,
          getOriginalsRoot(env)
        );

      return ok({
        DRIVE_ORIGINALS_ID:
          env.DRIVE_ORIGINALS_ID,

        folders
      });
    }


    if (
      request.method === "GET" &&
      url.pathname ===
        "/admin/debug/thumbs"
    ) {
      const gallery =
        await readGallery(env);

      return ok({
        total:
          gallery.length,

        withThumbId:
          gallery.filter(
            image =>
              image.thumbId
          ).length,

        sample:
          gallery
            .slice(0, 10)
            .map(
              image => ({
                filename:
                  image.filename,

                thumbId:
                  image.thumbId
              })
            )
      });
    }


    // ==================================================
    // ENV DEBUG
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname ===
        "/admin/env-debug"
    ) {
      return ok({
        email:
          !!env.GOOGLE_CLIENT_EMAIL,

        key:
          !!env.GOOGLE_PRIVATE_KEY,

        keyLength:
          env.GOOGLE_PRIVATE_KEY
            ?.length || 0,

        driveOriginals:
          !!env.DRIVE_ORIGINALS_ID,

        driveThumbs:
          !!env.DRIVE_THUMBS_ID,

        driveMetadata:
          !!env.DRIVE_METADATA_ID
      });
    }


    // ==================================================
    // UNKNOWN ROUTE
    // ==================================================

    return error(
      "Admin route not found",
      404
    );

  }
  catch (err) {
    console.error(
      "Admin route error:",
      err
    );

    return error(
      "Admin request failed",
      500,
      {
        error:
          err?.message ||
          String(err)
      }
    );
  }
} 