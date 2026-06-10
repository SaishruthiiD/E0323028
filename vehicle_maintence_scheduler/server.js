import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { fetchDepots, fetchVehicles } from "./fetcher.js";
import { solveKnapsack, solveGreedy } from "./scheduler.js";
import { logInfo, logError } from "./loggerWrapper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Unique IDs for testing/routing identification
app.get("/", (req, res) => {
  res.json({
    service: "Vehicle Maintenance Scheduler",
    status: "healthy",
    endpoints: {
      schedule: "/schedule"
    }
  });
});

app.get("/schedule", async (req, res) => {
  const algoType = req.query.algo || "knapsack"; // default to knapsack as requested in latest prompt
  await logInfo(`Received scheduling request on /schedule. Algorithm parameter: ${algoType}`);

  try {
    // 1. Fetch data from endpoints
    const depots = await fetchDepots();
    const vehicles = await fetchVehicles();

    if (!depots || depots.length === 0) {
      const msg = "No depots fetched or depots list is empty.";
      await logError(msg);
      return res.status(500).json({ error: msg });
    }

    if (!vehicles || vehicles.length === 0) {
      const msg = "No vehicles/tasks fetched or vehicles list is empty.";
      await logError(msg);
      return res.status(500).json({ error: msg });
    }

    const results = [];

    // 2. Process each depot
    for (const depot of depots) {
      const depotId = depot.ID;
      const capacity = depot.MechanicHours;
      
      let depotResult;
      if (algoType.toLowerCase() === "greedy") {
        depotResult = await solveGreedy(depotId, capacity, vehicles);
      } else {
        depotResult = await solveKnapsack(depotId, capacity, vehicles);
      }
      
      results.push(depotResult);
    }

    await logInfo("Successfully processed scheduling for all depots.");
    
    // Return final result json
    res.json({
      success: true,
      algorithmUsed: algoType.toLowerCase() === "greedy" ? "Greedy (Ratio)" : "0/1 Knapsack (DP)",
      resultsCount: results.length,
      depots: results
    });

  } catch (error) {
    const errorMsg = `Server scheduling error: ${error.message}`;
    await logError(errorMsg);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logError(`Unhandled server error: ${err.message}`).then(() => {
    res.status(500).json({ error: "Internal server error" });
  });
});

app.listen(PORT, async () => {
  await logInfo(`Vehicle Maintenance Scheduler microservice started on port ${PORT}`);
});
