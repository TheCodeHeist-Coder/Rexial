import  {Redis} from 'ioredis';

const redisConfig = {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times: number) => Math.min(times * 100, 3000),

    autoResubscribe: true,
};


export const pub = new Redis(redisConfig);
export const sub = new Redis(redisConfig);
export const cache = new Redis(redisConfig);

pub.on('error', (e) => console.error('Redis Pub Error:', e));
sub.on('error', (e) => console.error('Redis Sub Error:', e));
cache.on('error', (e) => console.error('Redis Cache Error:', e));


export const sessionChannel = (sessionId: string) => `session:${sessionId}`;