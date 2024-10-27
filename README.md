# Task Queue and Rate Limiting System

This Node.js application is designed to handle task processing with rate limiting, clustering, and a Redis-backed task queue. It ensures tasks are processed at a controlled rate, preventing overload and ensuring fair resource allocation.

## Features
- **Cluster Management**: Utilizes multiple CPU cores for efficient task handling.
- **Rate Limiting**: Prevents excessive task submission per user with both per-minute and per-second limits.
- **Task Queue**: Tasks exceeding rate limits are queued in Redis and processed asynchronously.
- **Worker Health Monitoring**: Regularly checks and maintains the health of worker processes.

## Prerequisites

- **Node.js** (version 14.x or higher recommended)
- **Redis** (for task queue and rate limiting storage)
- **npm** (Node Package Manager)

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-repo/task-queue-system.git
   cd task-queue-system
2. Open Terminal type this command to run the script:
  ```bash
   npm i
   node server.js 
   ```

#Project Overview

This Node.js project is a robust task-processing system designed to manage high volumes of tasks efficiently while ensuring fair resource allocation. It combines several key components—rate limiting, clustering, and a Redis-backed task queue—to handle requests in a controlled and scalable manner.

Here’s a breakdown of its main features:

1. **Cluster Management**:
   - The application utilizes Node.js’s clustering to scale across multiple CPU cores, maximizing processing power and handling high workloads more efficiently. Each CPU core runs an independent worker process, improving throughput by handling multiple tasks concurrently. 

2. **Rate Limiting**:
   - Rate limiting is enforced on a per-user basis to prevent system overload and ensure fair resource distribution. Users are restricted based on predefined limits per minute and per second. This ensures that no single user monopolizes resources, and the system can manage high volumes of requests from multiple users without degradation.

3. **Redis-Backed Task Queue**:
   - When users exceed their rate limits, additional tasks are not discarded but instead queued in Redis. Redis acts as a high-speed storage layer for these pending tasks, and they are processed asynchronously, ensuring that each task is eventually handled without overloading the system. Redis’s high-performance capabilities are ideal for managing the queue's state efficiently.

4. **Worker Health Monitoring**:
   - The system includes a monitoring mechanism that checks worker processes regularly. This ensures that workers remain active and healthy, enabling the application to manage any potential crashes or performance issues proactively. If a worker process fails or slows down, the system can respond to keep task processing running smoothly.

### Why This Design Matters:
- **Scalability**: The clustering approach makes it scalable across multiple cores, so it can handle more tasks without requiring new hardware.
- **Efficiency**: Rate limiting and Redis-backed queuing ensure that tasks are processed in a controlled manner, maintaining system stability.
- **Reliability**: Worker health checks help maintain uptime by managing worker process health proactively.

This setup is especially valuable in scenarios where predictable performance, fairness, and high availability are essential.
