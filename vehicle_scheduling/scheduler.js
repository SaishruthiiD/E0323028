import { logInfo } from "./loggerWrapper.js";

/**
 * Solves the vehicle scheduling problem using the exact 0/1 Knapsack Dynamic Programming algorithm.
 * Maximizes the total impact score such that total duration <= mechanicHours.
 * 
 * @param {number} depotId - The ID of the depot being processed
 * @param {number} mechanicHours - Available hours for the depot (Knapsack capacity)
 * @param {Array} vehicles - List of vehicles/tasks available ({ TaskID, Duration, Impact })
 */
export async function solveKnapsack(depotId, mechanicHours, vehicles) {
  await logInfo(`[Depot ${depotId}] Starting 0/1 Knapsack scheduling algorithm. Capacity: ${mechanicHours} hours, Tasks count: ${vehicles.length}`);
  
  const n = vehicles.length;
  // dp[i][w] represents the maximum impact using the first i items and capacity w
  const dp = Array.from({ length: n + 1 }, () => Array(mechanicHours + 1).fill(0));
  
  for (let i = 1; i <= n; i++) {
    const item = vehicles[i - 1];
    const weight = item.Duration;
    const value = item.Impact;
    for (let w = 0; w <= mechanicHours; w++) {
      if (weight <= w) {
        dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - weight] + value);
      } else {
        dp[i][w] = dp[i - 1][w];
      }
    }
  }
  
  // Traceback to find the selected items
  let w = mechanicHours;
  const selectedTasks = [];
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      const item = vehicles[i - 1];
      selectedTasks.push(item);
      w -= item.Duration;
    }
  }
  
  // Selected tasks are retrieved in reverse order due to traceback, so we reverse back
  selectedTasks.reverse();
  
  const totalImpact = dp[n][mechanicHours];
  const totalHoursUsed = mechanicHours - w;
  const selectedTaskIDs = selectedTasks.map(t => t.TaskID);
  
  await logInfo(`[Depot ${depotId}] Knapsack algorithm completed.`);
  await logInfo(`[Depot ${depotId}] Selected TaskIDs: ${JSON.stringify(selectedTaskIDs)}`);
  await logInfo(`[Depot ${depotId}] Total hours used: ${totalHoursUsed} / ${mechanicHours}`);
  await logInfo(`[Depot ${depotId}] Total impact score: ${totalImpact}`);
  
  return {
    depotId,
    mechanicHours,
    algorithm: "0/1 Knapsack",
    totalImpact,
    totalHoursUsed,
    selectedTaskIDs,
    selectedTasks
  };
}

/**
 * Solves the vehicle scheduling problem using the Greedy algorithm.
 * Sorts items by density (Impact/Duration ratio) and greedily packs them.
 * 
 * @param {number} depotId - The ID of the depot being processed
 * @param {number} mechanicHours - Available hours for the depot (Knapsack capacity)
 * @param {Array} vehicles - List of vehicles/tasks available ({ TaskID, Duration, Impact })
 */
export async function solveGreedy(depotId, mechanicHours, vehicles) {
  await logInfo(`[Depot ${depotId}] Starting Greedy (Impact/Duration ratio) scheduling algorithm. Capacity: ${mechanicHours} hours, Tasks count: ${vehicles.length}`);
  
  // Map and calculate density, sort by density in descending order
  const tasksWithDensity = vehicles.map(v => ({
    ...v,
    density: v.Impact / v.Duration
  }));
  
  // Sort by density descending. If density is equal, sort by duration ascending (smaller tasks first)
  tasksWithDensity.sort((a, b) => {
    if (b.density !== a.density) {
      return b.density - a.density;
    }
    return a.Duration - b.Duration;
  });
  
  let totalHoursUsed = 0;
  let totalImpact = 0;
  const selectedTasks = [];
  
  for (const task of tasksWithDensity) {
    if (totalHoursUsed + task.Duration <= mechanicHours) {
      selectedTasks.push(task);
      totalHoursUsed += task.Duration;
      totalImpact += task.Impact;
      await logInfo(`[Depot ${depotId}] Greedily selected Task ${task.TaskID} (Duration: ${task.Duration}, Impact: ${task.Impact}, Ratio: ${task.density.toFixed(2)})`);
    }
  }
  
  const selectedTaskIDs = selectedTasks.map(t => t.TaskID);
  
  await logInfo(`[Depot ${depotId}] Greedy algorithm completed.`);
  await logInfo(`[Depot ${depotId}] Selected TaskIDs: ${JSON.stringify(selectedTaskIDs)}`);
  await logInfo(`[Depot ${depotId}] Total hours used: ${totalHoursUsed} / ${mechanicHours}`);
  await logInfo(`[Depot ${depotId}] Total impact score: ${totalImpact}`);
  
  return {
    depotId,
    mechanicHours,
    algorithm: "Greedy (Ratio)",
    totalImpact,
    totalHoursUsed,
    selectedTaskIDs,
    selectedTasks
  };
}
