import { Log } from "../logging_middleware/logger.js";
import { getAuthToken } from "./auth.js";

const PACKAGE_NAME = "service"; // Must be "service" as defined by evaluation API validation rules

function truncateMessage(msg) {
  if (typeof msg !== "string") {
    msg = String(msg);
  }
  if (msg.length > 48) {
    return msg.substring(0, 45) + "...";
  }
  return msg;
}

export async function logInfo(message) {
  try {
    await getAuthToken();
  } catch (err) {
    // Ignore error
  }
  const truncated = truncateMessage(message);
  return Log("backend", "info", PACKAGE_NAME, truncated);
}

export async function logError(message) {
  try {
    await getAuthToken();
  } catch (err) {
    // Ignore error
  }
  const truncated = truncateMessage(message);
  return Log("backend", "error", PACKAGE_NAME, truncated);
}
