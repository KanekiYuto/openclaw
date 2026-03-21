export type NewApiUserPayload = {
  username: string;
  password: string;
  remark: string;
};

export type NewApiTokenPayload = {
  remain_quota: number;
  expired_time: number;
  unlimited_quota: boolean;
  model_limits_enabled: boolean;
  model_limits: string;
  cross_group_retry: boolean;
  name: string;
  group: string;
  allow_ips: string;
};

export type NewApiLoginPayload = {
  username: string;
  password: string;
};

export type NewApiLoginResponse = {
  data: {
    display_name: string;
    group: string;
    id: number;
    role: number;
    status: number;
    username: string;
  };
  message: string;
  success: boolean;
};

export type NewApiLoginResult = NewApiLoginResponse & {
  session: string;
};

export type NewApiUserTokenResponse = {
  data: string;
  message: string;
  success: boolean;
};

export type NewApiTokenKeyResponse = {
  data: {
    key: string;
  };
  message: string;
  success: boolean;
};

export type NewApiTokenItem = {
  id: number;
  user_id: number;
  key: string;
  status: number;
  name: string;
  created_time: number;
  accessed_time: number;
  expired_time: number;
  remain_quota: number;
  unlimited_quota: boolean;
  model_limits_enabled: boolean;
  model_limits: string;
  allow_ips: string;
  used_quota: number;
  group: string;
  cross_group_retry: boolean;
  DeletedAt: string | null;
};

export type NewApiTokenListData = {
  page: number;
  page_size: number;
  total: number;
  items: NewApiTokenItem[];
};

export type NewApiTokenListResponse = {
  data: NewApiTokenListData;
  message: string;
  success: boolean;
};
