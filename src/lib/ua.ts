/** Minimal user-agent classifier: device category, browser family, OS family. */
export interface UaInfo {
  device: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  browser: string;
  os: string;
}

const BOT_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|preview|curl|wget|python-requests|httpclient|headless|lighthouse|monitor|discord|skype|linkedinbot|embedly|quora link|pinterest|vkshare|w3c_validator/i;

export function parseUa(ua: string | null | undefined): UaInfo {
  const s = ua || "";
  if (!s) return { device: "unknown", browser: "unknown", os: "unknown" };
  if (BOT_RE.test(s)) return { device: "bot", browser: "bot", os: "unknown" };

  let os = "Other";
  if (/android/i.test(s)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(s)) os = "iOS";
  else if (/windows nt/i.test(s)) os = "Windows";
  else if (/mac os x|macintosh/i.test(s)) os = "macOS";
  else if (/cros/i.test(s)) os = "ChromeOS";
  else if (/linux/i.test(s)) os = "Linux";

  let browser = "Other";
  if (/edg(e|a|ios)?\//i.test(s)) browser = "Edge";
  else if (/samsungbrowser/i.test(s)) browser = "Samsung Internet";
  else if (/opr\/|opera/i.test(s)) browser = "Opera";
  else if (/ucbrowser/i.test(s)) browser = "UC Browser";
  else if (/firefox|fxios/i.test(s)) browser = "Firefox";
  else if (/chrome|crios/i.test(s)) browser = "Chrome";
  else if (/safari/i.test(s)) browser = "Safari";
  // In-app browsers from QR scanner apps / social apps
  if (/instagram/i.test(s)) browser = "Instagram app";
  else if (/fban|fbav/i.test(s)) browser = "Facebook app";

  let device: UaInfo["device"] = "desktop";
  if (/ipad|tablet|(android(?!.*mobile))/i.test(s)) device = "tablet";
  else if (/mobi|iphone|ipod|android/i.test(s)) device = "mobile";

  return { device, browser, os };
}
