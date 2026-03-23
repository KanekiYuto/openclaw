import 'server-only';

import {
  createRequestController,
  getAdminUserId,
  getAuthorization,
  getApiErrorMessage,
  getBaseEndpoint,
  parseResponseBody,
  summarizeBody,
} from './utils';
import type {
  NewApiLoginPayload,
  NewApiLoginResult,
  NewApiLoginResponse,
  NewApiRedemptionResponse,
  NewApiTokenKeyResponse,
  NewApiTokenListData,
  NewApiTokenListResponse,
  NewApiTokenPayload,
  NewApiUserTopupResponse,
  NewApiUserTokenResponse,
  NewApiUserPayload,
} from './types';

export async function createUser(payload: NewApiUserPayload) {
  const endpoint = getBaseEndpoint('/api/user', true);
  const { signal, close } = createRequestController();
  const adminUserId = getAdminUserId();

  try {
    console.log('[newapi] create user request', {
      endpoint,
      username: payload.username,
      remark: payload.remark,
    });

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthorization(),
        'New-Api-User': adminUserId,
      },
      body: JSON.stringify(payload),
      signal,
    });

    const body = await parseResponseBody(resp);
    if (!resp.ok) {
      const message = getApiErrorMessage(
        body,
        `newapi create user failed: ${resp.status}`
      );
      console.log('[newapi] create user failed', {
        endpoint,
        username: payload.username,
        status: resp.status,
        body: summarizeBody(body),
      });
      throw new Error(message);
    }

    if (!body || !body.success) {
      throw new Error(getApiErrorMessage(body, 'newapi create user failed'));
    }

    console.log('[newapi] create user success', {
      endpoint,
      username: payload.username,
      status: resp.status,
      body: summarizeBody(body),
    });

    return { endpoint, payload, body };
  } finally {
    close();
  }
}

export async function getUserTokenKey(id: number, options: {
  authorization: string;
  userId: string | number;
}): Promise<string> {
  const endpoint = getBaseEndpoint(`/api/token/${id}/key`, true);
  const { signal, close } = createRequestController();
  const authorization = String(options.authorization || '').trim();
  const userId = String(options.userId || '').trim();
  const tokenId = Number(id);

  if (!Number.isFinite(tokenId) || tokenId <= 0) {
    throw new Error('getUserTokenKey requires a valid token id');
  }
  if (!authorization) {
    throw new Error('getUserTokenKey requires authorization');
  }
  if (!userId) {
    throw new Error('getUserTokenKey requires userId');
  }

  try {
    console.log('[newapi] get user token key request', { endpoint, userId, tokenId });

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'New-Api-User': userId,
      },
      signal,
    });

    const body = (await parseResponseBody(resp)) as Partial<NewApiTokenKeyResponse> &
      Record<string, unknown>;

    if (!resp.ok) {
      const message = getApiErrorMessage(
        body,
        `newapi get user token key failed: ${resp.status}`
      );
      console.log('[newapi] get user token key failed', {
        endpoint,
        userId,
        tokenId,
        status: resp.status,
        body: summarizeBody(body),
      });
      throw new Error(message);
    }

    if (!body || !body.success || !body.data || typeof body.data.key !== 'string') {
      throw new Error(getApiErrorMessage(body, 'newapi get user token key failed'));
    }

    console.log('[newapi] get user token key success', {
      endpoint,
      userId,
      tokenId,
      status: resp.status,
      keyLength: body.data.key.length,
    });

    return body.data.key;
  } finally {
    close();
  }
}

export async function getAllUserTokens(options: {
  authorization: string;
  userId: string | number;
  p: number;
  size: number;
}): Promise<NewApiTokenListData> {
  const p = Number(options.p);
  const size = Number(options.size);
  if (!Number.isFinite(p) || p <= 0) {
    throw new Error('getAllUserTokens requires valid p');
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('getAllUserTokens requires valid size');
  }

  const endpoint = getBaseEndpoint(`/api/token?p=${p}&size=${size}`, true);
  const { signal, close } = createRequestController();
  const authorization = String(options.authorization || '').trim();
  const userId = String(options.userId || '').trim();
  if (!authorization) {
    const error = new Error('getAllUserTokens requires authorization');
    console.log('[newapi] get all user tokens failed', {
      endpoint,
      userId,
      p,
      size,
      error: error.message,
    });
    throw error;
  }
  if (!userId) {
    const error = new Error('getAllUserTokens requires userId');
    console.log('[newapi] get all user tokens failed', {
      endpoint,
      userId,
      p,
      size,
      error: error.message,
    });
    throw error;
  }

  try {
    console.log('[newapi] get all user tokens request', { endpoint, userId, p, size });

    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: authorization,
        'New-Api-User': userId,
      },
      signal,
    });

    const body = (await parseResponseBody(resp)) as Partial<NewApiTokenListResponse> &
      Record<string, unknown>;
    if (!resp.ok) {
      const message = getApiErrorMessage(
        body,
        `newapi get all user tokens failed: ${resp.status}`
      );
      console.log('[newapi] get all user tokens failed', {
        endpoint,
        userId,
        status: resp.status,
        body: summarizeBody(body),
      });
      throw new Error(message);
    }

    if (
      !body ||
      !body.success ||
      !body.data ||
      typeof body.data.page !== 'number' ||
      typeof body.data.page_size !== 'number' ||
      typeof body.data.total !== 'number' ||
      !Array.isArray(body.data.items)
    ) {
      throw new Error(getApiErrorMessage(body, 'newapi get all user tokens failed'));
    }

    console.log('[newapi] get all user tokens success', {
      endpoint,
      userId,
      status: resp.status,
      total: body.data.total,
    });

    return body.data;
  } catch (error) {
    console.log('[newapi] get all user tokens failed', {
      endpoint,
      userId,
      p,
      size,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    close();
  }
}

export async function createToken(
  payload: NewApiTokenPayload,
  options: {
    authorization: string;
    userId: string | number;
  }
) {
  const endpoint = getBaseEndpoint('/api/token', true);
  const { signal, close } = createRequestController();
  const authorization = String(options.authorization || '').trim();
  const userId = String(options.userId || '').trim();
  if (!authorization) {
    throw new Error('createToken requires authorization');
  }
  if (!userId) {
    throw new Error('createToken requires userId');
  }

  try {
    console.log('[newapi] create token request', { endpoint, payload });

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
        'New-Api-User': userId,
      },
      body: JSON.stringify(payload),
      signal,
    });

    const body = await parseResponseBody(resp);
    if (!resp.ok) {
      const message = getApiErrorMessage(
        body,
        `newapi create token failed: ${resp.status}`
      );
      console.log('[newapi] create token failed', {
        endpoint,
        status: resp.status,
        body: summarizeBody(body),
      });
      throw new Error(message);
    }

    if (!body || !body.success) {
      throw new Error(getApiErrorMessage(body, 'newapi create token failed'));
    }

    console.log('[newapi] create token success', {
      endpoint,
      status: resp.status,
      body: summarizeBody(body),
    });

    return { endpoint, payload, body };
  } finally {
    close();
  }
}

export async function userLogin(
  input: NewApiLoginPayload
): Promise<NewApiLoginResult> {
  const endpoint = getBaseEndpoint('/api/user/login');
  const username = String(input.username || '').trim();
  const password = String(input.password || '').trim();

  if (!username) {
    throw new Error('newapi login requires username');
  }
  if (!password) {
    throw new Error('newapi login requires password');
  }

  const { signal, close } = createRequestController();

  try {
    console.log('[newapi] login request', { endpoint, username });

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
      signal,
    });

    const setCookie = resp.headers.get('set-cookie') || '';
    const cookie = setCookie ? setCookie.split(';')[0].trim() : '';
    const sessionMatch = cookie.match(/(?:^|;\s*)session=([^;]+)/);
    const session = sessionMatch ? sessionMatch[1] : '';
    const body = (await parseResponseBody(resp)) as Partial<NewApiLoginResponse> &
      Record<string, unknown>;

    if (!resp.ok) {
      const message = getApiErrorMessage(body, `newapi login failed: ${resp.status}`);
      console.log('[newapi] login failed', {
        endpoint,
        username,
        status: resp.status,
        body: summarizeBody(body),
      });
      throw new Error(message);
    }

    if (!body || !body.success || !body.data) {
      throw new Error(getApiErrorMessage(body, 'newapi login failed'));
    }
    if (!session) {
      throw new Error('newapi login failed: session is empty');
    }

    console.log('[newapi] login success', {
      endpoint,
      username,
      status: resp.status,
      hasSetCookie: Boolean(setCookie),
      body: summarizeBody(body),
    });

    return {
      ...(body as NewApiLoginResponse),
      session,
    };
  } finally {
    close();
  }
}

export async function getUserAccessToken(
  session: string,
  userId: string | number
): Promise<string> {
  const endpoint = getBaseEndpoint('/api/user/token');
  const normalizedSession = String(session).trim();
  const normalizedUserId = String(userId).trim();
  if (!normalizedSession) {
    throw new Error('getUserAccessToken requires session');
  }
  if (!normalizedUserId) {
    throw new Error('getUserAccessToken requires userId');
  }

  const { signal, close } = createRequestController();

  try {
    console.log('[newapi] get user token request', { endpoint });

    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Cookie: `session=${normalizedSession}`,
        'New-Api-User': normalizedUserId,
      },
      signal,
    });

    const body = (await parseResponseBody(resp)) as Partial<NewApiUserTokenResponse> &
      Record<string, unknown>;
    if (!resp.ok) {
      const message = getApiErrorMessage(
        body,
        `newapi get user token failed: ${resp.status}`
      );
      console.log('[newapi] get user token failed', {
        endpoint,
        status: resp.status,
        body: summarizeBody(body),
      });
      throw new Error(message);
    }

    if (!body || !body.success || typeof body.data !== 'string') {
      throw new Error(getApiErrorMessage(body, 'newapi get user token failed'));
    }

    console.log('[newapi] get user token success', {
      endpoint,
      status: resp.status,
      tokenLength: body.data.length,
    });

    return body.data;
  } finally {
    close();
  }
}

export async function createRedemption(options: {
  name: string;
  quota: number;
}): Promise<string[]> {
  const endpoint = getBaseEndpoint('/api/redemption/', true);
  const { signal, close } = createRequestController();
  const adminUserId = getAdminUserId();
  const name = String(options.name || '').trim();
  const quota = Number(options.quota);

  if (!name) {
    throw new Error('createRedemption requires name');
  }
  if (!Number.isFinite(quota) || quota <= 0) {
    throw new Error('createRedemption requires valid quota');
  }

  try {
    const payload = {
      quota,
      count: 1,
      expired_time: 0,
      name,
    };
    console.log('[newapi] create redemption request', {
      endpoint,
      payload,
    });

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthorization(),
        'New-Api-User': adminUserId,
      },
      body: JSON.stringify(payload),
      signal,
    });

    const body = (await parseResponseBody(resp)) as Partial<NewApiRedemptionResponse> &
      Record<string, unknown>;
    if (!resp.ok) {
      const message = getApiErrorMessage(
        body,
        `newapi create redemption failed: ${resp.status}`
      );
      console.log('[newapi] create redemption failed', {
        endpoint,
        status: resp.status,
        body: summarizeBody(body),
      });
      throw new Error(message);
    }

    if (!body || !body.success || !Array.isArray(body.data)) {
      throw new Error(getApiErrorMessage(body, 'newapi create redemption failed'));
    }

    console.log('[newapi] create redemption success', {
      endpoint,
      status: resp.status,
      body: summarizeBody(body),
    });
    return body.data;
  } finally {
    close();
  }
}

export async function userTopup(options: {
  key: string;
  authorization: string;
  userId: string | number;
}): Promise<number> {
  const endpoint = getBaseEndpoint('/api/user/topup', true);
  const { signal, close } = createRequestController();
  const redemptionKey = String(options.key || '').trim();
  const authorization = String(options.authorization || '').trim();
  const userId = String(options.userId || '').trim();
  if (!redemptionKey) {
    throw new Error('userTopup requires key');
  }
  if (!authorization) {
    throw new Error('userTopup requires authorization');
  }
  if (!userId) {
    throw new Error('userTopup requires userId');
  }

  try {
    const payload = { key: redemptionKey };
    console.log('[newapi] user topup request', {
      endpoint,
      payload,
    });

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
        'New-Api-User': userId,
      },
      body: JSON.stringify(payload),
      signal,
    });

    const body = (await parseResponseBody(resp)) as Partial<NewApiUserTopupResponse> &
      Record<string, unknown>;
    if (!resp.ok) {
      const message = getApiErrorMessage(
        body,
        `newapi user topup failed: ${resp.status}`
      );
      console.log('[newapi] user topup failed', {
        endpoint,
        status: resp.status,
        body: summarizeBody(body),
      });
      throw new Error(message);
    }

    if (!body || !body.success || typeof body.data !== 'number') {
      throw new Error(getApiErrorMessage(body, 'newapi user topup failed'));
    }

    console.log('[newapi] user topup success', {
      endpoint,
      status: resp.status,
      data: body.data,
    });
    return body.data;
  } finally {
    close();
  }
}
