import http from "node:http";

const PORT = process.env.PORT || 8787;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    const request = new Request(url, {
      method: req.method,
      headers: req.headers
    });

    const { default: worker } = await import("../src/index.js");

    const response = await worker.fetch(request, {}, {});

    res.statusCode = response.status;

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const body = await response.arrayBuffer();
    res.end(Buffer.from(body));
  } catch (error) {
    console.error(error);

    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      error: error.message
    }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Local Worker: http://localhost:${PORT}`);
});
