// Long flowcharts split into parts (a)/(b) so they stay legible on A4. Replaces the single-file versions.
export const REPLACED = ["authorization-flowchart.mmd", "qr-generation-flowchart.mmd", "barcode-flowchart.mmd", "product-inventory-flowchart.mmd", "dynamic-qr-resolution-flowchart.mmd", "subscription-payment-flowchart.mmd"];
export const SPLIT = [
{ file: "authorization-flowchart-a.mmd", fig: "4.7(a)", title: "Flowchart: request authorization, part (a) — CSRF check and workspace guard",
  src: `flowchart TD
  S([Request arrives]) --> M{API path and method<br/>not GET/HEAD/OPTIONS?}
  M -- No --> H
  M -- Yes --> WH{Webhook path?}
  WH -- Yes --> H
  WH -- No --> OR{Origin in allowed<br/>origins?}
  OR -- No --> F403[403 cross-site blocked]
  OR -- Yes --> H[Route handler]
  H --> K{Guard used}
  K -- requireAdmin --> ADM([Continue in part b])
  K -- requireUser --> T1{qs_session JWT valid<br/>and Session row exists?}
  T1 -- No --> F401[401 sign in]
  T1 -- Yes --> T2{User active and<br/>sessionVersion matches?}
  T2 -- No --> F401
  T2 -- Yes --> OWN{Resource owned<br/>by user?}
  OWN -- No --> F404[404 not found]
  OWN -- Yes --> OK([Execute business logic])` },
{ file: "authorization-flowchart-b.mmd", fig: "4.7(b)", title: "Flowchart: request authorization, part (b) — administrator guard",
  src: `flowchart TD
  S([requireAdmin]) --> A1{qs_admin valid, admin role,<br/>idle under 2 h?}
  A1 -- No --> F401A[401 administrator sign-in]
  A1 -- Yes --> A2{MFA enabled but session<br/>not MFA-verified?}
  A2 -- Yes --> F401A
  A2 -- No --> A3{Super admin<br/>without MFA?}
  A3 -- Yes --> F403M[403 enable 2FA]
  A3 -- No --> A4{Endpoint requires<br/>super admin?}
  A4 -- Yes, role is admin --> F403S[403 super admin required]
  A4 -- No / satisfied --> A5{Sensitive action:<br/>re-auth older than 15 min?}
  A5 -- Yes --> F403R[403 reauth required]
  A5 -- No --> OK([Execute admin action])` },
{ file: "qr-generation-flowchart-a.mmd", fig: "4.8(a)", title: "Flowchart: QR generation, part (a) — in the browser",
  src: `flowchart TD
  S([Start]) --> T[Choose QR type<br/>and fill form]
  T --> CV{zod validation<br/>passes?}
  CV -- No --> FE[Show field errors] --> T
  CV -- Yes --> D[Customise design: colours,<br/>modules, logo, frame]
  D --> PR[Render SVG preview<br/>lib/qr-render.ts]
  PR --> W{Contrast or<br/>logo warnings?}
  W -- Yes --> D
  W -- No --> CH{Save to account?}
  CH -- No --> EX[Export PNG / JPG / SVG / PDF] --> E([End])
  CH -- Yes --> P2([Continue in part b])` },
{ file: "qr-generation-flowchart-b.mmd", fig: "4.8(b)", title: "Flowchart: QR generation, part (b) — saving on the server",
  src: `flowchart TD
  S([Save requested]) --> AU{Signed in?}
  AU -- No --> LG[Redirect to login] --> E([End])
  AU -- Yes --> POST[POST /api/qrcodes]
  POST --> SV{Server validation OK?}
  SV -- No --> E400[400 error shown] --> E
  SV -- Yes --> DY{Dynamic or hosted?}
  DY -- Yes --> SC[Allocate short code or alias<br/>payload = base/r or /p/code]
  DY -- No --> PL[payload = encoded content]
  SC --> Q{Within plan quota?<br/>withQuota transaction}
  PL --> Q
  Q -- No --> E403[403 plan limit] --> E
  Q -- Yes --> INS[Insert QrCode row] --> OK([201 Created])` },
{ file: "barcode-flowchart-a.mmd", fig: "4.9(a)", title: "Flowchart: barcode generation",
  src: `flowchart TD
  S([Start]) --> F[Select format, e.g. EAN-13,<br/>Code 128, Data Matrix]
  F --> V[Enter value]
  V --> VAL{validateBarcode: characters,<br/>length, check digit}
  VAL -- Invalid --> ERR[Explain the rule] --> V
  VAL -- Valid --> R[bwip-js renders SVG]
  R --> L{Label needed?}
  L -- Yes --> LB[Compose label: size,<br/>product name, price] --> X
  L -- No --> X[Export PNG / SVG / PDF]
  X --> E([End])` },
{ file: "barcode-flowchart-b.mmd", fig: "4.9(b)", title: "Flowchart: barcode and QR scanning",
  src: `flowchart TD
  S([Start]) --> SRC{Camera or image?}
  SRC --> DEC[zxing-wasm decodes<br/>in the browser]
  DEC --> FOUND{Code detected?}
  FOUND -- No --> RETRY[Hint: light, focus, distance] --> SRC
  FOUND -- Yes --> CL[Classify content and run<br/>safety heuristics]
  CL --> HIS[Save to on-device history]
  HIS --> LK{Signed in and<br/>product code?}
  LK -- No --> E([End])
  LK -- Yes --> API[GET /api/products/lookup<br/>read-only]
  API --> M{Match by lookupKey<br/>or SKU?}
  M -- Yes --> SHOW[Show product and<br/>stock actions] --> E
  M -- No --> NEW[Offer to create product] --> E` },
{ file: "product-inventory-flowchart-a.mmd", fig: "4.10(a)", title: "Flowchart: product creation",
  src: `flowchart TD
  S([Start]) --> NP[Enter product: name, SKU, price,<br/>stock, low-stock level, barcodes]
  NP --> V{Product schema valid?}
  V -- No --> E400[400 validation error] --> NP
  V -- Yes --> BC{Barcodes valid? Internal<br/>GTIN uses prefix 20-29?}
  BC -- No --> E400
  BC -- Yes --> U{SKU and barcodes unique<br/>for this user?}
  U -- No --> E409[409 duplicate] --> NP
  U -- Yes --> Q{Product and barcode<br/>quota OK?}
  Q -- No --> E403[403 plan limit] --> E([End])
  Q -- Yes --> C[Create Product + Barcodes +<br/>ledger entry 'created'] --> E` },
{ file: "product-inventory-flowchart-b.mmd", fig: "4.10(b)", title: "Flowchart: stock movement",
  src: `flowchart TD
  S([Movement requested]) --> AR{Product archived?}
  AR -- Yes --> E400a[400 restore first] --> E([End])
  AR -- No --> MV{Movement type}
  MV -- in --> IN[stock += qty]
  MV -- out --> OUT{stock >= qty?<br/>conditional update}
  OUT -- No --> E400b[400 not enough stock] --> E
  OUT -- Yes --> DEC[stock -= qty]
  MV -- adjust --> ADJ[stock = counted qty]
  IN --> LOG[Append InventoryTransaction<br/>signed delta + balance]
  DEC --> LOG
  ADJ --> LOG
  LOG --> LOW{stock <= lowStockAt?}
  LOW -- Yes --> FLAG[Show low-stock flag] --> E
  LOW -- No --> E` },
{ file: "dynamic-qr-resolution-flowchart-a.mmd", fig: "4.11(a)", title: "Flowchart: dynamic QR resolution, part (a) — status checks",
  src: `flowchart TD
  S([GET /r/code]) --> F{shortCode exists<br/>and isDynamic?}
  F -- No --> N404[404 not found page]
  F -- Yes --> H{isHosted?}
  H -- Yes --> P[302 to /p/code]
  H -- No --> D{Disabled or owner<br/>suspended?}
  D -- Yes --> G410a[410 disabled]
  D -- No --> PA{Paused?}
  PA -- Yes --> G410b[410 paused]
  PA -- No --> EX{Expired?}
  EX -- Yes --> G410c[410 expired]
  EX -- No --> DS{Destination set?}
  DS -- No --> N404b[404 no destination]
  DS -- Yes --> B([Continue in part b])` },
{ file: "dynamic-qr-resolution-flowchart-b.mmd", fig: "4.11(b)", title: "Flowchart: dynamic QR resolution, part (b) — scan recording and redirect",
  src: `flowchart TD
  S([Valid destination]) --> BOT{User agent<br/>is a bot?}
  BOT -- Yes --> RD
  BOT -- No --> RL{Under 20 scans per client<br/>per 10 min?}
  RL -- No --> RD
  RL -- Yes --> DNT{DNT / GPC or<br/>tracking off?}
  DNT -- Yes --> CNT[Insert count-only Scan] --> RD
  DNT -- No --> DET[Insert Scan: device, browser,<br/>OS, country, salted daily hash] --> RD
  RD[Append UTM; 302 redirect<br/>no-store, no-referrer] --> E([End])` },
{ file: "subscription-payment-flowchart-a.mmd", fig: "4.12(a)", title: "Flowchart: subscription checkout, part (a) — starting checkout",
  src: `flowchart TD
  S([User selects plan<br/>and interval]) --> CR{Checkout enabled,<br/>credentials verified?}
  CR -- No --> E503[503 unavailable]
  CR -- Yes --> PP{Plan published, paid,<br/>interval offered?}
  PP -- No --> E404[404 / 400]
  PP -- Yes --> LV{Live subscription<br/>already exists?}
  LV -- Yes --> E409[409 cancel first]
  LV -- No --> PRV{Active ProviderPlan for<br/>price, currency, mode?}
  PRV -- No --> E409b[409 not ready]
  PRV -- Yes --> RS[Create Razorpay subscription;<br/>store Subscription 'created']
  RS --> CO([Razorpay Checkout<br/>continues in part b])` },
{ file: "subscription-payment-flowchart-b.mmd", fig: "4.12(b)", title: "Flowchart: subscription checkout, part (b) — confirmation",
  src: `flowchart TD
  S([Checkout returns ids<br/>and signature]) --> SIG{HMAC-SHA256<br/>signature valid?}
  SIG -- No --> E400[400 cannot verify]
  SIG -- Yes --> FP[Fetch payment and subscription<br/>from Razorpay]
  FP --> CAP{Captured with matching<br/>amount and currency?}
  CAP -- Mismatch --> E400b[400; plan unchanged]
  CAP -- Not yet --> PEN[Status pending]
  CAP -- Yes --> APP[Payment paid, Subscription active,<br/>user.plan upgraded]
  PEN --> WH[Signed webhook arrives]
  WH --> DUP{Event id already<br/>in WebhookEvent?}
  DUP -- Yes --> IGN[200 duplicate, no change]
  DUP -- No --> APP
  APP --> E([Active until period end])` },
];
