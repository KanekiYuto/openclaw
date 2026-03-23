import 'server-only';

import {
  createRedemption,
  createToken,
  createUser,
  getAllUserTokens,
  getUserAccessToken,
  getUserTokenKey,
  userTopup,
  userLogin,
} from './api';
import {
  buildAuthorization,
  buildDefaultTokenPayload,
  buildSignupUserPayload,
} from './utils';
import type {
  NewApiLoginPayload,
  NewApiLoginResponse,
  NewApiLoginResult,
  NewApiRedemptionResponse,
  NewApiTokenItem,
  NewApiTokenListData,
  NewApiTokenListResponse,
  NewApiTokenPayload,
  NewApiUserTopupResponse,
  NewApiUserPayload,
  NewApiUserTokenResponse,
} from './types';

export type {
  NewApiLoginPayload,
  NewApiLoginResponse,
  NewApiLoginResult,
  NewApiRedemptionResponse,
  NewApiTokenItem,
  NewApiTokenListData,
  NewApiTokenListResponse,
  NewApiTokenPayload,
  NewApiUserTopupResponse,
  NewApiUserPayload,
  NewApiUserTokenResponse,
};

export {
  createRedemption,
  createToken,
  createUser,
  getAllUserTokens,
  getUserAccessToken,
  getUserTokenKey,
  userTopup,
  userLogin,
};

type SignupNewApiResult = {
  newapiUsername: string;
  newapiUserPass: string;
  newapiUserId: string;
  newapiAccessToken: string;
  newapiUserDefaultToken: string;
};

type RedemptionTopupResult = {
  key: string;
  quota: number;
  toppedUpQuota: number;
};

// 从令牌列表中选出最新创建的一条（按 id 最大）
const pickLatestTokenId = (tokens: NewApiTokenListData): number => {
  if (!tokens.items.length) {
    throw new Error('createUserForSignup failed: no token found after createToken');
  }

  const latest = tokens.items.reduce((prev, curr) =>
    curr.id > prev.id ? curr : prev
  );
  return latest.id;
};

// 基于用户 accessToken 创建一个默认业务 token，并返回 token 明文 key
export const createDefaultTokenForUser = async (options: {
  accessToken: string;
  userId: string | number;
  payload?: NewApiTokenPayload;
}): Promise<string> => {
  const userId = String(options.userId || '').trim();
  const accessToken = String(options.accessToken || '').trim();
  if (!userId) {
    throw new Error('createDefaultTokenForUser requires userId');
  }
  if (!accessToken) {
    throw new Error('createDefaultTokenForUser requires accessToken');
  }

  const authorization = buildAuthorization(accessToken);
  const tokenPayload = options.payload || buildDefaultTokenPayload();

  // 1) 创建 token
  await createToken(tokenPayload, {
    authorization,
    userId,
  });

  // 2) 列表里取最新 token id
  const userTokens = await getAllUserTokens({
    authorization,
    userId,
    p: 1,
    size: 10,
  });
  const defaultTokenId = pickLatestTokenId(userTokens);
  // 3) 读取该 token 的完整 key（用于实例环境变量）
  return getUserTokenKey(defaultTokenId, {
    authorization,
    userId,
  });
};

// 注册后为用户在 NewAPI 创建账号 + 登录 + 创建默认 token，并返回落库字段
export const createUserForSignup = async (): Promise<SignupNewApiResult> => {
  const userPayload = buildSignupUserPayload();
  const tokenPayload = buildDefaultTokenPayload();

  await createUser(userPayload);

  const loginResult = await userLogin({
    username: userPayload.username,
    password: userPayload.password,
  });
  const newapiUserId = loginResult.data.id;
  const accessToken = await getUserAccessToken(loginResult.session, newapiUserId);
  const userTokenKey = await createDefaultTokenForUser({
    accessToken,
    userId: newapiUserId,
    payload: tokenPayload,
  });

  return {
    newapiUsername: userPayload.username,
    newapiUserPass: userPayload.password,
    newapiUserId: String(newapiUserId),
    newapiAccessToken: accessToken,
    newapiUserDefaultToken: userTokenKey,
  };
};

// 兑换码充值：先创建兑换码，再立即使用该兑换码充值
export const redeemTopup = async (options: {
  name: string;
  quota: number;
  accessToken: string;
  userId: string | number;
}): Promise<RedemptionTopupResult> => {
  const name = String(options.name || '').trim();
  const quota = Number(options.quota);
  const accessToken = String(options.accessToken || '').trim();
  const userId = String(options.userId || '').trim();
  if (!name) {
    throw new Error('redeemTopup requires name');
  }
  if (!Number.isFinite(quota) || quota <= 0) {
    throw new Error('redeemTopup requires valid quota');
  }
  if (!accessToken) {
    throw new Error('redeemTopup requires accessToken');
  }
  if (!userId) {
    throw new Error('redeemTopup requires userId');
  }

  const keys = await createRedemption({ name, quota });
  const key = String(keys?.[0] || '').trim();
  if (!key) {
    throw new Error('redeemTopup failed: redemption key is empty');
  }

  const toppedUpQuota = await userTopup({
    key,
    authorization: buildAuthorization(accessToken),
    userId,
  });
  return {
    key,
    quota,
    toppedUpQuota,
  };
};
