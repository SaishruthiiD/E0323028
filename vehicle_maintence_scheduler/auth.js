import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

let cachedToken = null;
let tokenExpiry = 0;

export async function getAuthToken() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  
  // If cached token is valid for at least 60 more seconds, use it
  if (cachedToken && tokenExpiry > nowSeconds + 60) {
    return cachedToken;
  }
  
  try {
    const payload = {
      clientID: "fe4318ef-5dae-407e-aaa8-625fdc8053b9",
      clientSecret: "rfwfTXqAbgBnEubY",
      email: "saishruthi.dd@gmail.com",
      name: "D Sai Shruthi",
      rollNo: "E0323028",
      accessCode: "DvwEDZ"
    };

    const response = await axios.post("http://4.224.186.213/evaluation-service/auth", payload, {
      headers: {
        "Content-Type": "application/json"
      }
    });

    const { access_token, expires_in } = response.data;
    cachedToken = access_token;
    tokenExpiry = expires_in;

    // Write token back to workspace root .env file so the logging middleware (and other runs) can read it
    const envPath = path.resolve(__dirname, "../.env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    }

    if (envContent.includes("ACCESS_TOKEN=")) {
      envContent = envContent.replace(/ACCESS_TOKEN=[^\r\n]*/, `ACCESS_TOKEN=${access_token}`);
    } else {
      envContent += `\nACCESS_TOKEN=${access_token}`;
    }

    fs.writeFileSync(envPath, envContent.trim() + "\n", "utf8");
    process.env.ACCESS_TOKEN = access_token;
    
    return access_token;
  } catch (error) {
    // Fail-safe: fall back to whatever is currently in environment
    const currentToken = process.env.ACCESS_TOKEN;
    if (currentToken) {
      return currentToken;
    }
    throw error;
  }
}
