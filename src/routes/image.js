
 import { downloadDriveFile } from "../drive/google.js";
import { getImage } from "../gallery/repository.js";

export async function imageRoute(request, env, id) {
  try {
    if (!id) {
      return Response.json(
        {
          success: false,
          message: "Image ID is required"
        },
        { status: 400 }
      );
    }

    const image = await getImage(env, id);

    if (!image) {
      return Response.json(
        {
          success: false,
          message: "Image not found"
        },
        { status: 404 }
      );
    }

    const response = await downloadDriveFile(
      env,
      image.driveId
    );

    if (!response.ok) {
      return new Response(
        response.body,
        {
          status: response.status,
          headers: response.headers
        }
      );
    }

    const headers = new Headers();

    headers.set(
      "Content-Type",
      image.mimeType || "application/octet-stream"
    );

    headers.set(
      "Cache-Control",
      "public, max-age=31536000"
    );

    headers.set(
      "X-Robots-Tag",
      "noindex"
    );

    return new Response(response.body, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error("Image route error:", error);

    return Response.json(
      {
        success: false,
        message: "Unable to load image"
      },
      { status: 500 }
    );
  }
}