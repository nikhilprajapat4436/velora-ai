const DEFAULT_IMAGE_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export class ImageGenerationError extends Error {
  constructor(code, message, statusCode = 502, upstreamStatus = null) {
    super(message);
    this.name = "ImageGenerationError";
    this.code = code;
    this.statusCode = statusCode;
    this.upstreamStatus = upstreamStatus;
  }
}

const IMAGE_ERRORS = {
  configuration: "Image generation is not configured. Check the Cloudflare credentials in the server environment.",
  authentication: "The image service could not authenticate. Check the Cloudflare API token and its Workers AI permissions in Render.",
  rateLimit: "The image service is busy. Please wait a little and try again.",
  rejected: "The image service rejected this request. Try a shorter or simpler prompt.",
  unavailable: "The image service is temporarily unavailable. Please try again shortly.",
  timeout: "Image generation took too long. Please try again.",
  network: "Could not connect to the image service. Please try again shortly.",
  invalidResponse: "The image service returned an invalid response. Please try again.",
  tooLarge: "The generated image exceeded the 10 MB limit. Try a smaller image size.",
};

function imageError(code, statusCode, upstreamStatus = null) {
  const messages = {
    configuration: IMAGE_ERRORS.configuration,
    authentication: IMAGE_ERRORS.authentication,
    rate_limit: IMAGE_ERRORS.rateLimit,
    request_rejected: IMAGE_ERRORS.rejected,
    upstream_unavailable: IMAGE_ERRORS.unavailable,
    timeout: IMAGE_ERRORS.timeout,
    network: IMAGE_ERRORS.network,
    invalid_response: IMAGE_ERRORS.invalidResponse,
    image_too_large: IMAGE_ERRORS.tooLarge,
  };
  return new ImageGenerationError(code, messages[code] || IMAGE_ERRORS.unavailable, statusCode, upstreamStatus);
}

function getUpstreamFailure(response) {
  if (response.status === 401 || response.status === 403) {
    return imageError("authentication", 502, response.status);
  }
  if (response.status === 429) return imageError("rate_limit", 429, response.status);
  if (response.status === 400 || response.status === 422) {
    return imageError("request_rejected", 502, response.status);
  }
  if (response.status >= 500) return imageError("upstream_unavailable", 503, response.status);
  return imageError("upstream_unavailable", 502, response.status);
}

function getImageMimeType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function decodeImageResponse(response, payload) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.toLowerCase().startsWith("image/")) {
    return Buffer.from(payload);
  }

  let parsed;
  try {
    parsed = JSON.parse(payload.toString("utf8"));
  } catch {
    throw imageError("invalid_response", 502);
  }
  if (parsed?.success === false) throw imageError("upstream_unavailable", 502);

  let image = parsed?.result?.image || parsed?.result;
  if (typeof image !== "string" || image.length === 0) throw imageError("invalid_response", 502);
  image = image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, "");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image)) {
    throw imageError("invalid_response", 502);
  }
  return Buffer.from(image, "base64");
}

export async function generateCloudflareImage({
  prompt,
  dimensions,
  steps,
  env = process.env,
  fetchImpl = fetch,
}) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !apiToken) throw imageError("configuration", 503);

  const imageModel = env.CLOUDFLARE_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  const modelPath = imageModel.split("/").map((part) => encodeURIComponent(part).replace(/^%40/i, "@")).join("/");
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${modelPath}`;
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: "blurry, low quality, distorted, watermark",
        width: dimensions[0],
        height: dimensions[1],
        num_steps: steps,
        guidance: 7.5,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw imageError("timeout", 504);
    }
    throw imageError("network", 502);
  }

  if (!response.ok) throw getUpstreamFailure(response);

  let raw;
  try {
    raw = Buffer.from(await response.arrayBuffer());
  } catch {
    throw imageError("invalid_response", 502);
  }
  if (!raw.length) throw imageError("invalid_response", 502);

  let imageBuffer;
  try {
    imageBuffer = decodeImageResponse(response, raw);
  } catch (error) {
    if (error instanceof ImageGenerationError) throw error;
    throw imageError("invalid_response", 502);
  }
  if (imageBuffer.length > MAX_IMAGE_BYTES) throw imageError("image_too_large", 502);

  const mimeType = getImageMimeType(imageBuffer);
  if (!mimeType) throw imageError("invalid_response", 502);
  return {
    image: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
    mimeType,
    model: imageModel,
  };
}
