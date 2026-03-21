import 'server-only';

import {
  createToken,
  createUser,
  getAllUserTokens,
  getUserAccessToken,
  getUserTokenKey,
  userLogin,
} from './api';
import {
  buildDefaultTokenPayload,
  buildSignupUserPayload,
  buildAuthorization,
} from './utils';
import type {
  NewApiLoginPayload,
  NewApiLoginResult,
  NewApiLoginResponse,
  NewApiTokenListData,
  NewApiTokenListResponse,
  NewApiTokenPayload,
  NewApiTokenItem,
  NewApiUserTokenResponse,
  NewApiUserPayload,
} from './types';

export type {
  NewApiLoginPayload,
  NewApiLoginResult,
  NewApiLoginResponse,
  NewApiTokenListData,
  NewApiTokenListResponse,
  NewApiTokenItem,
  NewApiUserTokenResponse,
  NewApiTokenPayload,
  NewApiUserPayload,
};

export {
  createToken,
  createUser,
  getAllUserTokens,
  getUserAccessToken,
  getUserTokenKey,
  userLogin,
};

type SignupNewApiResult = {
  newapiUsername: string;
  newapiUserPass: string;
  newapiUserId: string;
  newapiAccessToken: string;
  newapiUserDefaultToken: string;
};

// 从令牌列表中选择最新创建的令牌 ID，用于读取完整 key。
const pickLatestTokenId = (tokens: NewApiTokenListData): number => {
  if (!tokens.items.length) {
    throw new Error('createUserForSignup failed: no token found after createToken');
  }

  const latest = tokens.items.reduce((prev, curr) =>
    curr.id > prev.id ? curr : prev
  );
  return latest.id;
};

export const createUserForSignup = async (): Promise<SignupNewApiResult> => {
  // 构建注册时需要同步到 NewAPI 的用户和默认令牌参数。
  const userPayload = buildSignupUserPayload();
  const tokenPayload = buildDefaultTokenPayload();

  // 1) 创建 NewAPI 用户。
  await createUser(userPayload);

  // 2) 使用新用户登录，拿到用户 ID 和 session。
  const loginResult = await userLogin({
    username: userPayload.username,
    password: userPayload.password,
  });
  const newapiUserId = loginResult.data.id;

  // 3) 基于 session 获取用户访问令牌（access token）。
  const accessToken = await getUserAccessToken(loginResult.session, newapiUserId);
  const authorization = buildAuthorization(accessToken);

  // 4) 为该用户创建默认业务令牌。
  await createToken(tokenPayload, {
    authorization,
    userId: newapiUserId,
  });

  // 5) 拉取用户全部令牌并读取最新令牌的完整 key。
  const userTokens = await getAllUserTokens({
    authorization,
    userId: newapiUserId,
    p: 1,
    size: 10,
  });
  const defaultTokenId = pickLatestTokenId(userTokens);
  const userTokenKey = await getUserTokenKey(defaultTokenId, {
    authorization,
    userId: newapiUserId,
  });

  return {
    newapiUsername: userPayload.username,
    newapiUserPass: userPayload.password,
    newapiUserId: String(newapiUserId),
    newapiAccessToken: accessToken,
    newapiUserDefaultToken: userTokenKey,
  };
};
