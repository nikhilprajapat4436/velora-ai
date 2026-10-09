import vm from "node:vm";

const MAX_CODE_LENGTH = 100000;
const MAX_TEXT_LENGTH = 200000;

const validateJavaScript = (code) => {
  if (!code || typeof code !== "string") {
    throw new Error("JavaScript code is required");
  }

  if (code.length > MAX_CODE_LENGTH) {
    throw new Error("Code is too large");
  }

  try {
    new vm.Script(code);

    return {
      valid: true,
      language: "javascript",
      message: "JavaScript syntax is valid",
    };
  } catch (error) {
    return {
      valid: false,
      language: "javascript",
      error: error.message,
      message: "JavaScript contains a syntax error",
    };
  }
};

const formatJson = (json) => {
  if (!json || typeof json !== "string") {
    throw new Error("JSON text is required");
  }

  if (json.length > MAX_TEXT_LENGTH) {
    throw new Error("JSON text is too large");
  }

  try {
    const parsed = JSON.parse(json);

    return {
      valid: true,
      formatted: JSON.stringify(parsed, null, 2),
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
};

const encodeBase64 = (text) => {
  if (typeof text !== "string") {
    throw new Error("Text is required");
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error("Text is too large");
  }

  return {
    encoding: "base64",
    result: Buffer.from(text, "utf8").toString("base64"),
  };
};

const decodeBase64 = (text) => {
  if (!text || typeof text !== "string") {
    throw new Error("Base64 text is required");
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error("Base64 text is too large");
  }

  try {
    const normalized = text.replace(/\s/g, "");

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
      throw new Error("Invalid Base64 string");
    }

    const decoded = Buffer.from(normalized, "base64").toString(
      "utf8",
    );

    return {
      encoding: "utf8",
      result: decoded,
    };
  } catch (error) {
    throw new Error("Invalid Base64 string", { cause: error });
  }
};

const developerTool = async ({
  action,
  code,
  text,
}) => {
  if (!action || typeof action !== "string") {
    throw new Error("Developer tool action is required");
  }

  switch (action) {
    case "validate_javascript":
      return validateJavaScript(code);

    case "format_json":
      return formatJson(text);

    case "encode_base64":
      return encodeBase64(text);

    case "decode_base64":
      return decodeBase64(text);

    default:
      throw new Error(
        `Unsupported developer action: ${action}`,
      );
  }
};

export default developerTool;
