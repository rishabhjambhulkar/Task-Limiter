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

