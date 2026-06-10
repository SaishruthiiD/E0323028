import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { logInfo, logError } from "./loggerWrapper.js";
import { getAuthToken } from "./auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from workspace root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASE_URL = "http://4.224.186.213/evaluation-service";

export async function fetchDepots() {
  await logInfo("Initiating API call to fetch depots...");
  try {
    const token = await getAuthToken();
    const response = await axios.get(`${BASE_URL}/depots`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    const depotsCount = response.data.depots ? response.data.depots.length : 0;
    await logInfo(`Successfully fetched depots. Count: ${depotsCount}`);
    return response.data.depots || [];
  } catch (error) {
    const errMessage = `Error fetching depots: ${error.message}`;
    await logError(errMessage.substring(0, 48));
    throw error;
  }
}

export async function fetchVehicles() {
  await logInfo("Initiating API call to fetch vehicles...");
  try {
    const token = await getAuthToken();
    const response = await axios.get(`${BASE_URL}/vehicles`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    const vehiclesCount = response.data.vehicles ? response.data.vehicles.length : 0;
    await logInfo(`Successfully fetched vehicles. Count: ${vehiclesCount}`);
    return response.data.vehicles || [];
  } catch (error) {
    const errMessage = `Error fetching vehicles: ${error.message}`;
    await logError(errMessage.substring(0, 48));
    throw error;
  }
}
