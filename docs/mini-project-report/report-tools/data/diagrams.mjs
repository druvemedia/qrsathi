// Diagram catalogue for the QRSathi report. Each entry: file name, figure number, title, Mermaid source.
// Every node/edge was derived from the audited source code (paths noted in the report text).
export const DIAGRAMS = [
{
  file: "system-architecture.mmd", fig: "4.1", title: "High-level system architecture of QRSathi",
  src: `flowchart LR
  subgraph Client["Client tier (browser)"]
    B["User / Admin browser<br/>React 19 client components"]
    ZX["zxing-wasm scanner<br/>(runs in browser)"]
    QRR["QR / barcode renderers<br/>qrcode, bwip-js (SVG)"]
  end
  subgraph Server["Next.js 15 application server on Node.js 22"]
    MW["middleware.ts<br/>CSRF origin check"]
    RSC["App Router pages<br/>(site), (app), (auth), admin"]
    API["Route handlers<br/>src/app/api/**/route.ts"]
    PUB["Public routes<br/>/r/[code] /p/[code] /f/[name] /brand/[name]"]
    AUTH["Session & RBAC<br/>lib/session.ts, lib/guard.ts, lib/roles.ts"]
    BL["Domain services<br/>qr-service, products, barcodes,<br/>billing, entitlements, scans"]
    SEC["Cross-cutting<br/>rate-limit, audit, redact, logger, env-check"]
    ORM["Prisma Client 6.19"]
    FS["Local file storage<br/>UPLOAD_DIR (lib/storage.ts)"]
  end
  subgraph Data["Data tier"]
    SQ[("SQLite (development)")]
    MY[("MySQL 8 (production target)")]
  end
  subgraph Ext["Optional external services"]
    RZP["Razorpay API<br/>Subscriptions + webhooks"]
    GG["Google OAuth / OIDC"]
    SMTP["SMTP server<br/>(password reset mail)"]
  end
  B -->|HTTPS| MW --> RSC
  MW --> API
  B --> PUB
  B --- ZX
  B --- QRR
  RSC --> AUTH
  API --> AUTH
  API --> BL
  PUB --> BL
  BL --> SEC
  BL --> ORM
  AUTH --> ORM
  BL --> FS
  ORM --> SQ
  ORM -.-> MY
  BL -.->|REST, Basic auth| RZP
  RZP -.->|signed webhook| API
  API -.->|authorization code flow| GG
  BL -.->|nodemailer| SMTP`
},
{
  file: "use-case-diagram.mmd", fig: "4.2", title: "Use-case diagram (actors and principal use cases)",
  src: `flowchart LR
  V(("Visitor /<br/>QR scanner"))
  U(("Registered<br/>user"))
  A(("Admin"))
  SA(("Super admin"))
  RZ(("Razorpay<br/>(system actor)"))
  subgraph SYS["QRSathi system boundary"]
    direction TB
    UC1(["Sign up / sign in<br/>(password or Google)"])
    UC2(["Reset password"])
    UC3(["Generate static QR<br/>(27 content types)"])
    UC4(["Create / edit dynamic QR<br/>and hosted page"])
    UC5(["Generate barcodes & labels<br/>(23 formats)"])
    UC6(["Scan QR / barcode<br/>(camera or image)"])
    UC7(["Manage products<br/>and barcodes"])
    UC8(["Record stock in / out / adjust"])
    UC9(["Bulk generate / import"])
    UC10(["View scan analytics / export"])
    UC11(["Subscribe to a paid plan"])
    UC12(["Open dynamic QR / hosted page"])
    UC13(["Report abusive QR"])
    UC14(["Moderate users, QR codes, reports"])
    UC15(["Edit settings & branding"])
    UC16(["Manage plans & pricing"])
    UC17(["Manage roles, payment credentials,<br/>delete accounts"])
    UC18(["Enrol TOTP MFA"])
    UC19(["Deliver payment events"])
  end
  V --> UC12
  V --> UC13
  V --> UC6
  U --> UC1
  U --> UC2
  U --> UC3
  U --> UC4
  U --> UC5
  U --> UC6
  U --> UC7
  U --> UC8
  U --> UC9
  U --> UC10
  U --> UC11
  A --> UC14
  A --> UC15
  A --> UC18
  SA --> UC14
  SA --> UC15
  SA --> UC16
  SA --> UC17
  SA --> UC18
  RZ --> UC19
  UC11 -. "«include»" .-> UC19`
},
{
  file: "context-dfd.mmd", fig: "4.3", title: "Context-level data-flow diagram (Level 0)",
  src: `flowchart LR
  U["Registered user"]
  V["Public visitor<br/>(scans a code)"]
  A["Administrator /<br/>super administrator"]
  R["Razorpay"]
  G["Google OAuth"]
  M["SMTP mail server"]
  P(("0<br/>QRSathi<br/>platform"))
  U -->|credentials, QR content, products,<br/>stock movements, uploads| P
  P -->|QR / barcode images, analytics,<br/>product & stock data, billing status| U
  V -->|short-code request, abuse report| P
  P -->|302 redirect, hosted page, file| V
  A -->|moderation actions, settings,<br/>plans, payment credentials| P
  P -->|users, codes, reports, audit log,<br/>statistics| A
  P -->|create plan / subscription,<br/>fetch payment| R
  R -->|signed webhook events,<br/>payment status| P
  P -->|authorization code| G
  G -->|verified e-mail, profile| P
  P -->|password-reset mail| M`
},
{
  file: "level-1-dfd.mmd", fig: "4.4", title: "Level-1 data-flow diagram",
  src: `flowchart TB
  U["User"]
  V["Visitor"]
  A["Administrator"]
  R["Razorpay"]
  P1(("1.0<br/>Authenticate &<br/>manage sessions"))
  P2(("2.0<br/>Create & manage<br/>QR codes"))
  P3(("3.0<br/>Resolve dynamic<br/>QR & record scan"))
  P4(("4.0<br/>Manage products,<br/>barcodes & stock"))
  P5(("5.0<br/>Billing &<br/>subscriptions"))
  P6(("6.0<br/>Administration &<br/>configuration"))
  D1[("D1 User / Session /<br/>MfaRecoveryCode")]
  D2[("D2 QrCode")]
  D3[("D3 Scan")]
  D4[("D4 Product / Barcode /<br/>InventoryTransaction")]
  D5[("D5 Subscription / Payment /<br/>WebhookEvent / PricingPlan")]
  D6[("D6 Setting / BrandAsset /<br/>AuditLog / Log")]
  U -->|email, password| P1
  P1 <-->|user, session rows| D1
  P1 -->|session cookie| U
  U -->|type, content, design| P2
  P2 -->|plan limits| D5
  P2 <-->|QR rows| D2
  V -->|/r/code| P3
  P3 -->|lookup| D2
  P3 -->|scan row| D3
  P3 -->|redirect| V
  U -->|product, barcode, stock movement| P4
  P4 <--> D4
  U -->|plan, interval| P5
  P5 <--> D5
  P5 <-->|subscriptions, payments| R
  P5 -->|plan upgrade| D1
  A -->|actions| P6
  P6 <--> D1
  P6 <--> D2
  P6 <--> D6
  P6 <--> D5
  P1 -->|audit events| D6`
},
{
  file: "level-2-dfd-qr.mmd", fig: "4.5", title: "Level-2 DFD: QR code creation and dynamic resolution (processes 2.0 and 3.0)",
  src: `flowchart TB
  U["User"]
  V["Visitor"]
  P21(("2.1<br/>Validate content<br/>against type schema"))
  P22(("2.2<br/>Decide static /<br/>dynamic / hosted"))
  P23(("2.3<br/>Allocate short code<br/>or alias"))
  P24(("2.4<br/>Check plan quota<br/>(withQuota tx)"))
  P25(("2.5<br/>Store QR and<br/>return payload"))
  P31(("3.1<br/>Look up short code"))
  P32(("3.2<br/>Check status, owner,<br/>expiry"))
  P33(("3.3<br/>Record scan<br/>(privacy filters)"))
  P34(("3.4<br/>Append UTM and<br/>redirect"))
  D2[("D2 QrCode")]
  D1[("D1 User")]
  D5[("D5 PricingPlan")]
  D3[("D3 Scan")]
  U -->|name, type, content, design, dynamic flag, alias| P21
  P21 -->|validated data| P22
  P22 -->|dynamic or hosted| P23
  P22 -->|static payload| P24
  P23 -->|existing codes| D2
  P23 --> P24
  D5 -->|limits| P24
  D1 -->|quotaLock row| P24
  P24 --> P25
  P25 -->|insert| D2
  P25 -->|payload, short URL| U
  V -->|GET /r/code| P31
  D2 --> P31
  P31 --> P32
  P32 -->|410 / 404 page| V
  P32 --> P33
  P33 -->|device, browser, OS, country,<br/>salted visitor hash| D3
  P33 --> P34
  P34 -->|302 Location| V`
},
{
  file: "registration-login-flowchart.mmd", fig: "4.6", title: "Flowchart: user registration and login",
  src: `flowchart TD
  S([Start]) --> C{Has account?}
  C -- No --> SU[Submit name, e-mail, password,<br/>accept terms]
  SU --> RL1{Rate limit OK?<br/>10/h per IP}
  RL1 -- No --> E429[429 Too many attempts]
  RL1 -- Yes --> V1{Input valid?<br/>zod schema}
  V1 -- No --> E400[400 validation message]
  V1 -- Yes --> OPEN{Sign-ups allowed?}
  OPEN -- No --> E403[403 sign-ups closed]
  OPEN -- Yes --> DUP{E-mail already used?}
  DUP -- Yes --> E409[409 account exists]
  DUP -- No --> HASH[bcrypt hash, cost 12<br/>role forced to user]
  HASH --> SESS
  C -- Yes --> LI[Submit e-mail and password]
  LI --> RL2{Per-IP, per-account and<br/>global limits OK?}
  RL2 -- No --> E429
  RL2 -- Yes --> FIND{Account found<br/>with password?}
  FIND -- No --> BURN[Dummy bcrypt compare<br/>audit login_failed] --> E401[401 generic error]
  FIND -- Yes --> PW{Password matches?}
  PW -- No --> AUD[Audit login_failed] --> E401
  PW -- Yes --> ACT{Status active?}
  ACT -- No --> E403B[403 suspended]
  ACT -- Yes --> SESS[Create Session row +<br/>signed HS256 cookie qs_session]
  SESS --> OK([Redirect to dashboard])`
},
{
  file: "authorization-flowchart.mmd", fig: "4.7", title: "Flowchart: authentication and authorization of an API request",
  src: `flowchart TD
  S([Request arrives]) --> M{Path under /api and<br/>method not GET/HEAD/OPTIONS?}
  M -- Yes --> WH{Webhook path?}
  WH -- No --> OR{Origin header in<br/>allowed origins?}
  OR -- No --> F403[403 cross-site blocked]
  OR -- Yes --> H
  WH -- Yes --> H
  M -- No --> H[Route handler]
  H --> K{Which guard?}
  K -- requireUser --> T1{qs_session JWT valid<br/>and Session row exists?}
  T1 -- No --> F401[401 sign in]
  T1 -- Yes --> T2{User active and<br/>sessionVersion matches?}
  T2 -- No --> F401
  T2 -- Yes --> OWN{Resource owned by user?}
  OWN -- No --> F404[404 not found]
  OWN -- Yes --> OK([Execute business logic])
  K -- requireAdmin --> A1{qs_admin cookie valid,<br/>role admin or super_admin,<br/>idle < 2 h?}
  A1 -- No --> F401A[401 administrator sign-in]
  A1 -- Yes --> A2{MFA enabled but<br/>session not MFA-verified?}
  A2 -- Yes --> F401A
  A2 -- No --> A3{Super admin<br/>without MFA?}
  A3 -- Yes --> F403M[403 enable 2FA]
  A3 -- No --> A4{Endpoint needs<br/>super admin?}
  A4 -- Yes, role is admin --> F403S[403 super admin required]
  A4 -- No / satisfied --> A5{Sensitive action?<br/>requireRecentAdminAuth}
  A5 -- Older than 15 min --> F403R[403 reauth required]
  A5 -- Fresh or not needed --> OK`
},
{
  file: "qr-generation-flowchart.mmd", fig: "4.8", title: "Flowchart: QR code generation and saving",
  src: `flowchart TD
  S([Start]) --> T[Choose QR type<br/>and fill form]
  T --> CV{Client-side zod<br/>validation passes?}
  CV -- No --> FE[Show field errors] --> T
  CV -- Yes --> D[Customise design:<br/>colours, modules, logo, frame]
  D --> PR[Render SVG preview in browser<br/>lib/qr-render.ts]
  PR --> W{Contrast / ECC<br/>warnings?}
  W -- Yes --> D
  W -- No --> CH{Save to account?}
  CH -- No --> EX[Export PNG / JPG / SVG / PDF<br/>client-side] --> E([End])
  CH -- Yes --> AU{Signed in?}
  AU -- No --> LG[Redirect to login] --> E
  AU -- Yes --> POST[POST /api/qrcodes]
  POST --> SV{Server validation OK?}
  SV -- No --> E400[400 error shown] --> T
  SV -- Yes --> DY{Dynamic or hosted?}
  DY -- Yes --> SC[Allocate short code / alias<br/>payload = base/r/code or /p/code]
  DY -- No --> PL[payload = encoded content]
  SC --> Q
  PL --> Q{Within plan quota?}
  Q -- No --> E403[403 plan limit] --> E
  Q -- Yes --> INS[Insert QrCode row] --> OK([201 Created, saved to library])`
},
{
  file: "barcode-flowchart.mmd", fig: "4.9", title: "Flowchart: barcode generation and scanning",
  src: `flowchart TD
  S([Start]) --> MODE{Generate or scan?}
  MODE -- Generate --> F[Select format<br/>e.g. EAN-13, Code 128, Data Matrix]
  F --> VAL{validateBarcode:<br/>charset, length, check digit}
  VAL -- Invalid --> ERR[Show error, e.g. wrong check digit] --> F
  VAL -- Valid --> R[bwip-js renders SVG]
  R --> L{Label layout?}
  L -- Yes --> LB[Render label: size, product, price] --> X
  L -- No --> X[Export PNG / SVG / PDF sheet]
  X --> E([End])
  MODE -- Scan --> SRC{Camera or image upload?}
  SRC --> DEC[zxing-wasm decodes in browser]
  DEC --> FOUND{Code detected?}
  FOUND -- No --> RETRY[Hint: improve light / focus] --> SRC
  FOUND -- Yes --> CL[Classify: URL, UPI, Wi-Fi, GTIN...<br/>content-safety heuristics]
  CL --> HIS[Save to local scan history<br/>browser localStorage]
  HIS --> LK{Signed in and<br/>product barcode?}
  LK -- No --> E
  LK -- Yes --> API[GET /api/products/lookup<br/>read-only]
  API --> M{Match by lookupKey or SKU?}
  M -- Yes --> SHOW[Show product and stock actions] --> E
  M -- No --> NEW[Offer: create product with this code] --> E`
},
{
  file: "product-inventory-flowchart.mmd", fig: "4.10", title: "Flowchart: product and inventory workflow",
  src: `flowchart TD
  S([Start]) --> NP[Enter product: name, SKU, price,<br/>stock, low-stock level, barcodes]
  NP --> V{productInput schema valid?}
  V -- No --> E400[400 validation error] --> NP
  V -- Yes --> BC{Barcodes valid per symbology?<br/>internal GTIN uses prefix 20-29?}
  BC -- No --> E400
  BC -- Yes --> U{SKU and barcodes unique<br/>for this user?}
  U -- No --> E409[409 duplicate] --> NP
  U -- Yes --> Q{Product and barcode<br/>quota OK?}
  Q -- No --> E403[403 plan limit]
  Q -- Yes --> C[Create Product + Barcodes +<br/>InventoryTransaction 'created']
  C --> MV{Stock movement?}
  MV -- None --> E([End])
  MV -- in --> IN[stock += qty]
  MV -- out --> OUT{stock >= qty?<br/>conditional update}
  OUT -- No --> INS[400 not enough stock] --> E
  OUT -- Yes --> DEC[stock -= qty]
  MV -- adjust --> ADJ[stock = counted qty]
  IN --> LOG[Append InventoryTransaction<br/>with signed delta and balance]
  DEC --> LOG
  ADJ --> LOG
  LOG --> LOW{stock <= lowStockAt?}
  LOW -- Yes --> FLAG[Flag as low stock in UI] --> E
  LOW -- No --> E`
},
{
  file: "dynamic-qr-resolution-flowchart.mmd", fig: "4.11", title: "Flowchart: dynamic QR resolution (/r/[code])",
  src: `flowchart TD
  S([Visitor scans printed QR]) --> G[GET /r/code]
  G --> F{QrCode with shortCode<br/>exists and isDynamic?}
  F -- No --> N404[404 page: not found]
  F -- Yes --> H{isHosted?}
  H -- Yes --> P[302 to /p/code hosted page]
  H -- No --> D{status disabled or<br/>owner suspended?}
  D -- Yes --> G410a[410 disabled]
  D -- No --> PA{status paused?}
  PA -- Yes --> G410b[410 paused + report link]
  PA -- No --> EX{expiresAt in the past?}
  EX -- Yes --> G410c[410 expired]
  EX -- No --> DS{destination set?}
  DS -- No --> N404b[404 no destination]
  DS -- Yes --> BOT{User agent is a bot?}
  BOT -- Yes --> RD
  BOT -- No --> RL{Under 20 scans per<br/>IP per 10 min?}
  RL -- No --> RD
  RL -- Yes --> DNT{DNT / GPC or<br/>tracking off?}
  DNT -- Yes --> CNT[Insert count-only Scan row] --> RD
  DNT -- No --> DET[Insert Scan with device, browser,<br/>OS, country, salted daily hash] --> RD
  RD[Append UTM params<br/>302 redirect, no-store, no-referrer] --> E([End])`
},
{
  file: "subscription-payment-flowchart.mmd", fig: "4.12", title: "Flowchart: subscription checkout and confirmation",
  src: `flowchart TD
  S([User selects plan & interval]) --> CR{Checkout enabled and<br/>credentials verified?}
  CR -- No --> E503[503 payments unavailable]
  CR -- Yes --> PP{Plan published, paid,<br/>interval offered?}
  PP -- No --> E404[404 / 400]
  PP -- Yes --> LV{User already has a live<br/>subscription?}
  LV -- Yes --> E409[409 cancel first]
  LV -- No --> PRV{Active ProviderPlan for<br/>price, currency, mode?}
  PRV -- No --> E409b[409 not ready]
  PRV -- Yes --> RS[Create Razorpay subscription<br/>store Subscription 'created']
  RS --> CO[Razorpay Checkout in browser]
  CO --> CB[POST /api/billing/verify<br/>payment_id, subscription_id, signature]
  CB --> SIG{HMAC-SHA256 signature valid?}
  SIG -- No --> E400[400 cannot verify]
  SIG -- Yes --> FP[Fetch payment and subscription<br/>from Razorpay API]
  FP --> CAP{Captured, amount and<br/>currency match?}
  CAP -- Not yet --> PEN[Status pending<br/>wait for webhook]
  CAP -- Mismatch --> E400b[400 mismatch, plan unchanged]
  CAP -- Yes --> APP[applyCharge: Payment 'paid',<br/>Subscription 'active', user.plan upgraded]
  PEN --> WH[Signed webhook subscription.charged]
  WH --> DUP{Event id already<br/>in WebhookEvent ledger?}
  DUP -- Yes --> IGN[200 duplicate, no change]
  DUP -- No --> APP
  APP --> E([Plan active until currentPeriodEnd])`
},
{
  file: "admin-config-flowchart.mmd", fig: "4.13", title: "Flowchart: administrator configuration workflow",
  src: `flowchart TD
  S([Admin opens /admin/login]) --> L{Password valid and<br/>role admin/super_admin?}
  L -- No --> E401[Generic 401]
  L -- Yes --> MF{MFA enabled?}
  MF -- Yes --> T{TOTP or recovery code valid<br/>and not replayed?}
  T -- No --> E401
  T -- Yes --> SES
  MF -- No --> SA{Super admin?}
  SA -- Yes --> ENR[Forced to /admin/mfa enrolment] --> SES
  SA -- No --> SES[Admin session qs_admin<br/>12 h, 2 h idle, SameSite=Strict]
  SES --> W{Which setting?}
  W -- General / branding --> BR[Edit draft, validate colours & assets] --> PUB[Publish] --> AUD
  W -- Pricing plans --> SUP{Super admin?}
  SUP -- No --> F403[403]
  SUP -- Yes --> PL[Create / edit plan, sync<br/>Razorpay provider plan] --> AUD
  W -- Payment credentials --> RA{Re-authenticated in<br/>last 15 min?}
  RA -- No --> RE[Confirm password + TOTP] --> RA
  RA -- Yes --> SEAL[Seal secrets with AES-256-GCM<br/>SETTINGS_ENCRYPTION_KEY] --> VER[Verify via read-only API call] --> AUD
  AUD[Write AuditLog entry<br/>field names only, no secrets] --> E([End])`
},
{
  file: "conceptual-model.mmd", fig: "4.14", title: "Conceptual data model (entity groups)",
  src: `flowchart LR
  subgraph Identity["Identity & security"]
    U[User] --- S[Session]
    U --- R[MfaRecoveryCode]
    U --- PRS[PasswordReset]
    AL[AuditLog]
    RL[RateLimit]
  end
  subgraph QR["QR codes & analytics"]
    Q[QrCode] --- SC[Scan]
    Q --- DL[Download]
    UP[Upload]
    AR[AbuseReport]
  end
  subgraph INV["Products & inventory"]
    P[Product] --- B[Barcode]
    P --- IT[InventoryTransaction]
  end
  subgraph BILL["Billing"]
    PP[PricingPlan] --- PV[ProviderPlan]
    SB[Subscription] --- PM[Payment]
    WE[WebhookEvent]
  end
  subgraph CFG["Configuration & logs"]
    ST[Setting]
    BA[BrandAsset]
    LG[Log]
  end
  U --- Q
  U --- UP
  U --- P
  U --- SB
  U --- PM`
},
{
  file: "database-erd.mmd", fig: "4.15", title: "Entity-relationship overview (15 related models; 7 standalone models listed in Table 4.6)",
  src: `erDiagram
  User ||--o{ Session : "has"
  User ||--o{ MfaRecoveryCode : "has"
  User ||--o{ PasswordReset : "requests"
  User ||--o{ QrCode : "owns"
  User ||--o{ Download : "records"
  User ||--o{ Upload : "stores"
  User ||--o{ Payment : "pays"
  User ||--o{ Subscription : "subscribes"
  User ||--o{ Product : "owns"
  User ||--o{ Barcode : "owns"
  User ||--o{ InventoryTransaction : "performs"
  QrCode ||--o{ Scan : "receives"
  QrCode |o--o{ Download : "exported as"
  Product ||--o{ Barcode : "identified by"
  Product ||--o{ InventoryTransaction : "ledger"
  Subscription |o--o{ Payment : "charges"
  PricingPlan ||--o{ ProviderPlan : "synced as"
`
},
{
  file: "erd-accounts-qr.mmd", fig: "4.16", title: "ERD detail: accounts, sessions, QR codes and analytics",
  src: `erDiagram
  User {
    string id PK "cuid"
    string email UK
    string passwordHash "nullable, bcrypt"
    string googleId UK "nullable"
    string role "user|admin|super_admin"
    string plan "plan id"
    datetime planExpiresAt "nullable"
    string status "active|suspended"
    int sessionVersion
    string mfaSecret "nullable, AES-GCM"
    datetime mfaEnabledAt "nullable"
    int mfaLastStep
    int quotaLock
  }
  Session {
    string id PK
    string userId FK
    string kind "user|admin"
    boolean mfa
    datetime expiresAt
    datetime lastSeenAt
    datetime reauthAt "nullable"
  }
  MfaRecoveryCode {
    string id PK
    string userId FK
    string codeHash UK "SHA-256"
    datetime usedAt "nullable"
  }
  PasswordReset {
    string id PK
    string userId FK
    string tokenHash UK "SHA-256"
    datetime expiresAt
    datetime usedAt "nullable"
  }
  QrCode {
    string id PK
    string userId FK
    string type
    string content "JSON"
    string design "JSON"
    string payload
    boolean isDynamic
    boolean isHosted
    string shortCode UK "nullable"
    string destination "nullable"
    string status "active|paused|disabled"
    datetime expiresAt "nullable"
  }
  Scan {
    string id PK
    string qrId FK
    string device
    string browser
    string os
    string country
    string visitorHash
  }
  Download {
    string id PK
    string userId FK
    string qrId FK "nullable"
    string format
  }
  Upload {
    string id PK
    string userId FK
    string storedName UK
    string mime
    int size
  }
  User ||--o{ Session : has
  User ||--o{ MfaRecoveryCode : has
  User ||--o{ PasswordReset : requests
  User ||--o{ QrCode : owns
  User ||--o{ Download : records
  User ||--o{ Upload : stores
  QrCode ||--o{ Scan : receives
  QrCode |o--o{ Download : "exported as"`
},
{
  file: "erd-inventory.mmd", fig: "4.17", title: "ERD detail: products, barcodes and inventory ledger",
  src: `erDiagram
  User { string id PK }
  Product {
    string id PK
    string userId FK
    string name
    string sku "UK with userId"
    string productCode
    string category
    int priceMinor "paise"
    string currency
    int stock
    int lowStockAt
    string batch
    datetime expiryDate "nullable"
    string status "active|archived"
  }
  Barcode {
    string id PK
    string userId FK
    string productId FK
    string format "UK with userId, value"
    string value
    string lookupKey "indexed, GTIN-14"
    string source "internal|assigned|existing"
    boolean isPrimary
  }
  InventoryTransaction {
    string id PK
    string userId FK
    string productId FK
    string type "created|in|out|adjust|updated|archived|restored|imported"
    int quantity "signed delta"
    int balance "stock after"
    string note
    string reference
  }
  User ||--o{ Product : owns
  User ||--o{ Barcode : owns
  User ||--o{ InventoryTransaction : performs
  Product ||--o{ Barcode : "identified by"
  Product ||--o{ InventoryTransaction : ledger`
},
{
  file: "erd-billing.mmd", fig: "4.18", title: "ERD detail: pricing plans, subscriptions and payments",
  src: `erDiagram
  User { string id PK }
  PricingPlan {
    string id PK "e.g. pro"
    string name
    string currency
    int monthlyPrice "minor units"
    int annualPrice "minor units"
    string features "JSON"
    string limits "JSON entitlements"
    string status "draft|published|archived"
    int sortOrder
  }
  ProviderPlan {
    string id PK
    string planId FK
    string interval "month|year"
    int amount
    string mode "test|live"
    string providerPlanId UK
    boolean active
  }
  Subscription {
    string id PK
    string userId FK
    string planId "snapshot, no FK"
    string interval
    int amount
    string mode
    string providerSubscriptionId UK
    string status
    datetime currentPeriodEnd "nullable"
    boolean cancelAtPeriodEnd
  }
  Payment {
    string id PK
    string userId FK
    string subscriptionId FK "nullable"
    string providerRef UK
    string plan "snapshot"
    int amount
    string status
    int refundedAmount
  }
  WebhookEvent {
    string id PK
    string provider "UK with eventId"
    string eventId
    string eventType
    string status
  }
  PricingPlan ||--o{ ProviderPlan : "synced as"
  User ||--o{ Subscription : subscribes
  User ||--o{ Payment : pays
  Subscription |o--o{ Payment : charges`
},
{
  file: "class-diagram.mmd", fig: "4.19", title: "Class diagram: domain entities and server-side service modules",
  src: `classDiagram
  direction LR
  class User {
    <<entity>>
    +id: string
    +email: string
    +role: string
    +plan: string
    +status: string
    +sessionVersion: int
  }
  class QrCode {
    <<entity>>
    +type: string
    +payload: string
    +isDynamic: boolean
    +shortCode: string?
    +status: string
  }
  class Product {
    <<entity>>
    +sku: string
    +stock: int
    +lowStockAt: int
  }
  class Barcode {
    <<entity>>
    +format: string
    +value: string
    +lookupKey: string
  }
  class Subscription {
    <<entity>>
    +status: string
    +currentPeriodEnd: Date?
  }
  class SessionModule {
    <<module lib/session.ts>>
    +createSession(user, kind, mfa)
    +getUser() User?
    +getAdmin()
    +requireUser() User
    +requireAdmin(opts) User
    +requireRecentAdminAuth(opts)
    +revokeAllSessions(userId)
  }
  class QrService {
    <<module lib/qr-service.ts>>
    +createQr(user, input, base)
    +updateQr(user, qr, input, base)
    +duplicateQr(user, qr, base)
    +withUtm(destination, utm) string
  }
  class ProductsModule {
    <<module lib/products.ts>>
    +createProduct(user, raw)
    +updateProduct(user, id, raw)
    +moveStock(user, id, input)
    +lookupProduct(userId, code)
  }
  class Entitlements {
    <<module lib/entitlements.ts>>
    +withQuota(userId, fn)
    +assertQrQuota(tx, userId, plan, kind)
    +assertProductQuota(tx, userId, plan)
    +requireFeature(user, feature)
  }
  class Billing {
    <<module lib/billing.ts>>
    +startSubscription(user, planId, interval)
    +confirmCheckout(user, input)
    +handleRazorpayWebhook(raw, sig, id)
    +cancelSubscriptionFor(userId, opts)
  }
  class RazorpayClient {
    <<module lib/razorpay.ts>>
    +createSubscription(creds, s)
    +fetchPayment(creds, id)
    +verifySubscriptionSignature()
    +verifyWebhookSignature()
  }
  class BarcodesModule {
    <<module lib/barcodes.ts>>
    +validateBarcode(format, input)
    +renderBarcodeSvg(format, value)
    +lookupKey(format, value)
  }
  User "1" --> "*" QrCode : owns
  User "1" --> "*" Product : owns
  Product "1" --> "*" Barcode : has
  User "1" --> "*" Subscription : has
  QrService ..> Entitlements : uses
  ProductsModule ..> Entitlements : uses
  ProductsModule ..> BarcodesModule : validates with
  Billing ..> RazorpayClient : calls
  QrService ..> QrCode : persists
  ProductsModule ..> Product : persists
  Billing ..> Subscription : persists
  SessionModule ..> User : loads`
},
{
  file: "login-sequence.mmd", fig: "4.20", title: "Sequence diagram: workspace login and administrator MFA login",
  src: `sequenceDiagram
  autonumber
  actor U as User / Admin
  participant B as Browser
  participant MW as middleware.ts
  participant L as /api/auth/login or /api/admin/auth/login
  participant AF as lib/auth-flow.ts
  participant RL as lib/rate-limit.ts
  participant DB as Prisma + DB
  U->>B: enter e-mail and password
  B->>MW: POST (Origin header)
  MW->>MW: origin in allowedOrigins?
  alt cross-site
    MW-->>B: 403 Cross-site request blocked
  end
  MW->>L: forward
  L->>AF: verifyCredentials(email, password, scope)
  AF->>RL: per-IP, per-account, global limits
  RL-->>AF: ok or 429
  AF->>DB: findUnique(User by email)
  alt unknown account or wrong password
    AF->>DB: AuditLog login_failed
    AF-->>L: ApiError 401 (generic)
    L-->>B: 401 Incorrect email or password
  else valid and active
    AF-->>L: user
    alt workspace login
      L->>DB: create Session(kind=user)
      L-->>B: 200 + Set-Cookie qs_session (HttpOnly, SameSite=Lax)
    else admin login with MFA enabled
      L-->>B: 200 {mfaRequired, ticket (5 min)}
      U->>B: enter TOTP code
      B->>L: POST /api/admin/auth/mfa {ticket, code}
      L->>DB: updateMany(mfaLastStep < step) replay guard
      L->>DB: create Session(kind=admin, mfa=true), AuditLog
      L-->>B: 200 + Set-Cookie qs_admin (SameSite=Strict)
    end
  end`
},
{
  file: "qr-generation-sequence.mmd", fig: "4.21", title: "Sequence diagram: saving a dynamic QR code",
  src: `sequenceDiagram
  autonumber
  actor U as User
  participant W as Workbench (client)
  participant R as qr-render.ts (client)
  participant API as POST /api/qrcodes
  participant S as lib/session.ts
  participant Q as lib/qr-service.ts
  participant E as lib/entitlements.ts
  participant DB as Prisma + DB
  U->>W: choose type, enter content, style
  W->>R: renderQr(payload, design)
  R-->>W: SVG preview
  U->>W: Save (dynamic)
  W->>API: JSON {name, type, content, design, dynamic, alias?}
  API->>S: requireUser()
  S->>DB: Session + User lookup
  S-->>API: user (or 401)
  API->>API: rateLimit 300/h, readJson(createSchema)
  API->>Q: createQr(user, input, base)
  Q->>Q: validateContent(type), decide dynamic/hosted
  Q->>DB: check shortCode / alias uniqueness
  Q->>E: withQuota(userId)
  E->>DB: BEGIN tx, increment User.quotaLock (row lock)
  E->>DB: COUNT QrCode by kind vs plan limits
  alt over limit
    E-->>API: ApiError 403
    API-->>W: 403 plan limit message
  else within limit
    E->>DB: INSERT QrCode, COMMIT
    Q-->>API: QrCode row
    API->>DB: Log qr.created
    API-->>W: 201 {item: payload = base/r/code}
  end`
},
{
  file: "product-create-sequence.mmd", fig: "4.22", title: "Sequence diagram: database-backed product creation",
  src: `sequenceDiagram
  autonumber
  actor U as User
  participant F as Product editor (client)
  participant API as POST /api/products
  participant P as lib/products.ts
  participant BC as lib/barcodes.ts
  participant E as lib/entitlements.ts
  participant DB as Prisma + DB
  U->>F: fill product form + barcodes
  F->>API: JSON body
  API->>API: requireUser()
  API->>P: createProduct(user, body)
  P->>P: productInput.safeParse
  alt invalid
    P-->>API: ApiError 400
    API-->>F: 400 first validation message
  end
  P->>BC: validateBarcode + renderBarcodeSvg (each)
  BC-->>P: normalised value, lookupKey
  P->>DB: findFirst SKU / lookupKey for user
  alt duplicate
    P-->>API: ApiError 409
    API-->>F: 409 already used by ...
  end
  P->>E: withQuota(userId)
  E->>DB: lock quota row, count products / barcodes
  E->>DB: INSERT Product + Barcodes + InventoryTransaction(created)
  DB-->>P: product with barcodes
  P-->>API: product
  API->>DB: Log product.created
  API-->>F: 201 {item}`
},
{
  file: "admin-config-sequence.mmd", fig: "4.23", title: "Sequence diagram: super administrator saves payment-gateway credentials",
  src: `sequenceDiagram
  autonumber
  actor SA as Super admin
  participant UI as /admin/settings/payments
  participant API as /api/admin/payments/config
  participant S as lib/session.ts
  participant PC as lib/payment-config.ts
  participant SB as lib/secret-box.ts
  participant RZ as Razorpay API
  participant DB as Prisma + DB
  SA->>UI: enter Key ID, Key Secret, Webhook Secret
  UI->>API: PUT {mode, keyId, keySecret, webhookSecret}
  API->>S: requireRecentAdminAuth({superAdmin})
  alt last sign-in or reauth older than 15 min
    S-->>UI: 403 reauthRequired
    SA->>UI: confirm password + TOTP
    UI->>API: POST /api/admin/auth/reauth
    API->>DB: Session.reauthAt = now
    UI->>API: PUT again
  end
  API->>PC: saveCredentials(input)
  PC->>SB: seal(secret, purpose) AES-256-GCM
  PC->>DB: upsert Setting rows (ciphertext)
  API->>DB: AuditLog credentials_updated (field names only)
  API-->>UI: 200 status (no secrets returned)
  SA->>UI: Test connection
  UI->>API: POST {action: verify, mode}
  API->>RZ: GET /v1/plans?count=1 (read-only)
  RZ-->>API: 200 or 401
  API->>DB: store verification status, AuditLog
  API-->>UI: verified / invalid`
},
{
  file: "payment-sequence.mmd", fig: "4.24", title: "Sequence diagram: subscription checkout, verification and webhook",
  src: `sequenceDiagram
  autonumber
  actor U as User
  participant B as Browser + Razorpay Checkout
  participant API as /api/billing/*
  participant BL as lib/billing.ts
  participant RZ as Razorpay API
  participant DB as Prisma + DB
  U->>B: choose plan and interval
  B->>API: POST /subscribe {planId, interval}
  API->>BL: startSubscription()
  BL->>DB: plan, live subscription, active ProviderPlan
  BL->>RZ: POST /v1/subscriptions
  RZ-->>BL: subscription id
  BL->>DB: INSERT Subscription(status=created)
  API-->>B: checkout parameters
  B->>RZ: customer pays in Checkout
  RZ-->>B: payment_id, subscription_id, signature
  B->>API: POST /verify
  API->>BL: confirmCheckout()
  BL->>BL: HMAC-SHA256(payment|subscription, key secret)
  BL->>RZ: GET payment, GET subscription
  alt captured and amount matches
    BL->>DB: tx: Payment paid, Subscription active, User.plan
    API-->>B: {status: active}
  else not captured yet
    API-->>B: {status: pending}
  end
  RZ->>API: POST /webhook (x-razorpay-signature)
  API->>BL: handleRazorpayWebhook(raw, sig, eventId)
  BL->>BL: verify HMAC over raw body
  BL->>DB: WebhookEvent seen?
  alt duplicate
    API-->>RZ: 200 duplicate
  else new
    BL->>DB: apply event idempotently, record WebhookEvent
    API-->>RZ: 200 processed
  end`
},
{
  file: "component-diagram.mmd", fig: "4.25", title: "Component diagram",
  src: `flowchart LR
  subgraph UI["Presentation components (src/components, src/app)"]
    WB["QR Workbench<br/>qr/workbench, type-form,<br/>design-panel, export-panel"]
    BG["Barcode generator<br/>barcode/*"]
    SCN["Universal scanner<br/>scanner/scanner.tsx"]
    PRD["Products & inventory views"]
    ANA["Analytics views<br/>recharts"]
    ADM["Admin console<br/>admin-shell, *-view.tsx"]
    SHELL["App shell, command palette,<br/>providers (theme)"]
  end
  subgraph ISO["Isomorphic libraries"]
    QT["qr-types.ts (27 types)"]
    QRR["qr-render.ts"]
    BAR["barcodes.ts (23 formats)"]
    UPI["upi.ts, content-safety.ts"]
    PLN["plans.ts, branding.ts"]
  end
  subgraph SRV["Server libraries (src/lib)"]
    SES["session.ts, guard.ts, roles.ts"]
    API["api.ts (handle, readJson)"]
    QS["qr-service.ts, scans.ts"]
    PS["products.ts"]
    ENT["entitlements.ts, plan-store.ts"]
    BIL["billing.ts, razorpay.ts,<br/>payment-config.ts"]
    SECM["rate-limit, audit, redact,<br/>mfa, secret-box"]
    STO["storage.ts, image-check.ts"]
    DBM["db.ts (PrismaClient)"]
  end
  WB --> QT
  WB --> QRR
  BG --> BAR
  SCN --> UPI
  SCN --> BAR
  ADM --> PLN
  WB -->|fetch /api/qrcodes| API
  PRD -->|fetch /api/products| API
  ADM -->|fetch /api/admin/*| API
  API --> SES
  API --> QS
  API --> PS
  API --> BIL
  QS --> QT
  QS --> ENT
  PS --> BAR
  PS --> ENT
  BIL --> ENT
  SES --> DBM
  QS --> DBM
  PS --> DBM
  BIL --> DBM
  ENT --> DBM
  API --> SECM
  API --> STO`
},
{
  file: "deployment-diagram.mmd", fig: "4.26", title: "Deployment diagram: verified development set-up and recommended production topology",
  src: `flowchart LR
  subgraph DEV["Development workstation (verified)"]
    D1["Node.js 22 + npm 10"]
    D2["next dev :3000"]
    D3[("prisma/dev.db<br/>SQLite file")]
    D4["./uploads"]
    D1 --> D2 --> D3
    D2 --> D4
  end
  subgraph CI["GitHub Actions CI (defined in .github/workflows/ci.yml)"]
    C1["quality job: typecheck, lint,<br/>unit, build, API/admin/browser tests"]
    C2["mysql job: MySQL 8.4 service<br/>migrations + data migration test"]
  end
  subgraph PROD["Production (RECOMMENDED - not verified as deployed)"]
    RP["Reverse proxy<br/>nginx / Caddy, TLS"]
    APP1["next start<br/>(process manager)"]
    APP2["next start<br/>(optional 2nd instance)"]
    MY[("MySQL 8<br/>least-privilege user")]
    VOL["Persistent volume<br/>UPLOAD_DIR"]
    RP --> APP1
    RP -.-> APP2
    APP1 --> MY
    APP2 -.-> MY
    APP1 --> VOL
  end
  EXT["Razorpay, Google OAuth, SMTP"]
  INTERNET(("Internet users")) --> RP
  APP1 -.-> EXT
  EXT -.->|webhook| RP`
},
];

export const PUML = {
"use-case-diagram.puml": `@startuml
' Figure 4.2 (PlantUML source). Not rendered locally: no Java/PlantUML runtime was available.
left to right direction
skinparam packageStyle rectangle
actor "Visitor" as V
actor "Registered user" as U
actor "Admin" as A
actor "Super admin" as SA
actor "Razorpay" as RZ <<system>>
SA -|> A
rectangle "QRSathi" {
  usecase "Sign up / sign in" as UC1
  usecase "Reset password" as UC2
  usecase "Generate static QR" as UC3
  usecase "Create dynamic QR / hosted page" as UC4
  usecase "Generate barcodes & labels" as UC5
  usecase "Scan QR / barcode" as UC6
  usecase "Manage products & barcodes" as UC7
  usecase "Record stock movement" as UC8
  usecase "Bulk generate / import" as UC9
  usecase "View analytics / export" as UC10
  usecase "Subscribe to paid plan" as UC11
  usecase "Open dynamic QR" as UC12
  usecase "Report abusive QR" as UC13
  usecase "Moderate users, codes, reports" as UC14
  usecase "Edit settings & branding" as UC15
  usecase "Manage plans & pricing" as UC16
  usecase "Manage roles, payment credentials, delete accounts" as UC17
  usecase "Enrol TOTP MFA" as UC18
  usecase "Deliver payment webhook" as UC19
}
V --> UC12
V --> UC13
V --> UC6
U --> UC1
U --> UC2
U --> UC3
U --> UC4
U --> UC5
U --> UC6
U --> UC7
U --> UC8
U --> UC9
U --> UC10
U --> UC11
A --> UC14
A --> UC15
A --> UC18
SA --> UC16
SA --> UC17
RZ --> UC19
UC11 ..> UC19 : <<include>>
@enduml
`,
"deployment-diagram.puml": `@startuml
' Figure 4.26 (PlantUML source). Production nodes are RECOMMENDED, not verified as deployed.
node "Developer workstation" {
  component "next dev :3000" as DEV
  database "SQLite prisma/dev.db" as SQ
  folder "uploads/" as UPD
}
DEV --> SQ
DEV --> UPD
node "Production server (recommended)" {
  component "Reverse proxy (TLS)" as RP
  component "next start (Node 22)" as APP
  folder "UPLOAD_DIR volume" as VOL
}
database "MySQL 8 (recommended)" as MY
cloud "Razorpay / Google / SMTP" as EXT
actor "Internet user" as USR
USR --> RP
RP --> APP
APP --> MY
APP --> VOL
APP ..> EXT
EXT ..> RP : webhook
@enduml
`,
"login-sequence.puml": `@startuml
' PlantUML equivalent of Figure 4.20 (workspace login).
actor User
participant Browser
participant "middleware.ts" as MW
participant "/api/auth/login" as L
participant "auth-flow.ts" as AF
database DB
User -> Browser : e-mail + password
Browser -> MW : POST with Origin
MW -> L : origin allowed
L -> AF : verifyCredentials()
AF -> DB : find user
alt invalid
  AF -> DB : AuditLog login_failed
  L --> Browser : 401 generic error
else valid
  L -> DB : create Session(kind=user)
  L --> Browser : 200 + qs_session cookie
end
@enduml
`,
};
