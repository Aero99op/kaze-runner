require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

/* ------------------------------------------------------------
   1) Validate required environment variables on startup
------------------------------------------------------------- */
const REQUIRED_ENV = ["INFURA_SEPOLIA_URL", "REWARD_WALLET_PRIVATE_KEY"];
const missing = REQUIRED_ENV.filter(
  (key) =>
    !process.env[key] ||
    process.env[key].includes("YOUR_") ||
    process.env[key] === "your_private_key_here"
);

if (missing.length > 0) {
  console.error("\n❌ Missing/placeholder environment variables in .env:");
  missing.forEach((key) => console.error(`   - ${key}`));
  console.error("\nCopy .env.example to .env and fill in real values before starting the server.\n");
  process.exit(1);
}

const REWARD_AMOUNT_ETH = process.env.REWARD_AMOUNT_ETH || "0.01";
const COIN_REWARD_RATE = process.env.COIN_REWARD_RATE || "0.0001";
const REWARD_COOLDOWN_HOURS = Number(process.env.REWARD_COOLDOWN_HOURS || 24);
const REWARD_COOLDOWN_MS = REWARD_COOLDOWN_HOURS * 60 * 60 * 1000;
const PORT = process.env.PORT || 3000;

/* ------------------------------------------------------------
   2) Provider + wallet, using Infura/RPC as the endpoint
------------------------------------------------------------- */
const provider = new ethers.JsonRpcProvider(process.env.INFURA_SEPOLIA_URL, undefined, {
  staticNetwork: true,
});
const rewardWallet = new ethers.Wallet(process.env.REWARD_WALLET_PRIVATE_KEY, provider);

/* ------------------------------------------------------------
   2b) Retry wrapper for Infura/RPC calls
------------------------------------------------------------- */
async function withRetry(fn, { retries = 3, baseDelayMs = 1000, label = "request" } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();    } catch (err) {
      lastErr = err;
      const isRateLimited =
        err?.code === "BAD_DATA" &&
        (JSON.stringify(err?.value || "").includes("-32005") ||
          JSON.stringify(err?.value || "").includes("Too Many Requests"));
      if (!isRateLimited || attempt === retries) {
        throw err;
      }
      const delay = baseDelayMs * attempt; // 1s, 2s, 3s...
      console.warn(`${label}: rate limited by Infura, retrying in ${delay}ms (attempt ${attempt}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

/* ------------------------------------------------------------
   3) Simple JSON-file cooldown store
------------------------------------------------------------- */
const COOLDOWN_FILE = path.join(__dirname, "cooldowns.json");

function loadCooldowns() {
  try {
    return JSON.parse(fs.readFileSync(COOLDOWN_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveCooldowns(data) {
  fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(data, null, 2));
}

/* ------------------------------------------------------------
   4) POST /reward
------------------------------------------------------------- */
app.post("/reward", async (req, res) => {
  const { address, coins } = req.body;

  if (!address || !ethers.isAddress(address)) {
    return res.status(400).json({ error: "A valid 'address' is required." });
  }

  const normalized = ethers.getAddress(address); // checksum form, used as the key

  // --- Calculate reward amount ---
  let rewardEthStr = REWARD_AMOUNT_ETH;
  if (coins !== undefined) {
    const coinsNum = Number(coins);
    if (isNaN(coinsNum) || coinsNum <= 0) {
      return res.status(400).json({ error: "Coins must be a number greater than 0." });
    }
    // Calculate custom reward: coins * conversion rate
    const calculatedReward = coinsNum * Number(COIN_REWARD_RATE);
    // Format to 6 decimal places to prevent float precision issues in parseEther
    rewardEthStr = calculatedReward.toFixed(6);
  }

  // --- Cooldown check ---
  const cooldowns = loadCooldowns();
  const lastClaim = cooldowns[normalized];
  const now = Date.now();

  if (lastClaim && now - lastClaim < REWARD_COOLDOWN_MS) {
    const msRemaining = REWARD_COOLDOWN_MS - (now - lastClaim);
    const hoursRemaining = (msRemaining / (60 * 60 * 1000)).toFixed(1);
    return res.status(429).json({
      error: `Cooldown active. Try again in ~${hoursRemaining} hour(s).`,
    });
  }

  try {
    const rewardWei = ethers.parseEther(rewardEthStr);
    
    if (rewardWei === 0n) {
      return res.status(400).json({ error: "Reward amount is too small." });
    }

    // --- Check reward wallet has enough balance before attempting ---
    const balance = await withRetry(() => provider.getBalance(rewardWallet.address), {
      label: "getBalance before reward",
    });

    if (balance < rewardWei) {
      console.error(`Reward wallet balance too low: ${ethers.formatEther(balance)} ETH (Required: ${rewardEthStr} ETH)`);
      return res.status(503).json({
        error: "Reward pool is empty. Ask the host/instructor to refill the reward wallet.",
      });
    }

    // --- Send the reward ---
    console.log(`Attempting to send ${rewardEthStr} ETH to ${normalized}...`);
    const tx = await withRetry(
      () => rewardWallet.sendTransaction({ to: normalized, value: rewardWei }),
      { label: "sendTransaction" }
    );

    console.log(`Sent ${rewardEthStr} ETH to ${normalized} — tx: ${tx.hash}`);

    // Record the cooldown BEFORE waiting for confirmation to prevent race conditions
    cooldowns[normalized] = now;
    saveCooldowns(cooldowns);

    await tx.wait();

    return res.json({
      success: true,
      txHash: tx.hash,
      amount: rewardEthStr,
    });
  } catch (err) {
    console.error("Reward transaction failed:", err);
    return res.status(500).json({ error: "Reward transaction failed. Check server logs." });
  }
});

/* ------------------------------------------------------------
   5) GET /status — quick health check / reward pool balance
------------------------------------------------------------- */
app.get("/status", async (req, res) => {
  try {
    const balance = await withRetry(() => provider.getBalance(rewardWallet.address), {
      label: "getBalance for /status",
    });
    res.json({
      ok: true,
      rewardWalletAddress: rewardWallet.address,
      rewardPoolBalanceEth: ethers.formatEther(balance),
      rewardAmountEth: REWARD_AMOUNT_ETH,
      coinRewardRateEth: COIN_REWARD_RATE,
      cooldownHours: REWARD_COOLDOWN_HOURS,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Could not reach Sepolia RPC (possibly rate-limited)." });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ Chamelon Reward Server running at http://localhost:${PORT}`);
  console.log(`   Reward wallet: ${rewardWallet.address}`);
  console.log(`   Base reward amount: ${REWARD_AMOUNT_ETH} ETH`);
  console.log(`   Coin conversion rate: 1 Coin = ${COIN_REWARD_RATE} ETH`);
  console.log(`   Cooldown: ${REWARD_COOLDOWN_HOURS} hour(s) per wallet`);
  console.log(`   Check pool balance any time: http://localhost:${PORT}/status\n`);
});
