/**
 * Safety constraints module (Section 16 of magents.md)
 * - File path validation (no path traversal)
 * - Prompt injection detection
 * - No dynamic tool registration
 */

const DANGEROUS_PROMPT_PATTERNS = [
  /ignore previous instructions/i,
  /forget your instructions/i,
  /you are now/i,
  /you must now/i,
  /system prompt/i,
  /\[INST\]/i,
  /<\|system\|>/i,
];

/**
 * Detects potential prompt injection attempts.
 */
export function detectPromptInjection(text: string): boolean {
  return DANGEROUS_PROMPT_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Validates that a file path is safe (no path traversal, must be within /workspace).
 */
export function validateFilePath(filePath: string): { valid: boolean; reason?: string } {
  if (!filePath) {
    return { valid: false, reason: "Path is empty" };
  }

  // Prevent path traversal
  if (filePath.includes("..")) {
    return { valid: false, reason: "Path traversal detected (..)" };
  }

  // Must be a relative path or within /workspace
  const absPath = filePath.startsWith("/") ? filePath : `/workspace/${filePath}`;
  if (!absPath.startsWith("/workspace")) {
    return { valid: false, reason: "Path must be within /workspace" };
  }

  // Prevent access to sensitive files
  const forbidden = ["/workspace/.git/config", "/etc", "/proc", "/sys", "/dev"];
  if (forbidden.some((f) => absPath.startsWith(f))) {
    return { valid: false, reason: "Access to forbidden path" };
  }

  return { valid: true };
}
