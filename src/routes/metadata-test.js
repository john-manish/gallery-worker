
import {
  findImage,
  searchImages,
  getStats,
  getAlbumImages,
  findDuplicates
} from "../gallery/metadata.js";

export async function metadataTestRoute(request, env) {
  const url = new URL(request.url);

  try {
    if (url.pathname === "/metadata/test/stats") {
      const stats = await getStats(env);

      return Response.json({
        success: true,
        stats
      });
    }

    if (url.pathname === "/metadata/test/album") {
      const album = url.searchParams.get("album");

      if (!album) {
        return Response.json(
          {
            success: false,
            message: "album is required"
          },
          { status: 400 }
        );
      }

      const images = await getAlbumImages(
        env,
        album
      );

      return Response.json({
        success: true,
        count: images.length,
        images
      });
    }

    if (url.pathname === "/metadata/test/search") {
      const query = url.searchParams.get("q") || "";

      const images = await searchImages(
        env,
        query
      );

      return Response.json({
        success: true,
        count: images.length,
        images
      });
    }

    if (url.pathname === "/metadata/test/image") {
      const album = url.searchParams.get("album");
      const filename = url.searchParams.get("filename");

      if (!album || !filename) {
        return Response.json(
          {
            success: false,
            message: "album and filename are required"
          },
          { status: 400 }
        );
      }

      const image = await findImage(
        env,
        album,
        filename
      );

      return Response.json({
        success: true,
        image
      });
    }

    if (url.pathname === "/metadata/test/duplicates") {
      const duplicates = await findDuplicates(env);

      return Response.json({
        success: true,
        count: duplicates.length,
        duplicates
      });
    }

    return Response.json(
      {
        success: false,
        message: "Unknown metadata test"
      },
      { status: 404 }
    );

  } catch (error) {
    console.error(
      "Metadata test error:",
      error
    );

    return Response.json(
      {
        success: false,
        message: error.message
      },
      { status: 500 }
    );
  }
}