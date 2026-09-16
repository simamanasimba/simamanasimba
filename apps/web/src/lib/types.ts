export interface Organization {
  id: string;
  name: string;
  slug: string;
  website?: string | null;
  timezone: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  profilePhotoUrl: string | null;
  isPlatformOwner: boolean;
  mustChangePassword: boolean;
}

export interface OrgMembershipSummary {
  organizationId: string;
  role: string;
  organization: { id: string; name: string; slug: string };
}

export interface MeResponse {
  user: CurrentUser;
  organizations: OrgMembershipSummary[];
}

export interface Member {
  id: string;
  campaignId: string;
  membershipNumber: string | null;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  phone?: string | null;
  email?: string | null;
  region?: string | null;
  district?: string | null;
  ward?: string | null;
  branch?: string | null;
  isLeader?: boolean;
  membershipType: string;
  membershipStatus: string;
  registrationDate: string;
}

export interface PaginatedMembers {
  items: Member[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EventRecord {
  id: string;
  name: string;
  description?: string | null;
  eventType?: string | null;
  location?: string | null;
  startDatetime: string;
  endDatetime: string;
  capacity?: number | null;
  status: string;
  registrationEnabled: boolean;
  attendanceEnabled: boolean;
  allowWalkIns: boolean;
  allowNewMemberReg: boolean;
  autoCheckInNewMembers: boolean;
  limitOneResponsePerPerson: boolean;
  recommendation?: string | null;
  meetingNote?: string | null;
  budget?: number | null;
  createdBy?: { firstName: string; lastName: string } | null;
  attendanceCount?: number;
}

export interface EventWithStats {
  event: EventRecord;
  stats: {
    registered: number;
    checkedIn: number;
    remaining: number;
    attendanceRate: number;
    walkIns: number;
  };
}

export interface PostRecord {
  id: string;
  postType: "EVENT" | "UPDATE";
  title: string;
  description: string;
  audience?: string | null;
  location?: string | null;
  imageUrl?: string | null;
  eventDate?: string | null;
  likeCount: number;
  published: boolean;
  createdAt: string;
  _count: { registrations: number };
}

export interface LiveStats {
  eventId: string;
  registered: number;
  checkedIn: number;
  remaining: number;
  attendanceRate: number;
  walkIns: number;
  updatedAt: string;
}

/** Payout details shared by MediaHost and Influencer profiles. Per-booking detail (rate,
 * narrative, dates…) lives on MediaEngagement instead — one host/influencer has many of those
 * over time. */
export interface MediaProfileFields {
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  mobileMoneyProvider?: string | null;
  mobileMoneyNumber?: string | null;
  isActive?: boolean;
  reachTarget?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export type MediaEngagementStatus = "NOT_PAID" | "PAID";

/** One booked "campaign" for a specific media host or influencer — a narrative/content
 * record created up front; Rate/Eng./Total/Eng. Dates are filled in later, at pay time. */
export interface MediaEngagement {
  id: string;
  mediaHostId?: string | null;
  influencerId?: string | null;
  status: MediaEngagementStatus;
  rateTzs?: number | null;
  engagement?: number | null;
  totalTzs?: number | null;
  engagementDates?: string | null;
  link?: string | null;
  reportingTimeline?: string | null;
  natureOfNarrative?: string | null;
  topicPostAgenda?: string | null;
  narrativeKeyMessage?: string | null;
  reachAudience?: string | null;
  memberEngagement?: string | null;
  mediaImpactOutcome?: string | null;
  regionalFeedback?: string | null;
  meNotes?: string | null;
  likes?: number | null;
  comments?: number | null;
  createdAt: string;
}

export interface ReachMilestone {
  key: "week1" | "month1" | "month3" | "year1";
  dueAt: string;
  reached: boolean;
  value: number | null;
}

export interface RegionTarget {
  region: string;
  memberTarget: number | null;
  leaderTarget: number | null;
}

export interface PaginatedEngagements {
  items: MediaEngagement[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MediaHost {
  id: string;
  name: string;
  type: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  // Media house / channel / kipindi this host belongs to — picked via cascading dropdowns
  // sourced from the reference catalog, stored as plain text (no separate tables to keep in sync).
  mediaOutletId?: string | null;
  mediaOutlet?: { id: string; name: string } | null;
  channelName?: string | null;
  programName?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  mobileMoneyProvider?: string | null;
  mobileMoneyNumber?: string | null;
  isActive?: boolean;
  reachTarget?: number | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: { campaignLinks: number };
  /** Real Influencer 2 campaign count — _count.campaignLinks above is the old, now-unused join. */
  campaignCount?: number;
}

export const INFLUENCER_TYPES = ["CELEBRITY", "ATHLETE", "MUSICIAN", "CONTENT_CREATOR", "BLOGGER", "MEDIA_PERSONALITY", "MICRO_INFLUENCER", "OTHER"];

export interface Influencer extends MediaProfileFields {
  id: string;
  name: string;
  type: string;
  brandName?: string | null;
  phone?: string | null;
  additionalPhones?: string[] | null;
  email?: string | null;
  socialHandle?: string | null;
  notes?: string | null;
  contractStartDate?: string | null;
  agreementUrl?: string | null;
  createdAt?: string;
  _count?: { campaignLinks: number };
  /** Real Influencer 2 campaign count — _count.campaignLinks above is the old, now-unused join. */
  campaignCount?: number;
}

export interface MediaHostProfile {
  host: MediaHost;
  campaigns: MediaCampaign[];
  totalSessions: number;
  metricTotals: Record<string, number>;
  payments: Payment[];
  totalPaid: number;
  paymentCount: number;
  lastPayment: Payment | null;
  engagements: MediaEngagement[];
}

export interface InfluencerProfile {
  influencer: Influencer;
  campaigns: MediaCampaign[];
  totalSessions: number;
  metricTotals: Record<string, number>;
  payments: Payment[];
  totalPaid: number;
  paymentCount: number;
  lastPayment: Payment | null;
  engagements: MediaEngagement[];
}

export interface MediaCampaign {
  id: string;
  name: string;
  description?: string | null;
  campaignType?: string | null;
  objective?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  budget?: number | null;
  ownerUserId?: string | null;
  owner?: { id: string; firstName: string; lastName: string } | null;
  notes?: string | null;
  totalPaid?: number;
  _count?: { mediaHosts: number; influencers: number; sessions: number; payments: number };
}

export interface MediaCampaignDetail extends MediaCampaign {
  mediaHosts: Array<{ mediaHost: MediaHost }>;
  influencers: Array<{ influencer: Influencer }>;
  metrics: TrackerMetric[];
}

// Media house reference catalog (e.g. "Azam Media") — the Media/Channel/Kipindi cascade used
// when registering a MediaHost. Channel/Kipindi are plain names served live from the catalog
// (see MediaOutletCatalog below), never their own DB rows.
export interface MediaOutlet {
  id: string;
  name: string;
  isActive: boolean;
}

export interface MediaOutletCatalogChannel {
  name: string;
  programs: string[];
}

export interface MediaOutletCatalog {
  channels: MediaOutletCatalogChannel[];
}

export type EngagementMetric = "likes" | "comments" | "views" | "shares";

export interface EngagementTotals {
  likes: number;
  comments: number;
  views: number;
  shares: number;
}

export interface MediaEngagementOverview {
  activeMediaCount: number;
  activeHostCount: number;
  hostsByType: Array<{ type: string; count: number }>;
  engagementByType: Array<{ type: string } & EngagementTotals>;
  topHosts: Array<{ id: string; name: string; type: string } & EngagementTotals>;
  topMedia: Array<{ id: string; name: string } & EngagementTotals>;
  mediaReach: EngagementTotals;
  influencerReach: EngagementTotals;
}

export interface TrackerMetric {
  id: string;
  campaignId: string;
  name: string;
  description?: string | null;
  fieldType: string;
  unit?: string | null;
  required: boolean;
  scoringEnabled: boolean;
  weight?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  target?: number | null;
  calculationMethod?: string | null;
  displayOrder: number;
}

export interface TrackerSession {
  id: string;
  campaignId: string;
  sessionDate: string;
  status: "DRAFT" | "COMPLETED" | "LOCKED";
  createdByUserId: string;
  _count?: { entries: number };
}

export interface TrackerEntry {
  id: string;
  sessionId: string;
  metricId: string;
  subjectType: "MEDIA_HOST" | "INFLUENCER";
  subjectId: string;
  mediaHostId?: string | null;
  influencerId?: string | null;
  numericValue?: number | null;
  textValue?: string | null;
  boolValue?: boolean | null;
}

export interface TrackerEntryInput {
  metricId: string;
  subjectType: "MEDIA_HOST" | "INFLUENCER";
  mediaHostId?: string;
  influencerId?: string;
  numericValue?: number;
  textValue?: string;
  boolValue?: boolean;
}

export interface TrackerSessionDetail {
  session: TrackerSession;
  metrics: TrackerMetric[];
  mediaHosts: MediaHost[];
  influencers: Influencer[];
  entries: TrackerEntry[];
}

export interface MediaActivation {
  id: string;
  campaignId: string;
  week?: string | null;
  platformProgram?: string | null;
  activationChannel?: string | null;
  personnelOutlet?: string | null;
  personnelRole?: string | null;
  rateTzs?: number | null;
  engagement?: number | null;
  totalTzs?: number | null;
  engagementDates?: string | null;
  link?: string | null;
}

export interface TrackerReport {
  id: string;
  campaignId: string;
  reportingTimeline?: string | null;
  paymentDate?: string | null;
  natureOfNarrative?: string | null;
  topicPostAgenda?: string | null;
  narrativeKeyMessage?: string | null;
  reachAudience?: string | null;
  memberEngagement?: string | null;
  mediaImpactOutcome?: string | null;
  regionalFeedback?: string | null;
  meNotes?: string | null;
}

export interface CampaignSummary {
  campaignId: string;
  totalSessions: number;
  mediaHostCount: number;
  influencerCount: number;
  metricTotals: Array<{ metricId: string; name: string; unit: string | null; fieldType: string; value: number | null; target: number | null; achievement: number | null }>;
  performanceScore: number | null;
  trend: Array<Record<string, string | number>>;
}

export interface FinancialSummary {
  budget: number | null;
  totalPaid: number;
  remaining: number | null;
  paymentCount: number;
}

export interface HostComparisonRow {
  mediaHost: MediaHost;
  sessionCount: number;
  metricTotals: Record<string, number | null>;
  performanceScore: number | null;
}

export interface InfluencerComparisonRow {
  influencer: Influencer;
  sessionCount: number;
  metricTotals: Record<string, number | null>;
  performanceScore: number | null;
}

export interface Payment {
  id: string;
  campaignId?: string | null;
  campaign?: { id: string; name: string } | null;
  beneficiaryType: "MEDIA_HOST" | "INFLUENCER";
  mediaHostId?: string | null;
  mediaHost?: MediaHost | null;
  influencerId?: string | null;
  influencer?: Influencer | null;
  paymentDate: string;
  amount: number;
  currency: string;
  method?: string | null;
  referenceNumber?: string | null;
  description?: string | null;
  status: "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "CANCELLED";
  notes?: string | null;
  documentUrl?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankTransactionRef?: string | null;
  mobileMoneyProvider?: string | null;
  mobileMoneyNumber?: string | null;
  mobileMoneyTransactionId?: string | null;
  createdByUserId?: string;
  createdByName?: string | null;
  approvedByUserId?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  rejectedByUserId?: string | null;
  rejectedByName?: string | null;
  rejectedAt?: string | null;
  mediaEngagementId?: string | null;
  mediaEngagement?: MediaEngagement | null;
  influencer2CampaignId?: string | null;
  paidAmount?: number | null;
  amountVarianceNote?: string | null;
}

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE", "MOBILE_MONEY", "CARD", "ONLINE_PAYMENT"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface FinanceDashboard {
  todaySpend: number;
  weekSpend: number;
  monthSpend: number;
  totalSpend: number;
  paymentCount: number;
  pendingCount: number;
  spendByCampaign: Array<{ campaignId: string | null; name: string; amount: number }>;
  spendByMediaHost: Array<{ mediaHostId: string | null; name: string; amount: number }>;
  spendByInfluencer: Array<{ influencerId: string | null; name: string; amount: number }>;
}

export type ExpenseCategory = "OPERATIONAL" | "ADMINISTRATIVE";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  item: string;
  purpose?: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  dateIssued: string;
  concernedParty?: string | null;
  notes?: string | null;
  createdByUserId: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// INFLUENCER 2 — isolated multi-platform content engagement module. See
// packages/database/prisma/schema.prisma for the schema-level note: this
// never shares logic with Influencer/MediaEngagement above.
// ─────────────────────────────────────────────────────────────────────────

export type Influencer2ContentType = "VIDEO" | "IMAGE" | "REEL" | "STORY" | "ARTICLE" | "PODCAST" | "AUDIO" | "OTHER";
export type Influencer2CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type Influencer2MetricCategory = "VIEWS" | "LIKES" | "COMMENTS" | "SHARES" | "SENTIMENT" | "OTHER";
export type Influencer2PaymentStatus = "NOT_PAID" | "PAID";

export interface Influencer2MetricDefinition {
  id: string;
  platformId: string;
  key: string;
  label: string;
  category: Influencer2MetricCategory;
  videoOnly: boolean;
  countsAsEngagement: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface Influencer2Platform {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  metricDefinitions: Influencer2MetricDefinition[];
}

export interface Influencer2Campaign {
  id: string;
  organizationId: string;
  name: string;
  code?: string | null;
  contentType: Influencer2ContentType;
  description?: string | null;
  contentDate?: string | null;
  contentOwner?: string | null;
  influencerId?: string | null;
  mediaHostId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: Influencer2CampaignStatus;
  thumbnailUrl?: string | null;
  notes?: string | null;
  paymentStatus: Influencer2PaymentStatus;
  /** Unpaid/Processing/Paid — the payment-progress label shown to the user, replacing the
   * unrelated lifecycle `status` for that purpose. Only present on responses from `list()`/
   * `getDetail()`, which compute it server-side. */
  paymentProgress?: "UNPAID" | "PENDING_PAYMENT" | "PAID";
  rateTzs?: number | null;
  totalTzs?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Used for both an influencer's and a media host's Influencer 2 stats. */
export interface Influencer2CampaignSummary {
  totalCampaigns: number;
  totalPosts: number;
  totalBeneficiaries?: number | null;
  totalViews: number | null;
  totalLikes: number | null;
  totalComments: number | null;
  totalShares: number | null;
  totalEngagement: number;
  engagementPerPost: number | null;
}

export interface Influencer2CampaignReportRow {
  id: string;
  name: string;
  contentType: string;
  status: string;
  createdAt: string;
  beneficiaryName: string;
  mediaType: string | null;
  platforms: string[];
}

/** A named, saved date range for the Media/Influencer dashboards' filter (e.g. "Week 1"). */
export interface DashboardSavedView {
  id: string;
  name: string;
  fromDate: string;
  toDate: string;
  createdByUserId: string;
  createdAt: string;
}

/** GET .../influencer2/campaigns/report-details — the drill-down behind a scope+range's summary numbers. */
export interface Influencer2CampaignReportDetails {
  campaigns: Influencer2CampaignReportRow[];
  byPlatform: Array<{ platform: string; count: number }>;
  byMediaType: Array<{ type: string; count: number }>;
}

export interface Influencer2PlatformMetric {
  metricDefinitionId: string;
  key: string;
  label: string;
  category: Influencer2MetricCategory;
  unit: string | null;
  countsAsEngagement: boolean;
  value: number;
  collectedAt: string;
}

export interface Influencer2PlatformSummary {
  campaignPlatformId: string;
  platformId: string;
  platformKey: string;
  platformName: string;
  postUrl?: string | null;
  postId?: string | null;
  publishedAt?: string | null;
  metrics: Influencer2PlatformMetric[];
  totalEngagement: number;
  sentiment: { positive: number | null; negative: number | null; neutral: number | null } | null;
}

export interface Influencer2Totals {
  platformCount: number;
  totalViews: number | null;
  totalLikes: number | null;
  totalComments: number | null;
  totalShares: number | null;
  totalEngagement: number;
  sentiment: { positive: number; negative: number; neutral: number } | null;
}

export interface Influencer2CampaignListItem {
  campaign: Influencer2Campaign;
  influencerName: string | null;
  platformKeys: string[];
  totals: Influencer2Totals;
}

export interface PaginatedInfluencer2Campaigns {
  items: Influencer2CampaignListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Influencer2CampaignDetail {
  campaign: Influencer2Campaign;
  influencer: { id: string; name: string; socialHandle?: string | null } | null;
  mediaHost: { id: string; name: string } | null;
  platforms: Influencer2PlatformSummary[];
  totals: Influencer2Totals;
}

export interface Influencer2MetricHistoryPoint {
  collectedAt: string;
  value: number;
}

export type PerformanceDirection = "ON_TRACK" | "NEEDS_IMPROVEMENT" | "BEHIND" | "NO_TARGET";

export interface PerformanceMetric {
  current: number;
  target: number | null;
  past?: number;
  pctOfTarget: number | null;
  varianceSincePast?: number;
  direction: PerformanceDirection;
}

export interface PerformanceReport {
  cutoffDate: string;
  endDate: string;
  members: PerformanceMetric;
  leaders: PerformanceMetric;
  byRegion: Array<{ region: string; members: PerformanceMetric; leaders: PerformanceMetric }>;
  mediaReach: PerformanceMetric;
  overallDirection: PerformanceDirection;
}
