const mongoose = require("mongoose");
const { loadEnv } = require("../src/config/env");
const { getRedisClient } = require("../src/services/redisClient");
const Url = require("../src/models/url");
const Click = require("../src/models/click");

async function seed() {
  const env = loadEnv(process.env);
  const redisClient = getRedisClient(env.REDIS_URL);

  console.log("⚠️  WARNING: This will DELETE ALL existing data in 'urls' and 'clicks' collections, and clear analytics cache in Redis.");
  
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    // Clear MongoDB collections
    await Url.deleteMany({});
    await Click.deleteMany({});
    console.log("Cleared 'urls' and 'clicks' collections.");

    // Clear Redis cache
    const keys = await redisClient.keys("analytics:*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log(`Cleared ${keys.length} analytics cache keys from Redis.`);
    } else {
      console.log("No analytics cache keys found in Redis.");
    }

    const sampleUrls = [
      { slug: "google-demo", originalUrl: "https://google.com", weight: 1.0 },
      { slug: "github-opencode", originalUrl: "https://github.com/anomalyco/opencode", weight: 0.8 },
      { slug: "nodejs-docs", originalUrl: "https://nodejs.org/docs", weight: 0.4 },
      { slug: "mongodb-atlas", originalUrl: "https://www.mongodb.com/cloud/atlas", weight: 0.6 },
      { slug: "redis-io", originalUrl: "https://redis.io", weight: 0.3 },
      { slug: "expressjs-com", originalUrl: "https://expressjs.com", weight: 0.5 },
      { slug: "medium-blog", originalUrl: "https://medium.com/@sample/blog-post", weight: 0.7 },
      { slug: "twitter-profile", originalUrl: "https://twitter.com/sampleuser", weight: 0.9 },
      { slug: "linkedin-profile", originalUrl: "https://linkedin.com/in/sampleuser", weight: 0.2 },
      { slug: "newsletter-link", originalUrl: "https://example.com/newsletter-promo", weight: 0.1 },
    ];

    const referrers = ["google.com", "twitter.com", "facebook.com", "linkedin.com", "t.co", "direct"];
    const countries = ["US", "GB", "DE", "FR", "IN", "CA", "JP", "AU", "BR", "CN"];
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    ];

    let totalClicksGenerated = 0;
    const createdUrls = [];

    for (const { slug, originalUrl, weight } of sampleUrls) {
      const urlDoc = await Url.create({
        slug,
        originalUrl,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)),
      });

      const clicksForUrl = [];
      const daysToSeed = 30;
      const now = new Date();

      for (let i = 0; i < daysToSeed; i++) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);

        // Variance in daily clicks: weight * random * spike factor
        const spike = Math.random() > 0.9 ? 5 : 1;
        const dailyCount = Math.floor(Math.random() * 20 * weight * spike);

        for (let j = 0; j < dailyCount; j++) {
          clicksForUrl.push({
            slug,
            timestamp: new Date(date.getTime() + Math.random() * 24 * 60 * 60 * 1000),
            ipHash: `hash_${Math.random().toString(36).substring(2, 15)}`,
            userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
            referrer: referrers[Math.floor(Math.random() * referrers.length)],
            country: countries[Math.floor(Math.random() * countries.length)],
          });
        }
      }

      await Click.insertMany(clicksForUrl);
      
      const clickCount = clicksForUrl.length;
      await Url.updateOne({ _id: urlDoc._id }, { totalClicks: clickCount });
      
      totalClicksGenerated += clickCount;
      createdUrls.push({ slug, clickCount });
    }

    console.log("\n✅ Seeding completed successfully!");
    console.log("--------------------------------------------------");
    console.log(`URLs created: ${createdUrls.length}`);
    createdUrls.forEach(u => console.log(`- ${u.slug}: ${u.clickCount} clicks`));
    console.log(`Total clicks generated: ${totalClicksGenerated}`);
    console.log("--------------------------------------------------");
    console.log("Reminder: run 'npm run dev' and open the dashboard to view the data.");

  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    await redisClient.quit();
  }
}

seed();
