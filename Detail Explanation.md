## Documentation for Rate-Limited Task Queue Implementation

### Overview
This implementation is designed to manage task processing in a distributed environment using clustering, rate-limiting, and a task queue system backed by Redis. It ensures that tasks submitted by users are processed at a controlled rate, preventing overload, and ensuring fairness.

### Components
1. **Cluster Management**: Utilizes Node.js's clustering module to spawn multiple worker processes, each handling incoming requests independently.
2. **Rate Limiting**: Implemented using `rate-limiter-flexible` and Redis to limit the rate of tasks each user can submit, both per minute and per second.
3. **Task Queue**: Tasks that exceed the rate limit are queued in Redis and processed asynchronously to ensure they are eventually completed.
4. **Health Monitoring**: The health of each worker is periodically checked to ensure system stability.

### Detailed Explanation

#### 1. Cluster Management
- **Purpose**: Distribute incoming requests across multiple CPU cores to maximize performance.
- **Implementation**: 
  - The master process forks a number of worker processes equal to the number of available CPU cores.
  - If a worker dies, the master logs this event and restarts a new worker to replace the failed one.
  - Worker health is monitored by periodically sending HTTP requests to each worker's health check endpoint.

```javascript
if (cluster.isMaster) {
    const workers = {};

    for (let i = 0; i < numCPUs; i++) {
        const worker = cluster.fork();
        workers[worker.process.pid] = worker;
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        delete workers[worker.process.pid];
        const newWorker = cluster.fork();
        workers[newWorker.process.pid] = newWorker;
    });

    const monitorWorkers = () => {
        setInterval(() => {
            Object.keys(workers).forEach(pid => {
                axios.get(`http://localhost:3000/health-check`)
                    .then(() => {
                        console.log(`Worker ${pid} is healthy.`);
                    })
                    .catch(err => {
                        console.log(`Worker ${pid} failed health check.`);
                        workers[pid].kill();
                    });
            });
        }, 10000); // Check every 10 seconds
    };

    monitorWorkers();
}
```

#### 2. Rate Limiting
- **Purpose**: Prevent a single user from overwhelming the system by limiting the rate at which tasks can be submitted.
- **Implementation**:
  - **Per-Minute Limit**: Each user can submit up to 20 tasks per minute.
  - **Per-Second Limit**: Each user can submit up to 1 task per second.
  - If a rate limit is exceeded, the task is queued instead of being processed immediately.

```javascript
const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    points: 20, // 20 tasks per minute
    duration: 60,
});

const taskRateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    points: 1, // 1 task per second
    duration: 1,
});
```

#### 3. Task Queue
- **Purpose**: Manage tasks that cannot be processed immediately due to rate limits.
- **Implementation**:
  - Tasks are queued in Redis when rate limits are exceeded.
  - Worker processes dequeue and execute tasks asynchronously.
  - Tasks are logged after completion.

```javascript
const queueTask = async (userId) => {
    const taskObj = { userId: userId };
    await redisClient.rpush(`taskQueue:${userId}`, JSON.stringify(taskObj));
};

const processTasks = async (userId) => {
    while (true) {
        try {
            const taskStr = await redisClient.lpop(`taskQueue:${userId}`);
            if (taskStr) {
                const parsedTask = JSON.parse(taskStr);
                await task(parsedTask.userId);
            } else {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error('Error processing task:', error);
        }
    }
};
```

#### 4. Health Monitoring
- **Purpose**: Ensure that each worker process is functioning correctly and capable of handling requests.
- **Implementation**:
  - A simple health check endpoint (`/health-check`) is used to monitor the status of each worker.
  - If a worker fails the health check, it is killed and a new worker is spawned.

```javascript
app.get('/health-check', (req, res) => {
    res.send('OK');
});
```

#### 5. Task Handling Route
- **Purpose**: Handle incoming task requests, apply rate limiting, and queue tasks if necessary.
- **Implementation**:
  - Tasks are processed immediately if within the rate limits.
  - If rate limits are exceeded, tasks are queued and processed later.
  - Appropriate HTTP status codes and messages are returned based on the outcome.

```javascript
app.post('/api/v1/task', async (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        await rateLimiter.consume(user_id); // per-minute rate limit
        await taskRateLimiter.consume(user_id); // per-second rate limit
        await queueTask(user_id);
        res.status(200).json({ message: 'Task queued' });

    } catch (error) {
        let errorMessage = 'Rate limit exceeded. Task has been queued.';
        let isRateLimited = false;

        if (error && error.remainingPoints !== undefined) {
            if (error.msBeforeNext > 0) {
                isRateLimited = true;
            }

            if (isRateLimited) {
                console.log(`Task for user ${user_id} has been rate-limited and queued.`);
                await queueTask(user_id);
                return res.status(429).json({ error: errorMessage });
            }
        }

        return res.status(500).json({
            error: 'Internal server error',
            details: error.message || 'An unexpected error occurred'
        });
    }
});
```

### Example Usage
To test the implementation, you can simulate task requests using the `sendRequests` function. This function sends a specified number of requests, exceeding the rate limit to ensure tasks are queued.

```javascript
const sendRequests = async (userId, numRequests) => {
    for (let i = 0; i < numRequests; i++) {
        try {
            const response = await axios.post('http://localhost:3000/api/v1/task', { user_id: userId });
            console.log(`Request ${i + 1}:`, response.data);
        } catch (error) {
            if (error.response) {
                console.log(`Request ${i + 1} failed:`, error.response.data);
            } else {
                console.log(`Request ${i + 1} failed:`, error.message);
            }
        }
    }
};

// Example usage
sendRequests('123', 25);
```

### Conclusion
This implementation provides a robust system for handling tasks in a distributed environment. It ensures fair usage through rate limiting, provides resilience through clustering, and ensures tasks are eventually processed even under high load.
