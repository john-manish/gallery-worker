import {
  getDriveFile,
  listDriveFiles
} from "./drive/google.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      // Basic health check
      if (url.pathname === "/health") {
        return Response.json({
          ok: true,
          service: "gallery-worker"
        });
      }

      // Temporary Google Drive test
      if (url.pathname === "/drive/test") {
        if (!env.GOOGLE_CLIENT_EMAIL) {
          return Response.json(
            {
              ok: false,
              error: "GOOGLE_CLIENT_EMAIL is missing"
            },
            { status: 500 }
          );
        }

        if (!env.GOOGLE_PRIVATE_KEY) {
          return Response.json(
            {
              ok: false,
              error: "GOOGLE_PRIVATE_KEY is missing"
            },
            { status: 500 }
          );
        }

        if (!env.DRIVE_METADATA_ID) {
          return Response.json(
            {
              ok: false,
              error: "DRIVE_METADATA_ID is missing"
            },
            { status: 500 }
          );
        }

        const file = await getDriveFile(
          env,
          env.DRIVE_METADATA_ID
        );

        return Response.json({
          ok: true,
          drive: file
        });
      }

      return Response.json({
        ok: true,
        service: "gallery-worker",
        message: "Gallery Worker is running"
      });

    } catch (error) {
      console.error(error);

      return Response.json(
        {
          ok: false,
          error: error.message
        },
        { status: 500 }
      );
    }
  }
};
