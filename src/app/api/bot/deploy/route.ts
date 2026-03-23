import { generateId } from 'ai';

import { respData, respErr } from '@/shared/lib/resp';
import { findUserById, getUserInfo } from '@/shared/models/user';
import {
  deployBot,
  type DeployPlan,
  parseDeployPayload,
} from '@/shared/services/bot-deploy';

function buildDeploymentResponse(input: {
  appName: string;
  plan: DeployPlan;
  region: string;
  model: string;
  user: { id: string; name: string; email: string };
  fly: { app: unknown; volume: unknown; machine: unknown };
}) {
  return {
    id: `deploy_${generateId().toLowerCase()}`,
    appName: input.appName,
    status: 'queued',
    plan: input.plan,
    env: 'production',
    triggerSource: 'dashboard',
    createdAt: new Date().toISOString(),
    triggeredBy: {
      id: input.user.id,
      name: input.user.name,
      email: input.user.email,
    },
    fly: input.fly,
    region: input.region,
    model: input.model,
    message: `bot deployment has been queued in region ${input.region}`,
  };
}

export async function POST(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await req.json().catch(() => ({}));
    const payload = parseDeployPayload(body);
    const currentUser = await findUserById(user.id);
    const newapiAccessToken = String(currentUser?.newapiAccessToken || '').trim();
    const newapiUserId = String(currentUser?.newapiUserId || '').trim();

    if (!payload.botName) {
      return respErr('botName is required');
    }
    if (!newapiAccessToken || !newapiUserId) {
      return respErr('newapi credentials are missing for current user');
    }

    const result = await deployBot({
      ...payload,
      newapiAccessToken,
      newapiUserId,
    });

    return respData(
      buildDeploymentResponse({
        appName: result.appName,
        plan: result.plan,
        region: result.region,
        model: result.model,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        fly: {
          app: result.fly.app,
          volume: result.fly.volume,
          machine: result.fly.machine,
        },
      })
    );
  } catch (e: any) {
    console.log('deploy bot failed:', e);
    return respErr(`deploy bot failed: ${e.message}`);
  }
}
