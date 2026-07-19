import 'dotenv/config';
import prisma from '../config/prisma';
import redisClient from '../config/redis';

async function test() {
  console.log('Diagnostic start...');
  console.log('Connecting to Redis: ' + process.env.REDIS_URL);
  try {
    await redisClient.connect();
    console.log('Redis connected successfully!');
    await redisClient.set('test_key', 'test_val');
    const val = await redisClient.get('test_key');
    console.log('Redis test get/set: ' + val);
    await redisClient.disconnect();
  } catch (err: any) {
    console.error('Redis error:', err.message);
  }

  console.log('Connecting to PostgreSQL: ' + process.env.DATABASE_URL);
  try {
    const usersCount = await prisma.user.count();
    console.log('PostgreSQL connected successfully! Total users: ' + usersCount);
  } catch (err: any) {
    console.error('PostgreSQL error:', err.message);
  }
  console.log('Diagnostics complete.');
}

test().catch(console.error);
