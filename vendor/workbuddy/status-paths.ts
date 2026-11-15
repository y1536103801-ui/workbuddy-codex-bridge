import type { AccountRestriction } from './restriction.ts'
/** Node-free constants and types shared by the Host and browser halves. */

/** Plugin-owned status endpoint consumed by its browser half. */
export const WORKBUDDY_STATUS_PATH = '/plugins/dsh-workbuddy-connect/status'

/**
 * Plugin-owned probe control endpoint.
 *
 * Separate from the status route because it accepts writes: the status route's
 * loopback Host/Origin guard protects against a DNS-rebinding *page*, which is
 * not the same as authorizing a state-changing action. This route therefore
 * also requires the in-process key the browser half receives with the status
 * document.
 */
export const WORKBUDDY_PROBE_PATH = '/plugins/dsh-workbuddy-connect/probe'

/**
 * The international (WorkBuddy AI) variant's own pair of routes.
 *
 * Kept as separate constants rather than a computed suffix so both halves
 * reference literal strings: the browser bundle and the host bundle are built
 * independently, and a shared expression is one build-config drift away from
 * the desk asking a route the host never mounted.
 */
export const WORKBUDDY_AI_STATUS_PATH = '/plugins/dsh-workbuddy-connect/ai/status'
export const WORKBUDDY_AI_PROBE_PATH = '/plugins/dsh-workbuddy-connect/ai/probe'

/**
 * Multi-account pool routes: list + balances (GET) and account actions (POST).
 *
 * One route serves both verbs so the card and the composer badge read and
 * write the same document; the POST half requires the in-process key, exactly
 * like the probe route, because switching spends another account's credit.
 */
export const WORKBUDDY_ACCOUNTS_PATH = '/plugins/dsh-workbuddy-connect/accounts'
export const WORKBUDDY_AI_ACCOUNTS_PATH = '/plugins/dsh-workbuddy-connect/ai/accounts'

/** One account row as the card and badge render it. */
export interface WorkBuddyWebAccount {
  identity: string
  uid: string
  nickname?: string
  /** `desktop` for the live sign-in, `snapshot` for a recovered one. */
  origin: 'desktop' | 'snapshot' | 'imported'
  /** Access-token expiry, epoch ms. */
  expiresAt: number
  refreshExpiresAt?: number
  /** Whether this is the account requests are served from. */
  active: boolean
  /** Remaining credit, when the balance query succeeded. */
  credits?: { total: number; unlimited?: true; fetchedAt: number }
  /** Why the balance is missing, when the query failed. */
  creditsError?: string
  /** No usable refresh token left: the user must sign in again. */
  needsRelogin?: boolean
  /**
   * The active account failed upstream with an exhausted balance recently.
   * This is the prompt to switch: it is set from a real `hard_credit`
   * response, not from a stale balance reading.
   */
  exhausted?: true
  /**
   * Spend this account has accumulated inside the routed model's window, and
   * the tokens currently leased to in-flight requests. Absent for variants
   * without a router (the international one), which is also the card's signal
   * not to draw a usage bar.
   */
  routedUsage?: {
    restriction?: AccountRestriction
    spentTokens: number
    reservedTokens: number
    /** When this account's budget was last handed back, epoch ms. */
    resetAt?: number
  }
}

/** The pool document the browser half renders. */
export interface WorkBuddyWebAccounts {
  /**
   * The account the asked-about session will use next. When the router is
   * serving the routed model it names the router's current account (the one the
   * next request spends), otherwise the session's own pin, otherwise the global
   * choice, otherwise the desktop sign-in. A composer chip renders this.
   */
  active?: string
  /**
   * True when `active` came from the session's own pin. False when the router's
   * current account overrides that pin, so the two are never both claimed.
   */
  sessionPinned?: boolean
  /**
   * True when no credential is pinned and the desktop sign-in is in charge
   * (explicitly not while the router is in `auto` mode, which chooses on its
   * own).
   */
  following?: boolean
  accounts: readonly WorkBuddyWebAccount[]
  /** When balances were last read, epoch ms; absent when none were. */
  updatedAt?: number
  /** In-process key authorizing POST actions; rotates per process. */
  key?: string
  /**
   * The global account a *new* conversation starts on. Distinct from
   * {@link active}, which answers for one session.
   */
  globalActive?: string
  /**
   * Router state for the routed model: the policy in force for this session and
   * the account it currently spends from. The composer chip prefers
   * `currentAccountId` over the pool's `active` flag.
   *
   * `limits`, `limitHits` and `observedPeakTokens` are the admission-control
   * panel's data: the live policy, the upstream refusals that actually
   * happened, and the largest spend seen at one of them — the measured ceiling
   * to compare the configured line against.
   */
  routing?: {
    mode: string
    currentAccountId?: string
    limits?: { windowMs: number; thresholdTokens: number }
    limitHits?: readonly WorkBuddyLimitHit[]
    observedPeakTokens?: number
  }
}

/** One recorded upstream refusal, as the card displays it. */
export interface WorkBuddyLimitHit {
  /** Account that was refused. */
  accountId: string
  /** When it happened, epoch ms. */
  at: number
  /** Tokens this account had recorded inside the window at that moment. */
  spentTokens: number
  /** Tokens leased to in-flight requests at that moment. */
  reservedTokens: number
  /** `soft_rate` (rate limited) or `hard_credit` (out of credit). */
  kind: string
  /** Upstream's own text, truncated. */
  message: string
}

/**
 * Same-origin route backing the browser's update reminder.
 *
 * Read-only like the status route, so the same loopback Host/Origin gate
 * applies; it answers public npm/GitHub metadata only and never token
 * material.
 */
export const WORKBUDDY_UPDATE_PATH = '/plugins/dsh-workbuddy-connect/update'

/** One model's recorded probe observation, as the card displays it. */
export interface WorkBuddyWebProbeModel {
  id: string
  name: string
  /** `validating` results carry efforts; the other states never do. */
  validation: 'validating' | 'non-validating' | 'unknown'
  efforts: readonly string[]
  probedAt: number
}

/** Probe section of the status document. */
export interface WorkBuddyWebProbeSection {
  /** Whether the user has authorized probing. */
  consent: boolean
  /** Whether a sweep is in flight right now. */
  running: boolean
  /** Models the user could probe by hand (undeclared yet reasoning-capable). */
  candidates: readonly string[]
  /** Recorded observations. */
  results: readonly WorkBuddyWebProbeModel[]
}

/** Action requested from the probe control route. */
export interface WorkBuddyProbeAction {
  /**
   * `probe` spends credit on one model; `clear` drops recorded observations;
   * `refresh` re-reads the credential and re-fetches the model catalog;
   * `set-maximum-context-window` persists the international card preference;
   * `set-model-visibility` hides or shows one model for the signed-in
   * account's picker.
   *
   * All six are writes, which is why they share this route's in-process key
   * and loopback guards rather than the read-only status GET.
   */
  action: 'probe' | 'clear' | 'refresh' | 'set-maximum-context-window' | 'set-model-visibility' | 'set-channel-compat'
    | 'set-routing-limits' | 'reset-routing-usage'
  /** Target model id; required for `probe` and `set-model-visibility`. */
  model?: string
  /** Requested value for `set-maximum-context-window`, `set-model-visibility`, and `set-channel-compat`. */
  enabled?: boolean
  /** Requested window length for `set-routing-limits`, epoch ms. */
  windowMs?: number
  /** Requested protection line for `set-routing-limits`, tokens. */
  thresholdTokens?: number
  /** Account to reset for `reset-routing-usage`; omitted resets every account. */
  identity?: string
  /** Requested picker visibility for `set-model-visibility`. */
  visible?: boolean
  /**
   * Expected account key for `set-model-visibility`: the `visibility.account`
   * the card rendered its checkboxes from. The host refuses the write when the
   * signed-in account has moved on, so a stale card can never land one
   * account's toggle in another account's bucket.
   */
  account?: string
}

/**
 * Model-visibility section of the status document (issue #36).
 *
 * Present only when an account with a stable user id is signed in: the
 * preferences are per account, so a credential without a uid has nothing to
 * key them by and the card renders no visibility controls rather than editing
 * a bucket every uid-less account would share. The account key is the same
 * non-secret `uid:enterpriseId` identity the saved catalogs use — never a
 * token.
 */
export interface WorkBuddyWebVisibilitySection {
  /** The `uid:enterpriseId` identity these preferences belong to. */
  account: string
  /** Model ids this account has hidden from the picker (the full list, including ids not in the current catalog). */
  disabled: readonly string[]
}

/**
 * Where the models a card is currently showing came from.
 *
 * The plan requires the card to distinguish a live catalog from the built-in
 * fallback, and to say when the last attempt failed — otherwise a stale list is
 * indistinguishable from an offline one, and a user cannot tell whether the
 * models they see still match the upstream.
 */
export interface WorkBuddyWebCatalog {
  /**
   * Where the models on screen came from, in degradation order:
   * `live` (fetched now) → `saved` (this account's last successful fetch,
   * restored after a restart or a failed fetch) → `fallback` (the roster
   * compiled into the plugin). The card distinguishes them because "stale" and
   * "offline with a saved list" are different situations for the user.
   */
  source: 'live' | 'saved' | 'fallback'
  /** When the live catalog last succeeded, epoch ms. */
  fetchedAt?: number
  /** App version used as the catalog User-Agent, when the variant needed one. */
  appVersion?: string
  /** Why the most recent fetch failed, when it did, redacted for display. */
  error?: string
}

/** One billing package and its remaining credit. */
export interface WorkBuddyWebCreditAccount {
  packageName: string
  remain: number
  size: number
  unlimited?: true
  /** When the package lapses, in epoch milliseconds; absent when unknown. */
  endTimeMs?: number
}

/** Credit lapsing inside one horizon, as the card reports it. */
export interface WorkBuddyWebExpiringCredits {
  /** Sum of the contributing packages' remaining credit. */
  total: number
  /** How many packages contribute. */
  packages: number
  /** Soonest expiry among them, epoch milliseconds. */
  earliestEndTimeMs?: number
}

/**
 * Credit at risk, bucketed by horizon.
 *
 * Only present when the upstream actually reported end times — a card must not
 * read "no expiry data" as "nothing expires soon".
 *
 * Future horizons only: the billing query behind this covers `valid` + `usedUp`
 * packages from the current time forward, so a lapsed package is never in the
 * set and has no bucket here.
 */
export interface WorkBuddyWebCreditExpiry {
  within24h: WorkBuddyWebExpiringCredits
  within3d: WorkBuddyWebExpiringCredits
  within7d: WorkBuddyWebExpiringCredits
}

/** Aggregated credit answer rendered by the plugin card. */
export interface WorkBuddyWebCredits {
  total: number
  accounts: readonly WorkBuddyWebCreditAccount[]
  unlimited?: true
  cycleResetTime?: string
  /** Credit lapsing soon, for the card's warning banner. */
  expiry?: WorkBuddyWebCreditExpiry
}

/** Billing convenience facts for one model, rendered as card badges. */
export interface WorkBuddyWebModelBadge {
  id: string
  name: string
  /** Whether the model is currently free (`x0.00` credits). */
  free?: boolean
  /** Promotional badges, e.g. `限时免费`, `夜间折扣`. */
  badges?: readonly string[]
  /**
   * Credits multiplier in display form, e.g. `x0.79`. Unlike the model
   * picker's copy, the card renders through the browser locale, so this value
   * may be interpolated into a localized sentence rather than shown bare.
   */
  credits?: string
  /**
   * The rate cannot be stated right now, and the card must say so.
   *
   * Set for a row whose price came from a promotion that has since ended: the
   * upstream bakes the discounted value into the cached row, and the original
   * price is not recoverable from it, so neither the old figure nor `free` may
   * be repeated. The card renders "refresh to see the price" instead.
   */
  rateUnknown?: true
  /**
   * Reasoning levels the catalogue itself declares, when it declares any.
   *
   * The probe section shows these when a detection cannot decide (the upstream
   * ignored the sentinel effort): "we could not measure it" is a different
   * message from "nothing is known", and the declared levels are already in
   * hand, so the card does not have to send another request to say something
   * useful.
   */
  declaredEfforts?: readonly string[]
  /** The level the upstream applies when a request names none. */
  defaultEffort?: string
  /**
   * Context capacity in tokens, taken verbatim from the upstream
   * `maxAllowedSize`/`maxInputTokens`, or from the international document's
   * `contextWindow.defaultLength` when it declares one.
   *
   * The international card can opt into the largest declared alternative. The
   * selected value is what DSH receives as its actual context budget.
   */
  contextWindow?: number
  /** The upstream default, when the card currently uses a selected maximum. */
  defaultContextWindow?: number
  /**
   * The international document's larger selectable window, when it declares
   * one, and the model's maximum input ceiling.
   *
   * Kept apart from {@link contextWindow} because they answer different
   * questions: `contextWindow` is the budget the plugin actually requests under,
   * while these are facts about what the upstream will accept. Showing the 1M
   * ceiling as though it were the working window would overstate the budget.
   */
  maxContextWindow?: number
  maxInputTokens?: number
}

/**
 * Why no credential is usable, as a closed enum the browser half switches on.
 *
 * Deliberately separate from `reason`: `reason` is free text meant for a human
 * to read, so matching on it would break the moment the wording changes. This
 * is the machine-readable half, and the card uses it — never a substring of
 * `reason` — to decide whether the Agent assist block applies.
 */
export type WorkBuddySignedOutReasonCode =
  /** Nobody is signed in; nothing diagnosable beyond that. */
  | 'no-credential'
  /** A credential for the *other* product was found in this variant's file. */
  | 'credential-region-mismatch'
  /** An encrypted credential exists but could not be opened (wrong key, GCM failure, helper crash). */
  | 'encrypted-credential-unreadable'
  /** A product on a supported platform: discovery ran to completion and found no usable candidate. */
  | 'electron-binary-not-found'
  /** A product on a supported platform: discovery found more than one distinct usable app. */
  | 'electron-binary-ambiguous'
  /** No auto-discovery for this product/platform and no explicit path configured. */
  | 'electron-binary-unavailable'
  /** An explicit path (option or env) is set but missing or not executable. */
  | 'electron-path-invalid'
  /** Discovery could not finish: tool missing, timeout, output overflow, unreadable plist. */
  | 'electron-discovery-incomplete'

/** Every reason code, for validation without trusting a wire value. */
const SIGNED_OUT_REASON_CODES: readonly WorkBuddySignedOutReasonCode[] = [
  'no-credential',
  'credential-region-mismatch',
  'encrypted-credential-unreadable',
  'electron-binary-not-found',
  'electron-binary-ambiguous',
  'electron-binary-unavailable',
  'electron-path-invalid',
  'electron-discovery-incomplete',
]

/** Whether a value is one of the closed set of signed-out reason codes. */
export function isWorkBuddySignedOutReasonCode(value: unknown): value is WorkBuddySignedOutReasonCode {
  return typeof value === 'string' && (SIGNED_OUT_REASON_CODES as readonly string[]).includes(value)
}

/** The JSON document the plugin card renders. */
export type WorkBuddyWebStatus =
  | {
    status: 'signed-out'
    /**
     * Why no credential is usable, when that is diagnosable rather than simply
     * "nobody signed in" — today a credential belonging to the other product.
     * The card renders it in place of the generic sign-in hint.
     */
    reason?: string
    /** Machine-readable companion to `reason`; see {@link WorkBuddySignedOutReasonCode}. */
    reasonCode?: WorkBuddySignedOutReasonCode
  }
  | {
    status: 'signed-in'
    nickname?: string
    domain?: string
    source?: 'desktop' | 'dsh'
    expiresAt?: number
    credits?: WorkBuddyWebCredits
    creditsError?: string
    /** Billing convenience facts for the models the plugin serves. */
    models?: readonly WorkBuddyWebModelBadge[]
    /** Where those models came from, and whether the last fetch failed. */
    catalog?: WorkBuddyWebCatalog
    /** Reasoning-effort probe state, consent, and recorded observations. */
    probe?: WorkBuddyWebProbeSection
    /** International-card preference selecting larger declared context windows. */
    useMaximumContextWindow?: boolean
    /** Per-account hidden-model state for the card's visibility controls. */
    visibility?: WorkBuddyWebVisibilitySection
    /**
     * CN-only channel compatibility switch, present only on the CN document.
     *
     * When on, the host rewrites the DSH identity sentence before sending a CN
     * chat request, because the gateway rejects it as an unapproved client.
     * See `channel-compat.ts`; the field is the card's capability signal.
     */
    channelCompat?: boolean
    /**
     * In-process key authorizing probe control writes. Handed to the card with
     * the status document (the card is same-origin and already had to pass the
     * loopback guard); it is never persisted and rotates per process.
     */
    probeKey?: string
  }
  | { status: 'error'; message: string }
