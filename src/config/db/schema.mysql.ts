import {
  boolean,
  index,
  int,
  longtext,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

// MySQL has no schema concept like Postgres. Keep a `table` alias to minimize diff with pg/sqlite schemas.
const table = mysqlTable;

// MySQL limits index length; use a safe default size for frequently indexed string columns.
const varchar191 = (name: string) => varchar(name, { length: 191 });

export const user = table(
  'user',
  {
    id: varchar191('id').primaryKey(),
    name: varchar191('name').notNull(),
    email: varchar191('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    // Track first-touch acquisition channel (e.g. google, twitter, newsletter)
    utmSource: varchar('utm_source', { length: 100 }).notNull().default(''),
    ip: varchar('ip', { length: 45 }).notNull().default(''),
    locale: varchar('locale', { length: 20 }).notNull().default(''),
    newapiUsername: varchar('newapi_username', { length: 64 })
      .notNull()
      .default(''),
    newapiUserPass: varchar('newapi_user_pass', { length: 128 })
      .notNull()
      .default(''),
    newapiUserId: varchar('newapi_user_id', { length: 64 }).notNull().default(''),
    newapiAccessToken: text('newapi_access_token').notNull().default(''),
    newapiUserDefaultToken: text('newapi_user_default_token').notNull().default(''),
  },
  (table) => [
    // Search users by name in admin dashboard
    index('idx_user_name').on(table.name),
    // Order users by registration time for latest users list
    index('idx_user_created_at').on(table.createdAt),
  ]
);

export const session = table(
  'session',
  {
    id: varchar191('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: varchar191('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    // Composite: Query user sessions and filter by expiration
    // Can also be used for: WHERE userId = ? (left-prefix)
    index('idx_session_user_expires').on(table.userId, table.expiresAt),
  ]
);

export const account = table(
  'account',
  {
    id: varchar191('id').primaryKey(),
    accountId: varchar191('account_id').notNull(),
    providerId: varchar('provider_id', { length: 50 }).notNull(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: varchar('scope', { length: 255 }),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    // Query all linked accounts for a user
    index('idx_account_user_id').on(table.userId),
    // Composite: OAuth login (most critical)
    // Can also be used for: WHERE providerId = ? (left-prefix)
    index('idx_account_provider_account').on(table.providerId, table.accountId),
  ]
);

export const verification = table(
  'verification',
  {
    id: varchar191('id').primaryKey(),
    identifier: varchar191('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    // Find verification code by identifier (e.g., find code by email)
    index('idx_verification_identifier').on(table.identifier),
  ]
);

export const config = table('config', {
  name: varchar191('name').unique().notNull(),
  value: text('value'),
});

export const bot = table(
  'bot',
  {
    id: varchar191('id').primaryKey(), // Bot主键ID
    botName: varchar191('bot_name').notNull().default(''), // Bot名称
    gatewayToken: text('gateway_token').notNull(), // 网关令牌
    channelTelegramBotToken: text('channel_telegram_bot_token').notNull(), // Telegram机器人令牌
    channelDiscordBotToken: text('channel_discord_bot_token').notNull().default(''), // Discord机器人令牌
    createdAt: timestamp('created_at').defaultNow().notNull(), // 创建时间
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(), // 更新时间
  },
  (table) => [index('idx_bot_created_at').on(table.createdAt)]
);

export const botApp = table(
  'bot_app',
  {
    id: varchar191('id').primaryKey(), // 应用主键ID
    botId: varchar191('bot_id')
      .notNull()
      .references(() => bot.id, { onDelete: 'cascade' }), // 关联Bot ID
    appName: varchar191('app_name').notNull().unique(), // Fly应用名（全局唯一）
    network: varchar('network', { length: 100 }).notNull(), // Fly网络名称
    region: varchar('region', { length: 100 }).notNull(), // 应用部署区域
    ip: varchar('ip', { length: 45 }).notNull().default(''), // 应用入口IP地址
    createdAt: timestamp('created_at').defaultNow().notNull(), // 创建时间
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(), // 更新时间
  },
  (table) => [
    index('idx_bot_app_bot_id').on(table.botId),
    index('idx_bot_app_app_name').on(table.appName),
    index('idx_bot_app_region').on(table.region),
  ]
);

export const botMachine = table(
  'bot_machine',
  {
    id: varchar191('id').primaryKey(), // 机器记录主键ID
    botAppId: varchar191('bot_app_id')
      .notNull()
      .references(() => botApp.id, { onDelete: 'cascade' }), // 关联应用ID
    machineId: varchar191('machine_id').notNull().unique(), // Fly机器ID
    cpuKind: varchar('cpu_kind', { length: 100 }).notNull(), // CPU规格类型
    cpus: int('cpus').notNull(), // vCPU数量
    memoryMb: int('memory_mb').notNull(), // 内存大小（MB）
    machineState: varchar('machine_state', { length: 100 }).notNull(), // 机器运行状态
    createdAt: timestamp('created_at').defaultNow().notNull(), // 创建时间
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(), // 更新时间
  },
  (table) => [
    index('idx_bot_machine_app_id').on(table.botAppId),
    index('idx_bot_machine_state').on(table.machineState),
  ]
);

export const botVolume = table(
  'bot_volume',
  {
    id: varchar191('id').primaryKey(), // 磁盘记录主键ID
    botMachineId: varchar191('bot_machine_id')
      .notNull()
      .references(() => botMachine.id, { onDelete: 'cascade' }), // 关联机器ID
    volumeName: varchar191('volume_name').notNull(), // 磁盘逻辑名称
    volumeId: varchar191('volume_id'), // 云厂商磁盘ID
    region: varchar('region', { length: 100 }).notNull(), // 磁盘区域
    sizeGb: int('size_gb').notNull(), // 磁盘大小（GB）
    createdAt: timestamp('created_at').defaultNow().notNull(), // 创建时间
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(), // 更新时间
  },
  (table) => [
    index('idx_bot_volume_machine_id').on(table.botMachineId),
    index('idx_bot_volume_region').on(table.region),
  ]
);

export const taxonomy = table(
  'taxonomy',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: varchar191('parent_id'),
    slug: varchar191('slug').unique().notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    image: text('image'),
    icon: varchar191('icon'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    sort: int('sort').default(0).notNull(),
  },
  (table) => [
    // Composite: Query taxonomies by type and status
    // Can also be used for: WHERE type = ? (left-prefix)
    index('idx_taxonomy_type_status').on(table.type, table.status),
  ]
);

export const post = table(
  'post',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: varchar191('parent_id'),
    slug: varchar191('slug').unique().notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }),
    description: text('description'),
    image: text('image'),
    content: longtext('content'),
    categories: text('categories'),
    tags: text('tags'),
    authorName: varchar191('author_name'),
    authorImage: text('author_image'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    sort: int('sort').default(0).notNull(),
  },
  (table) => [
    // Composite: Query posts by type and status
    // Can also be used for: WHERE type = ? (left-prefix)
    index('idx_post_type_status').on(table.type, table.status),
  ]
);

export const order = table(
  'order',
  {
    id: varchar191('id').primaryKey(),
    orderNo: varchar191('order_no').unique().notNull(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: varchar191('user_email'), // checkout user email
    status: varchar('status', { length: 50 }).notNull(), // created, paid, failed
    amount: int('amount').notNull(), // checkout amount in cents
    currency: varchar('currency', { length: 10 }).notNull(), // checkout currency
    productId: varchar191('product_id'),
    paymentType: varchar('payment_type', { length: 50 }), // one_time, subscription
    paymentInterval: varchar('payment_interval', { length: 50 }), // day, week, month, year
    paymentProvider: varchar('payment_provider', { length: 50 }).notNull(),
    paymentSessionId: varchar191('payment_session_id'),
    checkoutInfo: text('checkout_info').notNull(), // checkout request info
    checkoutResult: text('checkout_result'), // checkout result
    paymentResult: text('payment_result'), // payment result
    discountCode: varchar191('discount_code'), // discount code
    discountAmount: int('discount_amount'), // discount amount in cents
    discountCurrency: varchar('discount_currency', { length: 10 }), // discount currency
    paymentEmail: varchar191('payment_email'), // actual payment email
    paymentAmount: int('payment_amount'), // actual payment amount
    paymentCurrency: varchar('payment_currency', { length: 10 }), // actual payment currency
    paidAt: timestamp('paid_at'), // paid at
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    description: text('description'), // order description
    productName: varchar('product_name', { length: 255 }), // product name
    subscriptionId: varchar191('subscription_id'), // provider subscription id
    subscriptionResult: text('subscription_result'), // provider subscription result
    checkoutUrl: text('checkout_url'), // checkout url
    callbackUrl: text('callback_url'), // callback url, after handle callback
    creditsAmount: int('credits_amount'), // credits amount
    creditsValidDays: int('credits_valid_days'), // credits validity days
    planName: varchar191('plan_name'), // subscription plan name
    paymentProductId: varchar191('payment_product_id'), // payment product id
    invoiceId: varchar191('invoice_id'),
    invoiceUrl: text('invoice_url'),
    subscriptionNo: varchar191('subscription_no'), // order subscription no
    transactionId: varchar191('transaction_id'), // payment transaction id
    paymentUserName: varchar191('payment_user_name'), // payment user name
    paymentUserId: varchar191('payment_user_id'), // payment user id
  },
  (table) => [
    // Composite: Query user orders by status (most common)
    // Can also be used for: WHERE userId = ? (left-prefix)
    index('idx_order_user_status_payment_type').on(
      table.userId,
      table.status,
      table.paymentType
    ),
    // Composite: Prevent duplicate payments
    // Can also be used for: WHERE transactionId = ? (left-prefix)
    index('idx_order_transaction_provider').on(
      table.transactionId,
      table.paymentProvider
    ),
    // Order orders by creation time for listing
    index('idx_order_created_at').on(table.createdAt),
  ]
);

export const subscription = table(
  'subscription',
  {
    id: varchar191('id').primaryKey(),
    subscriptionNo: varchar191('subscription_no').unique().notNull(), // subscription no
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: varchar191('user_email'), // subscription user email
    status: varchar('status', { length: 50 }).notNull(), // subscription status
    paymentProvider: varchar('payment_provider', { length: 50 }).notNull(),
    subscriptionId: varchar191('subscription_id').notNull(), // provider subscription id
    subscriptionResult: text('subscription_result'), // provider subscription result
    productId: varchar191('product_id'), // product id
    description: text('description'), // subscription description
    amount: int('amount'), // subscription amount
    currency: varchar('currency', { length: 10 }), // subscription currency
    interval: varchar('interval', { length: 50 }), // subscription interval, day, week, month, year
    intervalCount: int('interval_count'), // subscription interval count
    trialPeriodDays: int('trial_period_days'), // subscription trial period days
    currentPeriodStart: timestamp('current_period_start'), // subscription current period start
    currentPeriodEnd: timestamp('current_period_end'), // subscription current period end
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    planName: varchar191('plan_name'),
    billingUrl: text('billing_url'),
    productName: varchar('product_name', { length: 255 }), // subscription product name
    creditsAmount: int('credits_amount'), // subscription credits amount
    creditsValidDays: int('credits_valid_days'), // subscription credits valid days
    paymentProductId: varchar191('payment_product_id'), // subscription payment product id
    paymentUserId: varchar191('payment_user_id'), // subscription payment user id
    canceledAt: timestamp('canceled_at'), // subscription canceled apply at
    canceledEndAt: timestamp('canceled_end_at'), // subscription canceled end at
    canceledReason: text('canceled_reason'), // subscription canceled reason
    canceledReasonType: varchar('canceled_reason_type', { length: 50 }), // subscription canceled reason type
  },
  (table) => [
    // Composite: Query user's subscriptions by status (most common)
    // Can also be used for: WHERE userId = ? (left-prefix)
    index('idx_subscription_user_status_interval').on(
      table.userId,
      table.status,
      table.interval
    ),
    // Composite: Prevent duplicate subscriptions
    // Can also be used for: WHERE paymentProvider = ? (left-prefix)
    index('idx_subscription_provider_id').on(
      table.subscriptionId,
      table.paymentProvider
    ),
    // Order subscriptions by creation time for listing
    index('idx_subscription_created_at').on(table.createdAt),
  ]
);

export const credit = table(
  'credit',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }), // user id
    userEmail: varchar191('user_email'), // user email
    orderNo: varchar191('order_no'), // payment order no
    subscriptionNo: varchar191('subscription_no'), // subscription no
    transactionNo: varchar191('transaction_no').unique().notNull(), // transaction no
    transactionType: varchar('transaction_type', { length: 50 }).notNull(), // transaction type, grant / consume
    transactionScene: varchar('transaction_scene', { length: 50 }), // transaction scene, payment / subscription / gift / award
    credits: int('credits').notNull(), // credits amount, n or -n
    remainingCredits: int('remaining_credits').notNull().default(0), // remaining credits amount
    description: text('description'), // transaction description
    expiresAt: timestamp('expires_at'), // transaction expires at
    status: varchar('status', { length: 50 }).notNull(), // transaction status
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    consumedDetail: text('consumed_detail'), // consumed detail
    metadata: text('metadata'), // transaction metadata
  },
  (table) => [
    // Critical composite index for credit consumption (FIFO queue)
    // Query: WHERE userId = ? AND transactionType = 'grant' AND status = 'active'
    //        AND remainingCredits > 0 ORDER BY expiresAt
    // Can also be used for: WHERE userId = ? (left-prefix)
    index('idx_credit_consume_fifo').on(
      table.userId,
      table.status,
      table.transactionType,
      table.remainingCredits,
      table.expiresAt
    ),
    // Query credits by order number
    index('idx_credit_order_no').on(table.orderNo),
    // Query credits by subscription number
    index('idx_credit_subscription_no').on(table.subscriptionNo),
  ]
);

// RBAC Tables
export const role = table(
  'role',
  {
    id: varchar191('id').primaryKey(),
    name: varchar191('name').notNull().unique(), // admin, editor, viewer
    title: varchar191('title').notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    sort: int('sort').default(0).notNull(),
  },
  (table) => [
    // Query active roles
    index('idx_role_status').on(table.status),
  ]
);

export const permission = table(
  'permission',
  {
    id: varchar191('id').primaryKey(),
    code: varchar191('code').notNull().unique(), // admin.users.read, admin.posts.write
    resource: varchar('resource', { length: 50 }).notNull(), // users, posts, categories
    action: varchar('action', { length: 50 }).notNull(), // read, write, delete
    title: varchar191('title').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    // Composite: Query permissions by resource and action
    // Can also be used for: WHERE resource = ? (left-prefix)
    index('idx_permission_resource_action').on(table.resource, table.action),
  ]
);

export const rolePermission = table(
  'role_permission',
  {
    id: varchar191('id').primaryKey(),
    roleId: varchar191('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    permissionId: varchar191('permission_id')
      .notNull()
      .references(() => permission.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    // Composite: Query permissions for a role
    // Can also be used for: WHERE roleId = ? (left-prefix)
    index('idx_role_permission_role_permission').on(
      table.roleId,
      table.permissionId
    ),
  ]
);

export const userRole = table(
  'user_role',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: varchar191('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    expiresAt: timestamp('expires_at'),
  },
  (table) => [
    // Composite: Query user's active roles (most critical for auth)
    // Can also be used for: WHERE userId = ? (left-prefix)
    index('idx_user_role_user_expires').on(table.userId, table.expiresAt),
  ]
);



