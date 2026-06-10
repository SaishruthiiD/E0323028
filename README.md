# Campus Hiring Evaluation Microservices

This project consists of two microservices designed for a campus hiring evaluation:
1. **Vehicle Maintenance Scheduler** (located in `vehicle_scheduling` / `vehicle_maintence_scheduler`)
2. **Campus Notifications Microservice** (located in `notification_app_be`)

---

## 🛠️ Microservices Setup

### Prerequisites
- Node.js (v18+)
- Active internet connection (to fetch mock external data and logs)

### Environment Configuration
The root folder contains a `.env` file containing client registration keys and access tokens:
- `ACCESS_TOKEN`: Bearer token used for protected API routes.

Both microservices automatically load and update this `.env` file dynamically if the token expires, utilizing the self-healing auth systems implemented in `auth.js`.

---

## 🚀 How to Run the Services

### 1. Vehicle Maintenance Scheduler
Solves the scheduling optimization problem using the **0/1 Knapsack Dynamic Programming** algorithm.
- Exposes: `GET /schedule` (takes query param `?algo=knapsack` or `?algo=greedy`)
- Default port: `3001`

```bash
cd vehicle_scheduling
npm install
npm start
```
To test:
```bash
curl -s http://localhost:3001/schedule
```

### 2. Campus Notifications Microservice
Exposes REST API endpoints and implements a **Priority Inbox Algorithm** utilizing an $O(n \log 10)$ **Min Heap** data structure to retrieve the top 10 highest-priority unread alerts.
- Default port: `3002`

```bash
cd notification_app_be
npm install
npm start
```
To test:
```bash
curl -H "Authorization: Bearer <ACCESS_TOKEN>" http://localhost:3002/notifications/priority
```

---

## 📁 Repository Structure
- `logging_middleware/`: Reusable Logging Middleware library.
- `vehicle_scheduling/` / `vehicle_maintence_scheduler/`: Scheduler microservice.
- `notification_app_be/`: Campus Notifications microservice.
- `notification_system_design.md`: 6-stage architectural, DB, scale, and algorithm design document.
- `screenshots/`: Postman/terminal screenshots of endpoints output.
