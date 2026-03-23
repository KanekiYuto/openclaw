export const BOT_DEPLOY_PLANS = {
  basic: {
    cpus: 2,
    memoryMb: 4096,
    volumeGb: 40,
    monthlyCredits: 1500,
    yearlyCredits: 18000,
    monthlyPrice: 19,
    yearlyPrice: 190,
    recommended: false,
  },
  pro: {
    cpus: 4,
    memoryMb: 8192,
    volumeGb: 80,
    monthlyCredits: 7500,
    yearlyCredits: 90000,
    monthlyPrice: 49,
    yearlyPrice: 490,
    recommended: true,
  },
  max: {
    cpus: 8,
    memoryMb: 16384,
    volumeGb: 160,
    monthlyCredits: 30000,
    yearlyCredits: 360000,
    monthlyPrice: 99,
    yearlyPrice: 990,
    recommended: false,
  },
} as const;

export type DeployPlan = keyof typeof BOT_DEPLOY_PLANS;

export const BOT_DEPLOY_PLAN_KEYS = Object.keys(
  BOT_DEPLOY_PLANS
) as DeployPlan[];
