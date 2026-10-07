
import { readGallery } from "../gallery/repository.js";

export async function galleryRoute(request, env) {
  try {
    const gallery = await readGallery(env);

    const map = {};

    for (const image of gallery) {
      if (!image.album) continue;

      map[image.album] ??= [];

      map[image.album].push({
        id: image.id,
        filename: image.filename,
        url: image.url,
        thumb: image.thumb
      });
    }

    const albums = Object.entries(map).map(
      ([name, images]) => ({
        name,
        count: images.length,
        images
      })
    );

    return Response.json({
      success: true,
      albums
    });

  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        message: "Unable to load gallery"
      },
      { status: 500 }
    );
  }
}