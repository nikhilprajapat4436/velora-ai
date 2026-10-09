import test from "node:test";
import assert from "node:assert/strict";
import { generateCloudflareImage, ImageGenerationError } from "./cloudflareImageService.js";

const accountId = "0123456789abcdef0123456789abcdef";
const testToken = "test-token-never-used-for-network";
const pngBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const env = { CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: testToken };

test("sends Cloudflare's direct image input and parses its JSON base64 image", async () => {
  let requestedUrl;
  let requestedOptions;
  const result = await generateCloudflareImage({
    prompt: "A test image",
    dimensions: [1024, 1024],
    steps: 20,
    env,
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return new Response(JSON.stringify({ success: true, result: { image: pngBytes.toString("base64") } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(requestedUrl, `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`);
  assert.equal(requestedOptions.method, "POST");
  assert.equal(requestedOptions.headers.Authorization, `Bearer ${testToken}`);
  assert.deepEqual(JSON.parse(requestedOptions.body), {
    prompt: "A test image",
    negative_prompt: "blurry, low quality, distorted, watermark",
    width: 1024,
    height: 1024,
    num_steps: 20,
    guidance: 7.5,
  });
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.image, `data:image/png;base64,${pngBytes.toString("base64")}`);
});

test("accepts a binary image response and detects its actual image format", async () => {
  const result = await generateCloudflareImage({
    prompt: "A test image",
    dimensions: [832, 1216],
    steps: 14,
    env,
    fetchImpl: async () => new Response(pngBytes, { headers: { "Content-Type": "image/png" } }),
  });
  assert.equal(result.mimeType, "image/png");
});

test("maps Cloudflare authentication failures to a safe message", async () => {
  await assert.rejects(
    generateCloudflareImage({
      prompt: "A test image",
      dimensions: [1024, 1024],
      steps: 14,
      env,
      fetchImpl: async () => new Response(JSON.stringify({ errors: [{ message: `invalid ${testToken}` }] }), { status: 403 }),
    }),
    (error) => {
      assert.ok(error instanceof ImageGenerationError);
      assert.equal(error.code, "authentication");
      assert.equal(error.statusCode, 502);
      assert.match(error.message, /permissions/i);
      assert.equal(error.message.includes(testToken), false);
      return true;
    },
  );
});

test("rejects malformed image data rather than returning a fake image", async () => {
  await assert.rejects(
    generateCloudflareImage({
      prompt: "A test image",
      dimensions: [1024, 1024],
      steps: 14,
      env,
      fetchImpl: async () => new Response(JSON.stringify({ result: { image: "not-an-image" } }), {
        headers: { "Content-Type": "application/json" },
      }),
    }),
    (error) => error instanceof ImageGenerationError && error.code === "invalid_response",
  );
});
