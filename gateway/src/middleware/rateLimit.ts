import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6375', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

console.log(`Connecting rate limiter to Redis at ${redisHost}:${redisPort}`);
const redis = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
});

redis.on('error', (err) => {
  console.error('Redis Rate Limiter Error:', err);
});

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const limit = 100; // Max requests per window
  const windowSeconds = 60; // 1 minute window

  // Dynamic key based on IP and current window interval
  const windowIndex = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rate_limit:${ip}:${windowIndex}`;

  try {
    const requests = await redis.incr(key);
    
    if (requests === 1) {
      await redis.expire(key, windowSeconds + 10); // buffer expire time slightly
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - requests));

    if (requests > limit) {
      console.warn(`Rate limit exceeded for IP: ${ip} on key: ${key}`);
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Max ${limit} requests per minute allowed.`,
        correlationId: req.correlationId,
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Rate limit error (fail-open):', error);
    next();
  }
}
export { redis };
