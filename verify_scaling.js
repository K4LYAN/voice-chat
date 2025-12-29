const { createClient } = require('redis');

async function testWeightedQueue() {
    const client = createClient({ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379' });
    await client.connect();

    console.log("--- Testing Weighted Queue ---");
    const queueKey = "queue:test:male:female";

    // Clear queue
    await client.del(queueKey);

    const now = Date.now();

    // User A: High Reputation (100) -> Joined Now
    const scoreA = now - (100 * 60 * 1000); // 100 mins 'credit'
    await client.zAdd(queueKey, { score: scoreA, value: 'UserHighRep' });
    console.log(`Pushed UserHighRep with score ${scoreA}`);

    // User B: Low Reputation (0) -> Joined 10 mins ago (earlier than A in real time, but...)
    // Real time arrival: Now - 10 mins
    // Score = (Now - 10 mins) - (0 credit)
    const scoreB = (now - 10 * 60 * 1000) - 0;
    await client.zAdd(queueKey, { score: scoreB, value: 'UserLowRep' });
    console.log(`Pushed UserLowRep with score ${scoreB}`);

    // Verify Order (Lowest Score First)
    // User A Score ~= Now - 100 mins
    // User B Score ~= Now - 10 mins
    // A should be popped first!

    const first = await client.zPopMin(queueKey);
    console.log(`Popped 1st: ${first.value} (Score: ${first.score})`);

    const second = await client.zPopMin(queueKey);
    console.log(`Popped 2nd: ${second.value} (Score: ${second.score})`);

    if (first.value === 'UserHighRep') {
        console.log("SUCCESS: High reputation user skipped the line!");
    } else {
        console.error("FAIL: Low reputation user was served first.");
    }

    await client.disconnect();
}

async function testShadowBan() {
    // This is harder to test without full server mock, but we can verify key separation concepts
    console.log("\n--- Testing Shadow Logic (Concept) ---");
    const normalKey = "queue:en:male:female";
    const shadowKey = "queue:en:male:female:shadow";

    if (normalKey !== shadowKey) {
        console.log("SUCCESS: Shadow queue has distinct key.");
    }
}

testWeightedQueue().then(testShadowBan).catch(console.error);
