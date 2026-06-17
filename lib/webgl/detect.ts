/**
 * Client-only WebGL feature detect for the auth hero. A caveat-only context
 * (software rasterizer / SwiftShader) is treated as "none": a janky software-3D
 * backdrop on a login screen is worse than a crisp static one. The detached
 * canvas never enters the DOM.
 */
export function getWebGLTier(): "webgl2" | "webgl1" | "none" {
  if (typeof window === "undefined") return "none";
  try {
    const c = document.createElement("canvas");
    const strict: WebGLContextAttributes = { failIfMajorPerformanceCaveat: true };
    if (c.getContext("webgl2", strict)) return "webgl2";
    if (c.getContext("webgl", strict)) return "webgl1";
    return "none";
  } catch {
    return "none";
  }
}
