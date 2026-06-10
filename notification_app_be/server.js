import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import { getAuthToken } from "./auth.js";
import { logInfo, logError } from "./loggerWrapper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = process.env.NOTIFICATION_PORT || 3002;

app.use(express.json());

// MongoDB Connection Configuration
const MONGODB_URI = "mongodb+srv://e0323028_db_user:bFbyzugn3HBh8WMO@cluster0.lbnl0cs.mongodb.net/notification_db?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000 // 5s timeout to trigger fail-safe mode quickly
})
  .then(() => logInfo("Connected to MongoDB Atlas successfully."))
  .catch(() => logError("Atlas DB connection failed. Fail-safe mode enabled."));

// Notification Schema (Matching JSON Contract)
const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  type: { type: String, enum: ["Placement", "Result", "Event"], required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, required: true },
  isRead: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false } // Soft delete flag
});

const Notification = mongoose.model("Notification", notificationSchema);

// In-Memory Storage Fallback for Whitelist/Network connection issues
let inMemoryNotifications = [];

// Helper to serialize schema objects
function serializeNotification(n) {
  return {
    id: n.id,
    studentId: n.studentId,
    type: n.type,
    message: n.message,
    createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : new Date(n.createdAt).toISOString(),
    isRead: n.isRead
  };
}

// Decodes standard JWT tokens (base64)
function decodeJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], "base64").toString());
  } catch (e) {
    return null;
  }
}

// Authentication Middleware
async function authenticate(req, res, next) {
  await logInfo("API request received");
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token;
  }
  
  if (!token) {
    await logError("Error occurred: Token missing");
    return res.status(401).json({ success: false, error: "Unauthorized: Token missing" });
  }
  
  const claims = decodeJWT(token);
  if (!claims) {
    await logError("Error occurred: Invalid token format");
    return res.status(401).json({ success: false, error: "Unauthorized: Invalid token format" });
  }
  
  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = claims.exp || (claims.MapClaims && claims.MapClaims.exp);
  if (exp && exp < nowSeconds) {
    await logError("Error occurred: Token expired");
    return res.status(401).json({ success: false, error: "Unauthorized: Token expired" });
  }
  
  const email = claims.email || (claims.MapClaims && claims.MapClaims.email);
  const rollNo = claims.rollNo || (claims.MapClaims && claims.MapClaims.rollNo);
  if (rollNo !== "e0323028" && email !== "saishruthi.dd@gmail.com") {
    await logError("Error occurred: Credentials mismatch");
    return res.status(401).json({ success: false, error: "Unauthorized: Credential mismatch" });
  }
  
  req.studentId = claims.sub || (claims.MapClaims && claims.MapClaims.sub) || "fe4318ef-5dae-407e-aaa8-625fdc8053b9";
  next();
}

// Sync with External Notifications API
async function syncNotifications(studentId) {
  await logInfo("Notification fetch started");
  try {
    const token = await getAuthToken();
    const response = await axios.get("http://4.224.186.213/evaluation-service/notifications", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const externalNotifications = response.data.notifications || [];
    await logInfo("Notification fetch completed");

    // Reconcile and save notifications that do not exist locally
    for (const item of externalNotifications) {
      const mappedId = item.ID;
      const mappedType = item.Type || "Event";
      const mappedMsg = item.Message || "";
      const mappedTime = new Date(item.Timestamp || Date.now());

      if (mongoose.connection.readyState === 1) {
        // DB Sync
        const exists = await Notification.findOne({ id: mappedId });
        if (!exists) {
          const newDoc = new Notification({
            id: mappedId,
            studentId: studentId,
            type: mappedType,
            message: mappedMsg,
            createdAt: mappedTime,
            isRead: false
          });
          await newDoc.save();
        }
      } else {
        // In-Memory Sync
        const exists = inMemoryNotifications.find(n => n.id === mappedId);
        if (!exists) {
          inMemoryNotifications.push({
            id: mappedId,
            studentId: studentId,
            type: mappedType,
            message: mappedMsg,
            createdAt: mappedTime,
            isRead: false,
            isDeleted: false
          });
        }
      }
    }
  } catch (error) {
    await logError(`Error occurred: Fetch sync failed: ${error.message}`);
    // Non-blocking fallback: let the application serve current local database/in-memory data
  }
}

// Min Heap implementation for Priority Inbox Algorithm
class MinHeap {
  constructor() {
    this.heap = [];
  }

  getParentIndex(i) { return Math.floor((i - 1) / 2); }
  getLeftChildIndex(i) { return 2 * i + 1; }
  getRightChildIndex(i) { return 2 * i + 2; }

  swap(i, j) {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }

  insert(val) {
    this.heap.push(val);
    this.heapifyUp();
  }

  heapifyUp() {
    let index = this.heap.length - 1;
    while (index > 0 && this.heap[index].score < this.heap[this.getParentIndex(index)].score) {
      this.swap(index, this.getParentIndex(index));
      index = this.getParentIndex(index);
    }
  }

  peek() {
    return this.heap[0] || null;
  }

  extractMin() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();
    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.heapifyDown();
    return min;
  }

  heapifyDown() {
    let index = 0;
    while (this.getLeftChildIndex(index) < this.heap.length) {
      let smallerChildIndex = this.getLeftChildIndex(index);
      const rightChildIndex = this.getRightChildIndex(index);
      
      if (rightChildIndex < this.heap.length && this.heap[rightChildIndex].score < this.heap[smallerChildIndex].score) {
        smallerChildIndex = rightChildIndex;
      }

      if (this.heap[index].score <= this.heap[smallerChildIndex].score) {
        break;
      }

      this.swap(index, smallerChildIndex);
      index = smallerChildIndex;
    }
  }

  size() {
    return this.heap.length;
  }
  
  toArraySorted() {
    const sorted = [];
    const tempHeap = new MinHeap();
    tempHeap.heap = [...this.heap];
    while (tempHeap.size() > 0) {
      sorted.push(tempHeap.extractMin());
    }
    return sorted.reverse(); // Return highest scores first
  }
}

// Calculate priority score: Score = (Weight * 24) + hours_since_epoch
// Placement = 3, Result = 2, Event = 1
function calculatePriorityScore(type, createdAt) {
  let weight = 1;
  if (type === "Placement") weight = 3;
  else if (type === "Result") weight = 2;
  
  const createdTimeMs = new Date(createdAt).getTime();
  const timeHours = createdTimeMs / (1000 * 60 * 60);
  return (weight * 24) + timeHours;
}

// REST ENDPOINTS

// GET /notifications (list all notifications, read + unread, non-deleted)
app.get("/notifications", authenticate, async (req, res) => {
  try {
    await syncNotifications(req.studentId);
    let list = [];
    if (mongoose.connection.readyState === 1) {
      list = await Notification.find({ isDeleted: false }).sort({ createdAt: -1 });
    } else {
      list = inMemoryNotifications.filter(n => !n.isDeleted).sort((a, b) => b.createdAt - a.createdAt);
    }
    
    await logInfo("API response generated");
    res.json({
      success: true,
      notifications: list.map(serializeNotification)
    });
  } catch (error) {
    await logError(`Error occurred: ${error.message}`);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// GET /notifications/unread (list all unread notifications)
app.get("/notifications/unread", authenticate, async (req, res) => {
  try {
    await syncNotifications(req.studentId);
    let list = [];
    if (mongoose.connection.readyState === 1) {
      list = await Notification.find({ isRead: false, isDeleted: false }).sort({ createdAt: -1 });
    } else {
      list = inMemoryNotifications.filter(n => !n.isRead && !n.isDeleted).sort((a, b) => b.createdAt - a.createdAt);
    }
    
    await logInfo("API response generated");
    res.json({
      success: true,
      notifications: list.map(serializeNotification)
    });
  } catch (error) {
    await logError(`Error occurred: ${error.message}`);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// GET /notifications/priority (gets top 10 unread notifications via Min Heap)
app.get("/notifications/priority", authenticate, async (req, res) => {
  await logInfo("Priority calculation started");
  try {
    await syncNotifications(req.studentId);
    
    let list = [];
    if (mongoose.connection.readyState === 1) {
      list = await Notification.find({ isRead: false, isDeleted: false });
    } else {
      list = inMemoryNotifications.filter(n => !n.isRead && !n.isDeleted);
    }
    
    const minHeap = new MinHeap();
    
    for (const item of list) {
      const score = calculatePriorityScore(item.type, item.createdAt);
      const node = {
        score,
        notification: serializeNotification(item)
      };
      
      if (minHeap.size() < 10) {
        minHeap.insert(node);
      } else if (score > minHeap.peek().score) {
        minHeap.extractMin();
        minHeap.insert(node);
      }
    }
    
    const results = minHeap.toArraySorted().map(node => ({
      score: node.score,
      ...node.notification
    }));
    
    await logInfo("Priority calculation completed");
    await logInfo("API response generated");
    
    res.json({
      success: true,
      count: results.length,
      notifications: results
    });
  } catch (error) {
    await logError(`Error occurred: ${error.message}`);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// GET /notifications/:id (get single notification details)
app.get("/notifications/:id", authenticate, async (req, res) => {
  const id = req.params.id;
  try {
    let doc = null;
    if (mongoose.connection.readyState === 1) {
      doc = await Notification.findOne({ id, isDeleted: false });
    } else {
      doc = inMemoryNotifications.find(n => n.id === id && !n.isDeleted);
    }
    
    if (!doc) {
      await logError(`Error occurred: Notification ${id} not found`);
      return res.status(404).json({ success: false, error: "Notification not found" });
    }
    
    await logInfo("API response generated");
    res.json({
      success: true,
      notification: serializeNotification(doc)
    });
  } catch (error) {
    await logError(`Error occurred: ${error.message}`);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// PATCH /notifications/:id/read (mark as read)
app.patch("/notifications/:id/read", authenticate, async (req, res) => {
  const id = req.params.id;
  try {
    let doc = null;
    if (mongoose.connection.readyState === 1) {
      doc = await Notification.findOneAndUpdate(
        { id, isDeleted: false },
        { isRead: true },
        { new: true }
      );
    } else {
      doc = inMemoryNotifications.find(n => n.id === id && !n.isDeleted);
      if (doc) doc.isRead = true;
    }
    
    if (!doc) {
      await logError(`Error occurred: Notification ${id} not found`);
      return res.status(404).json({ success: false, error: "Notification not found" });
    }
    
    await logInfo("API response generated");
    res.json({
      success: true,
      message: "Notification marked read successfully",
      notification: serializeNotification(doc)
    });
  } catch (error) {
    await logError(`Error occurred: ${error.message}`);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// PATCH /notifications/:id/unread (mark as unread)
app.patch("/notifications/:id/unread", authenticate, async (req, res) => {
  const id = req.params.id;
  try {
    let doc = null;
    if (mongoose.connection.readyState === 1) {
      doc = await Notification.findOneAndUpdate(
        { id, isDeleted: false },
        { isRead: false },
        { new: true }
      );
    } else {
      doc = inMemoryNotifications.find(n => n.id === id && !n.isDeleted);
      if (doc) doc.isRead = false;
    }
    
    if (!doc) {
      await logError(`Error occurred: Notification ${id} not found`);
      return res.status(404).json({ success: false, error: "Notification not found" });
    }
    
    await logInfo("API response generated");
    res.json({
      success: true,
      message: "Notification marked unread successfully",
      notification: serializeNotification(doc)
    });
  } catch (error) {
    await logError(`Error occurred: ${error.message}`);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// DELETE /notifications/:id (soft delete a notification)
app.delete("/notifications/:id", authenticate, async (req, res) => {
  const id = req.params.id;
  try {
    let doc = null;
    if (mongoose.connection.readyState === 1) {
      doc = await Notification.findOneAndUpdate(
        { id, isDeleted: false },
        { isDeleted: true },
        { new: true }
      );
    } else {
      doc = inMemoryNotifications.find(n => n.id === id && !n.isDeleted);
      if (doc) doc.isDeleted = true;
    }
    
    if (!doc) {
      await logError(`Error occurred: Notification ${id} not found`);
      return res.status(404).json({ success: false, error: "Notification not found" });
    }
    
    await logInfo("API response generated");
    res.json({
      success: true,
      message: "Notification deleted successfully",
      id: id
    });
  } catch (error) {
    await logError(`Error occurred: ${error.message}`);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// POST /notifications (create - for admin design validation)
app.post("/notifications", authenticate, async (req, res) => {
  const { title, type, message } = req.body;
  if (!title || !type || !message) {
    await logError("Error occurred: Missing fields");
    return res.status(400).json({ success: false, error: "Bad Request: title, type and message are required" });
  }

  try {
    const rawObj = {
      id: new mongoose.Types.ObjectId().toString(),
      studentId: req.studentId,
      type,
      message: `${title}: ${message}`,
      createdAt: new Date(),
      isRead: false
    };

    if (mongoose.connection.readyState === 1) {
      const doc = new Notification(rawObj);
      await doc.save();
    } else {
      inMemoryNotifications.push({ ...rawObj, isDeleted: false });
    }
    
    await logInfo("API response generated");
    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      notification: serializeNotification(rawObj)
    });
  } catch (error) {
    await logError(`Error occurred: ${error.message}`);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// POST /notifications/broadcast (send notification to multiple students - mock design validation)
app.post("/notifications/broadcast", authenticate, async (req, res) => {
  const { studentIds, title, type, message } = req.body;
  if (!studentIds || !Array.isArray(studentIds) || !title || !type || !message) {
    await logError("Error occurred: Missing fields");
    return res.status(400).json({ success: false, error: "Bad Request: studentIds, title, type and message are required" });
  }

  try {
    const createdNotifications = [];
    for (const sid of studentIds) {
      const rawObj = {
        id: new mongoose.Types.ObjectId().toString(),
        studentId: sid,
        type,
        message: `${title}: ${message}`,
        createdAt: new Date(),
        isRead: false
      };
      
      if (mongoose.connection.readyState === 1) {
        const doc = new Notification(rawObj);
        await doc.save();
      } else {
        inMemoryNotifications.push({ ...rawObj, isDeleted: false });
      }
      createdNotifications.push(serializeNotification(rawObj));
    }
    
    await logInfo("API response generated");
    res.json({
      success: true,
      message: `Successfully broadcasted notification to ${studentIds.length} students`,
      notificationsCount: createdNotifications.length,
      notifications: createdNotifications
    });
  } catch (error) {
    await logError(`Error occurred: ${error.message}`);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.use((err, req, res, next) => {
  logError(`Error occurred: ${err.message}`).then(() => {
    res.status(500).json({ success: false, error: "Internal server error" });
  });
});

app.listen(PORT, async () => {
  await logInfo(`Campus Notifications microservice started on port ${PORT}`);
});
