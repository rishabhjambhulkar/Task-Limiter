const express = require('express');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const fs = require('fs');
const cluster = require('cluster');
const os = require('os');
const axios = require('axios');

const numCPUs = os.cpus().length;
const redisClient = new Redis();

if (cluster.isMaster) {
    const workers = {};

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        const worker = cluster.fork();
        workers[worker.process.pid] = worker;
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        delete workers[worker.process.pid];

        // Optionally, restart the worker
        console.log('Restarting a new worker...');
        const newWorker = cluster.fork();
        workers[newWorker.process.pid] = newWorker;
    });

    // Function to monitor worker health
    const monitorWorkers = () => {
        setInterval(() => {
            Object.keys(workers).forEach(pid => {
                const worker = workers[pid];
                // Here you can implement a health check for each worker
                // For example, send a health check request to each worker and check the response
                axios.get(`http://localhost:3000/health-check`)
                    .then(() => {
                        console.log(`Worker ${pid} is healthy.`);
                    })
                    .catch(err => {
                        console.log(`Worker ${pid} failed health check.`);
                        worker.kill();
                    });
            });
        }, 10000); // Check every 10 seconds
    };

    monitorWorkers();
} else {
    const app = express();
    app.use(express.json());

    // Rate limiter setup
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

    // Task function
    const task = async (user_id) => {
        const logMessage = `${user_id}-task completed at-${new Date().toISOString()}`;
        console.log(logMessage);
        fs.appendFileSync('task.log', `${logMessage}\n`);
    };

    // Queue task function
    const queueTask = async (userId) => {
        const taskObj = { userId: userId };
        await redisClient.rpush(`taskQueue:${userId}`, JSON.stringify(taskObj));
    };

    // Process tasks function
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

// Route to handle tasks
app.post('/api/v1/task', async (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        // Attempt to consume points for both rate limiters
        await rateLimiter.consume(user_id); // per-minute rate limit
        await taskRateLimiter.consume(user_id); // per-second rate limit

        // Queue the task
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

        // Handle other errors
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message || 'An unexpected error occurred'
        });
    }
});



    // Health check route
    app.get('/health-check', (req, res) => {
        res.send('OK');
    });

    app.get('/api/v1/status/:userId', async (req, res) => {
        const userId = req.params.userId;
        const queueLength = await redisClient.llen(`taskQueue:${userId}`);

        res.json({
            userId,
            queueLength,
            tasksInLastSecond: 0,
            tasksInLastMinute: 0,
        });
    });

    app.get('/', (req, res) => {
        res.send('Server is running');
    });

    const startProcessingTasks = (userId) => {
        processTasks(userId).catch(console.error);
    };

    const users = ['123', '456'];
    users.forEach(userId => startProcessingTasks(userId));

    app.listen(3000, () => {
        console.log(`Worker ${process.pid} started`);
    });
}




// Function to check if the task is queued
const checkQueueStatus = async (userId) => {
    const queueLength = await redisClient.llen(`taskQueue:${userId}`);
    console.log(`Queue length for user ${userId}: ${queueLength}`);
};

// Function to send requests
const sendRequests = async (userId, numRequests) => {

    // Function to send a single request
    const sendRequest = async (i) => {
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
    };

    // Sending requests more frequently than allowed (e.g., more than 1 request per second)
    for (let i = 0; i < numRequests; i++) {
        sendRequest(i);
        if (i % 10 === 0) { // Check queue status every 10 requests
            await checkQueueStatus(userId);
        }
        // await new Promise(resolve => setTimeout(resolve, requestInterval)); // Delay to exceed rate limit
    }
};

// Example usage
sendRequests('123', 25); // Replace '12