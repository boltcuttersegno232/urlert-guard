import type { DomainClassification } from "$lib/api";

/**
 * Safety Context Builder (extension variant — no threat-scan data)
 *
 * Three independent dimensions:
 * 1. TRUST  — Do we trust this platform? (rank + age)
 * 2. RISKS  — Inherent platform risks (functions)
 * 3. SAFETY — Combined safety level for the UI
 *
 * Logic ported from urlert.com/safety-context.ts (minus threat-scan paths).
 */

// ── Exported types ─────────────────────────────────────────────────────────────

export type TrustLevel  = "high" | "moderate" | "low";
export type SafetyLevel = "standard" | "caution" | "high-risk";
export type ThreatLevel = "safe" | "danger" | "warn" | "neutral"; // icon dot colour

export interface TrustSignal {
  text: string;
  sentiment: "positive" | "neutral" | "warning";
}

export interface RiskFactor {
  type: string;
  label: string;
  description: string;
}

export interface TrustAssessment {
  level: TrustLevel;
  label: string;
  reason: string;
  signals: TrustSignal[];
}

export interface OverlaySafetyContext {
  trustLevel: TrustLevel;
  trustLabel: string;
  trustSignals: TrustSignal[];
  /** Plain-English summary of why trust is what it is. */
  trustSummary: string;
  safetyLevel: SafetyLevel;
  /** Specific label e.g. "Caution: User-Generated Content" */
  safetyLabel: string;
  risks: RiskFactor[];
  /** Plain-English context for why these risks matter. */
  riskSummary: string;
  /** Actionable advice for the user based on the safety posture. */
  safetyAdvice: string;
  threatLevel: ThreatLevel;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

type RankTier = "elite" | "high" | "moderate" | "low";
type AgeTier  = "established" | "young" | "new" | "unknown";

function calculateDomainAgeInDays(createdAt: string | null | undefined): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return null;
  const ageMs = Date.now() - created.getTime();
  if (ageMs < 0) return null;
  return Math.floor(ageMs / (24 * 60 * 60 * 1000));
}

function formatAge(days: number): string {
  if (days < 1) {
    return "less than 1 day old";
  }
  if (days < 30) {
    return `${days} day${days === 1 ? "" : "s"} old`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    if (months <= 1) return "1 month old";
    return `${months} months old`;
  }
  const years = Math.floor(days / 365.25);
  if (years === 1) return "1 year old";
  return `${years} years old`;
}

function getRankTier(rank: number | null | undefined): RankTier {
  if (!rank) return "low";
  if (rank <= 1_000)     return "elite";
  if (rank <= 100_000)   return "high";
  if (rank <= 1_000_000) return "moderate";
  return "low";
}

function getAgeTier(ageDays: number | null): AgeTier {
  if (ageDays === null) return "unknown";
  if (ageDays >= 3 * 365.25) return "established";
  if (ageDays >= 365.25) return "young";
  return "new";
}

// ── Trust assessment ──────────────────────────────────────────────────────────

/**
 * Trust Matrix (matches urlert.com exactly):
 * | Rank     | Age  | → Trust   |
 * | Elite    | Any  | high      |
 * | High     | ≥1y  | high      |
 * | High     | <1y  | moderate  |
 * | Moderate | ≥3y  | moderate  |
 * | Moderate | <3y  | low       |
 * | Low      | Any  | low       |
 */
export function assessTrust(
  rank: number | null | undefined,
  ageDays: number | null,
  isVerified: boolean = false,
): TrustAssessment {
  const rankTier = getRankTier(rank);
  const ageTier  = getAgeTier(ageDays);
  const signals: TrustSignal[] = [];

  // Rank signal
  if (rankTier === "elite") {
    signals.push({ text: "Top 1,000 global website", sentiment: "positive" });
  } else if (rankTier === "high") {
    signals.push({ text: "Top 100,000 global website", sentiment: "positive" });
  } else if (rankTier === "moderate" && rank) {
    signals.push({ text: `Ranked #${rank.toLocaleString()} globally`, sentiment: "neutral" });
  } else {
    signals.push({ text: "No significant traffic ranking", sentiment: "warning" });
  }

  // Age signal
  if (ageTier === "established") {
    signals.push({ text: formatAge(ageDays!), sentiment: "positive" });
  } else if (ageTier === "young") {
    signals.push({ text: formatAge(ageDays!), sentiment: "neutral" });
  } else if (ageTier === "new") {
    // Treat as "warning" sentiment, and if < 90 days it will be elevated to high-risk in safety level
    signals.push({ text: formatAge(ageDays!), sentiment: "warning" });
  } else {
    signals.push({ text: "Unknown registration date", sentiment: "warning" });
  }

  const reason = signals.map((s) => s.text).join(", ");

  if (rankTier === "elite") {
    return { level: "high", label: "Highly Established", reason, signals };
  }

  if (rankTier === "high") {
    if (ageTier === "established" || ageTier === "young") {
      return { level: "high",     label: "Well Established", reason, signals };
    }
    return   { level: "moderate", label: "Established Site",  reason, signals };
  }

  if (rankTier === "moderate") {
    if (ageTier === "established") return { level: "moderate", label: "Known Site",      reason, signals };
    if (isVerified)                return { level: "moderate", label: "Limited History", reason, signals };
    return                                 { level: "low",      label: "Limited History", reason, signals };
  }

  const label =
    ageTier === "new"     ? "Newly Registered" :
    ageTier === "young"   ? "Recently Established" :
    ageTier === "unknown" ? "Not Well Known" :
    "Low Traffic";

  return { level: isVerified ? "moderate" : "low", label, reason: reason || "Limited public information available", signals };
}

// ── Risk factors ──────────────────────────────────────────────────────────────

export function collectRisks(
  domain: string,
  operator: string,
  f: DomainClassification["functions"],
): RiskFactor[] {
  if (!f) return [];
  const risks: RiskFactor[] = [];

  if (f.is_crypto_platform) risks.push({
    type: "crypto", label: "Cryptocurrency Platform",
    description: "This platform handles cryptocurrency transactions. Crypto transfers cannot be reversed once sent, making it a prime target for phishing. Always verify the exact official URL before entering credentials or approving transactions.",
  });
  if (f.is_url_shortener) risks.push({
    type: "url-shortener", label: "URL Shortener",
    description: "This service converts URLs into short codes that hide the actual destination. Use a URL expander tool or hover to preview where a link actually leads before clicking.",
  });
  if (f.is_file_host) risks.push({
    type: "file-host", label: "File Hosting",
    description: "Files here are uploaded by users, not the platform operator. Scan any download with antivirus software and only download from sources you trust.",
  });
  if (f.is_form_builder) risks.push({
    type: "form-builder", label: "Form Builder",
    description: "Anyone can create forms here that collect user data. Attackers use this to build fake login or payment forms. Never enter passwords or financial information unless you initiated the process yourself.",
  });
  if (f.is_public_idp) risks.push({
    type: "idp", label: "Identity Provider",
    description: `This platform provides "Sign in with..." authentication for other websites. Attackers create convincing fake login pages here. Always verify the URL bar shows the exact correct domain before entering your password.`,
  });
  if (f.is_document_host) risks.push({
    type: "document-host", label: "Document Hosting",
    description: "Documents shared here pass through spam filters because the platform is trusted. Attackers exploit this to send fake invoices, login pages, or malware prompts via hosted documents.",
  });
  if (f.is_ugc_platform) risks.push({
    type: "ugc", label: "User-Generated Content",
    description: "Content here is created by users, not the platform operator. Individual posts, profiles, or pages may contain scams or phishing attempts the platform hasn't yet removed.",
  });
  if (f.allows_user_subdomains) risks.push({
    type: "subdomains", label: "Custom Subdomains",
    description: `Anyone can register a subdomain like "paypal-secure.${domain}" — which looks official but is controlled by whoever registered it, not ${operator}. Check the full URL carefully.`,
  });

  return risks;
}

// ── Safety level ──────────────────────────────────────────────────────────────

/**
 * Safety Matrix (matches urlert.com, extension variant with no threat data):
 * | Trust    | Malicious Cat | Has Note | Has Risks | → SafetyLevel |
 * | Any      | Any           | Yes      | Any       | high-risk         |
 * | Any      | Yes           | No       | Any       | caution/high-risk |
 * | high     | No            | No       | Any       | standard          |
 * | moderate | No            | No       | No        | standard          |
 * | moderate | No            | No       | Yes       | caution           |
 * | low      | No            | No       | No        | caution           |
 * | low      | No            | No       | Yes       | high-risk         |
 *
 * Note: high-trust sites (Google, Amazon, etc.) stay "standard" even with risk
 * factors because the platform itself is well-established. However, if they
 * are explicitly categorized as potentially malicious, they are cautioned.
 * Domains with admin notes are always elevated to "high-risk" (red alert).
 */
function calculateSafetyLevel(
  trustLevel: TrustLevel,
  hasRisks: boolean,
  isPotentiallyMalicious: boolean = false,
  adminNote: DomainClassification["admin_note"] | null = null,
  isVeryNew: boolean = false,
  isVerified: boolean = false,
  isParked: boolean = false,
): SafetyLevel {
  // Danger level admin notes ALWAYS trigger high-risk (red).
  if (adminNote?.level === "danger") return "high-risk";

  // Warning level admin notes trigger caution (yellow) at minimum.

  // Warning level admin notes trigger caution (yellow) at minimum.
  if (adminNote?.level === "warning") {
    // If it's already high-risk due to trust/risks, keep it.
    const base = calculateBaseSafety(trustLevel, hasRisks, isPotentiallyMalicious, isVeryNew, isVerified, isParked);
    return base === "high-risk" ? "high-risk" : "caution";
  }

  return calculateBaseSafety(trustLevel, hasRisks, isPotentiallyMalicious, isVeryNew, isVerified, isParked);
}

/** Original safety matrix logic extracted to separate helper */
function calculateBaseSafety(
  trustLevel: TrustLevel,
  hasRisks: boolean,
  isPotentiallyMalicious: boolean = false,
  isVeryNew: boolean = false,
  isVerified: boolean = false,
  isParked: boolean = false,
): SafetyLevel {

  // Verified sites with no admin note and not malicious → standard.
  if (isVerified && !isPotentiallyMalicious) return "standard";

  // Potentially malicious sites are NEVER standard, even if high trust.
  if (isPotentiallyMalicious) {
    // Low or Moderate trust with malicious categorization is high-risk.
    if (trustLevel !== "high") return "high-risk";
    // Even high-trust domains categorized as malicious are cautioned.
    return "caution";
  }

  // Parked domains: always at least caution regardless of trust.
  if (isParked) {
    return trustLevel === "low" ? "high-risk" : "caution";
  }

  // Very new sites are high-risk (red alert) if they are not highly established.
  if (isVeryNew && trustLevel !== "high") {
    return "high-risk";
  }

  const base: SafetyLevel = (() => {
    switch (trustLevel) {
      case "high":     return "standard";
      case "moderate": return hasRisks ? "caution" : "standard";
      case "low":      return hasRisks ? "high-risk" : "caution";
    }
  })();

  return base;
}

// ── Trust summary ─────────────────────────────────────────────────────────────

function buildTrustSummary(
  domain: string,
  trust: TrustAssessment,
  isPotentiallyMalicious: boolean = false,
): string {
  if (isPotentiallyMalicious) {
    return `${domain} has been flagged as potentially malicious. Do not enter credentials or personal information.`;
  }

  switch (trust.level) {
    case "high":
      return `${domain} is a well-established and widely-used platform.`;
    case "moderate":
      return `${domain} has some public presence, but isn't widely known. Apply standard web safety practices.`;
    case "low":
      return `${domain} has little to no public reputation data — it could be legitimate or it could not.`;
  }
}

// ── Risk summary ─────────────────────────────────────────────────────────────

function buildRiskSummary(
  trustLevel: TrustLevel,
  isPotentiallyMalicious: boolean,
): string {
  if (isPotentiallyMalicious) {
    return "This domain has been flagged for potentially malicious activity. We recommend extreme caution as it may be involved in phishing, scams, or distributing harmful content.";
  }

  switch (trustLevel) {
    case "high":
      return "Even established platforms have features that create risk. Attackers exploit well-known platforms to facilitate scams and phishing because security filters often allow the domain implicitly.";
    case "moderate":
      return "This platform has an established reputation, but includes features that can be exploited by attackers. Exercise caution and verify the exact URL before interacting.";
    default: // low
      return "This platform has features that create significant risk, and its limited public reputation makes them harder to monitor effectively. Exercise extra caution with any links or forms here.";
  }
}

// ── Safety advice ─────────────────────────────────────────────────────────────

function buildSafetyAdvice(
  trustLevel: TrustLevel,
  isPotentiallyMalicious: boolean,
): string {
  if (isPotentiallyMalicious) {
    return "Leave this site if you can. Do not enter passwords, click downloads, or provide any personal information.";
  }

  switch (trustLevel) {
    case "high":
      return "Always check the URL bar before entering credentials — attackers clone well-known platforms to steal logins.";
    case "moderate":
      return "Double-check the URL is correct before entering credentials or downloading anything from this site.";
    default: // low
      return "Only proceed if you expected to be here. Don't enter passwords or payment details on unfamiliar sites.";
  }
}

// ── Safety label ──────────────────────────────────────────────────────────────

function buildSafetyLabel(
  trust: TrustAssessment,
  risks: RiskFactor[],
  safetyLevel: SafetyLevel,
): string {
  if (safetyLevel === "high-risk") {
    if (risks.length > 0) return `High Risk: ${risks[0].label}`;
    return `High Risk: ${trust.label}`;
  }
  if (safetyLevel === "caution") {
    if (risks.length === 1) return `Caution: ${risks[0].label}`;
    if (risks.length > 1)   return `Caution: ${risks[0].label} +${risks.length - 1} more`;
    return `Caution: ${trust.label}`;
  }
  // standard — no bold claims; just use the factual trust label
  return trust.label;
}

// ── Main entry point ───────────────────────────────────────────────────────────

export function buildOverlaySafetyContext(c: DomainClassification): OverlaySafetyContext {
  const ageDays     = calculateDomainAgeInDays(c.facts?.registered_date);
  const isVerified  = c.verified ?? false;
  const trust       = assessTrust(c.facts?.rank, ageDays, isVerified);
  const operator    = c.identity?.operator ?? c.domain;
  const risks       = collectRisks(c.domain, operator, c.functions);

  // High-risk trigger for very new domains (< 90 days)
  const isVeryNew = ageDays !== null && ageDays < 90;
  if (isVeryNew && trust.level !== "high") {
    risks.unshift({
      type: "very-new-domain",
      label: "Very New Domain",
      description: `This domain was registered ${formatAge(ageDays!)} ago. New domains are frequently used for disposable phishing sites or seasonal scams.`,
    });
  }

  const isPotentiallyMalicious = c.category?.purpose === "potentially_malicious";
  if (isPotentiallyMalicious) {
    risks.unshift({
      type: "malicious-category",
      label: "Potentially Malicious",
      description: "Our analysis indicates this domain may be used for malicious purposes such as phishing, malware distribution, or scams. Exercise extreme caution.",
    });
  }

  const isParked = c.category?.purpose === "registrar_parking";
  if (isParked) {
    risks.unshift({
      type: "parked-domain",
      label: "Parked Domain",
      description: "This domain has no active website content. Parked domains are frequently used for phishing, drive-by downloads, and deceptive redirects. Any content or forms you encounter here should be treated with extreme suspicion.",
    });
  }

  const safetyLevel = calculateSafetyLevel(
    trust.level, 
    risks.length > 0, 
    isPotentiallyMalicious, 
    c.admin_note,
    isVeryNew, 
    isVerified, 
    isParked
  );
  const safetyLabel = buildSafetyLabel(trust, risks, safetyLevel);
  let trustSummary = buildTrustSummary(c.domain, trust, isPotentiallyMalicious);

  // Low-confidence caveat: classification data may be unreliable
  if (c.confidence === "unknown") {
    trustSummary += " Classification is based on content analysis and may not be fully accurate.";
  }

  // Icon dot colour
  let threatLevel: ThreatLevel = "neutral";
  if (safetyLevel === "high-risk") {
    threatLevel = "danger";
  } else if (safetyLevel === "caution") {
    threatLevel = "warn";
  } else if (isVerified && risks.length === 0) {
    threatLevel = "safe";
  }

  const riskSummary = risks.length > 0 ? buildRiskSummary(trust.level, isPotentiallyMalicious) : "";
  const safetyAdvice = buildSafetyAdvice(trust.level, isPotentiallyMalicious);

  return {
    trustLevel:   trust.level,
    trustLabel:   trust.label,
    trustSignals: trust.signals,
    trustSummary,
    safetyLevel,
    safetyLabel,
    risks,
    riskSummary,
    safetyAdvice,
    threatLevel,
  };
}
