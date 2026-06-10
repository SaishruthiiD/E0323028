import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getAuthToken } from "./auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function runTest() {
  console.log("=== STARTING FULL CAMPUS NOTIFICATIONS TEST ===");
  try {
    const token = await getAuthToken();
    console.log("Using Token:", token.substring(0, 20) + "...");

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };

    // 1. GET /notifications (initial fetch + sync)
    console.log("\n1. GET /notifications (Initial Fetch & Sync)...");
    const getRes1 = await axios.get("http://localhost:3002/notifications", { headers });
    console.log("Status:", getRes1.status);
    console.log("Total notifications count:", getRes1.data.notifications.length);
    if (getRes1.data.notifications.length > 0) {
      console.log("First item:", getRes1.data.notifications[0]);
    }

    // 2. GET /notifications/unread
    console.log("\n2. GET /notifications/unread...");
    const unreadRes = await axios.get("http://localhost:3002/notifications/unread", { headers });
    console.log("Status:", unreadRes.status);
    console.log("Unread count:", unreadRes.data.notifications.length);

    // 3. GET /notifications/priority (Priority Inbox with Min Heap)
    console.log("\n3. GET /notifications/priority (Top 10 Unread sorted by priority score)...");
    const priorityRes = await axios.get("http://localhost:3002/notifications/priority", { headers });
    console.log("Status:", priorityRes.status);
    console.log("Priority count:", priorityRes.data.count);
    priorityRes.data.notifications.forEach((item, index) => {
      console.log(`[#${index+1}] Score: ${item.score.toFixed(2)} | Type: ${item.type} | Msg: ${item.message.substring(0, 30)}... | Date: ${item.createdAt}`);
    });

    if (getRes1.data.notifications.length > 0) {
      const targetId = getRes1.data.notifications[0].id;

      // 4. GET /notifications/:id
      console.log(`\n4. GET /notifications/${targetId}...`);
      const singleRes = await axios.get(`http://localhost:3002/notifications/${targetId}`, { headers });
      console.log("Status:", singleRes.status);
      console.log("Notification details:", singleRes.data.notification);

      // 5. PATCH /notifications/:id/read
      console.log(`\n5. PATCH /notifications/${targetId}/read...`);
      const readRes = await axios.patch(`http://localhost:3002/notifications/${targetId}/read`, {}, { headers });
      console.log("Status:", readRes.status);
      console.log("Marked read response:", readRes.data);

      // 6. PATCH /notifications/:id/unread
      console.log(`\n6. PATCH /notifications/${targetId}/unread...`);
      const unreadPatchRes = await axios.patch(`http://localhost:3002/notifications/${targetId}/unread`, {}, { headers });
      console.log("Status:", unreadPatchRes.status);
      console.log("Marked unread response:", unreadPatchRes.data);

      // 7. DELETE /notifications/:id
      console.log(`\n7. DELETE /notifications/${targetId}...`);
      const deleteRes = await axios.delete(`http://localhost:3002/notifications/${targetId}`, { headers });
      console.log("Status:", deleteRes.status);
      console.log("Deleted response:", deleteRes.data);
    }

    // 8. POST /notifications (Admin Create validation)
    console.log("\n8. POST /notifications (Admin Create)...");
    const postRes = await axios.post("http://localhost:3002/notifications", {
      title: "Google Drive Access",
      type: "Event",
      message: "Please submit your resume via the updated google form before midnight."
    }, { headers });
    console.log("Status:", postRes.status);
    console.log("Created notification:", postRes.data.notification);

    // 9. POST /notifications/broadcast (Broadcast design validation)
    console.log("\n9. POST /notifications/broadcast (Multi-student broadcast)...");
    const broadcastRes = await axios.post("http://localhost:3002/notifications/broadcast", {
      studentIds: ["fe4318ef-5dae-407e-aaa8-625fdc8053b1", "fe4318ef-5dae-407e-aaa8-625fdc8053b2"],
      title: "Interview Result Out",
      type: "Result",
      message: "Congratulations! You have been selected for round 2."
    }, { headers });
    console.log("Status:", broadcastRes.status);
    console.log("Broadcasted success:", broadcastRes.data.message);
    console.log("Count:", broadcastRes.data.notificationsCount);

    console.log("\n=== CAMPUS NOTIFICATIONS TEST COMPLETED SUCCESSFULLY ===");
  } catch (error) {
    console.error("Test failed:", error.message);
    if (error.response) {
      console.error("Server error details:", error.response.data);
    }
  }
}

runTest();
