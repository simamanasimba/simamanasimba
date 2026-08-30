import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, ReportFormat, ReportType } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { EventsService } from "../events/events.service";
import { toCsv } from "../../common/csv.util";
import { renderEventReportPdf, type PdfSection, type PdfTable } from "./pdf.util";

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly analytics: AnalyticsService,
    private readonly events: EventsService,
  ) {}

  async generate(organizationId: string, type: ReportType, format: ReportFormat, parameters: Record<string, unknown>, userId: string) {
    const report = await this.prisma.report.create({
      data: { organizationId, type, format, parameters: parameters as Prisma.InputJsonValue, generatedByUserId: userId, status: "GENERATING" },
    });

    try {
      let fileUrl: string;

      if (format === "PDF") {
        const pdf = await this.buildPdf(organizationId, type, parameters);
        fileUrl = await this.storage.upload(`reports/${organizationId}/${report.id}.pdf`, pdf, "application/pdf");
      } else if (format === "CSV") {
        const rows = await this.buildRows(organizationId, type, parameters);
        const csv = toCsv(rows);
        fileUrl = await this.storage.upload(`reports/${organizationId}/${report.id}.csv`, Buffer.from(csv, "utf-8"), "text/csv");
      } else {
        // Excel rendering intentionally not yet implemented — report this
        // honestly instead of pretending a binary file exists (spec section 77).
        await this.prisma.report.update({ where: { id: report.id }, data: { status: "FAILED" } });
        throw new NotFoundException(`${format} export is not yet implemented — use CSV or PDF`);
      }

      return this.prisma.report.update({ where: { id: report.id }, data: { status: "READY", fileUrl, completedAt: new Date() } });
    } catch (err) {
      await this.prisma.report.update({ where: { id: report.id }, data: { status: "FAILED" } });
      throw err;
    }
  }

  private async buildPdf(organizationId: string, type: ReportType, parameters: Record<string, unknown>): Promise<Buffer> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, logoUrl: true } });
    const logo = org?.logoUrl ? await this.storage.readAsBuffer(org.logoUrl) : null;

    if (type === "EVENT_ATTENDANCE" || type === "EVENT_IMPACT") {
      const eventId = parameters.eventId as string;
      if (!eventId) throw new NotFoundException("eventId parameter is required for this report");
      const event = await this.prisma.event.findFirst({ where: { id: eventId, organizationId } });
      if (!event) throw new NotFoundException("Event not found");

      const records = await this.prisma.attendanceRecord.findMany({
        where: { organizationId, eventId },
        include: { member: { select: { membershipNumber: true, firstName: true, lastName: true, region: true, isLeader: true } } },
        orderBy: { checkedInAt: "asc" },
      });
      const [registered, mentions, news, newMembersObtained] = await Promise.all([
        this.prisma.eventRegistration.count({ where: { eventId, registrationStatus: { in: ["REGISTERED", "APPROVED"] } } }),
        this.prisma.mention.count({ where: { organizationId, eventId } }),
        this.prisma.newsArticle.count({ where: { organizationId } }),
        this.countNewMembersObtained(organizationId, eventId),
      ]);
      const checkedIn = records.length;

      const sections: PdfSection[] = [
        {
          heading: "Event Details",
          fields: [
            { label: "Event:", value: event.name },
            { label: "Type:", value: event.eventType ?? "—" },
            { label: "Location:", value: event.location ?? "—" },
            { label: "Starts:", value: new Date(event.startDatetime).toLocaleString() },
            { label: "Ends:", value: new Date(event.endDatetime).toLocaleString() },
            { label: "Status:", value: event.status },
          ],
        },
        {
          heading: "Attendance Summary",
          fields: [
            { label: "New members obtained:", value: String(newMembersObtained) },
            { label: "Checked in:", value: String(checkedIn) },
            { label: "Attendance rate:", value: registered > 0 ? `${((checkedIn / registered) * 100).toFixed(1)}%` : "0%" },
            ...(type === "EVENT_IMPACT"
              ? [
                  { label: "Digital mentions:", value: String(mentions) },
                  { label: "News articles:", value: String(news) },
                ]
              : []),
          ],
        },
      ];

      const table: PdfTable = {
        heading: "Attendance List",
        columns: ["Membership #", "Name", "Region", "Role", "Checked In At"],
        rows: records.map((r) => [
          r.member.membershipNumber ?? "—",
          `${r.member.firstName} ${r.member.lastName}`,
          r.member.region ?? "—",
          r.member.isLeader ? "Leader" : "Member",
          new Date(r.checkedInAt).toLocaleString(),
        ]),
      };

      const eventDateLabel = new Date(event.startDatetime).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
      const heading = org?.name ?? "Event Report";
      const subheading = `${event.name} — ${eventDateLabel}`;
      return renderEventReportPdf(heading, subheading, sections, table, logo);
    }

    // Any other report type: render its tabular rows as a plain PDF table.
    const rows = await this.buildRows(organizationId, type, parameters);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : ["No data"];
    const table: PdfTable = { heading: "Data", columns, rows: rows.map((r) => columns.map((c) => String(r[c] ?? ""))) };
    return renderEventReportPdf(org?.name ?? type.replaceAll("_", " "), `${type.replaceAll("_", " ")} — generated ${new Date().toLocaleDateString()}`, [], table, logo);
  }

  private async buildRows(organizationId: string, type: ReportType, parameters: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
    switch (type) {
      case "MEMBERSHIP_GROWTH":
      case "MONTHLY_MEMBERSHIP":
      case "ANNUAL_MEMBERSHIP":
        return this.analytics.membershipGrowth(organizationId, (parameters.interval as never) ?? "month", parameters.from as string, parameters.to as string);

      case "EVENT_ATTENDANCE": {
        const eventId = parameters.eventId as string;
        if (!eventId) throw new NotFoundException("eventId parameter is required for this report");
        const records = await this.prisma.attendanceRecord.findMany({
          where: { organizationId, eventId },
          include: { member: { select: { membershipNumber: true, firstName: true, lastName: true, isLeader: true } } },
          orderBy: { checkedInAt: "asc" },
        });
        return records.map((r) => ({
          membershipNumber: r.member.membershipNumber,
          firstName: r.member.firstName,
          lastName: r.member.lastName,
          role: r.member.isLeader ? "Leader" : "Member",
          checkedInAt: r.checkedInAt.toISOString(),
        }));
      }

      case "EVENT_PERFORMANCE": {
        const eventIds = ((parameters.eventIds as string) ?? "").split(",").filter(Boolean);
        return this.analytics.compareEvents(organizationId, eventIds);
      }

      case "EVENT_IMPACT": {
        const eventId = parameters.eventId as string;
        if (!eventId) throw new NotFoundException("eventId parameter is required for this report");
        const event = await this.prisma.event.findFirst({ where: { id: eventId, organizationId } });
        if (!event) throw new NotFoundException("Event not found");
        const [registered, checkedIn, mentions, news, newMembersObtained] = await Promise.all([
          this.prisma.eventRegistration.count({ where: { eventId, registrationStatus: { in: ["REGISTERED", "APPROVED"] } } }),
          this.prisma.attendanceRecord.count({ where: { eventId } }),
          this.prisma.mention.count({ where: { organizationId, eventId } }),
          this.prisma.newsArticle.count({ where: { organizationId } }),
          this.countNewMembersObtained(organizationId, eventId),
        ]);
        return [
          {
            event: event.name,
            newMembersObtained,
            attendance: checkedIn,
            attendanceRate: registered > 0 ? `${((checkedIn / registered) * 100).toFixed(1)}%` : "0%",
            digitalMentions: mentions,
            newsArticles: news,
            note: "Digital figures reflect only what monitoring rules have discovered — 0 means no monitoring has run yet, not that there was no coverage.",
          },
        ];
      }

      case "DIGITAL_INTELLIGENCE":
      case "SOCIAL_MEDIA":
      case "REPUTATION":
      case "CAMPAIGN": {
        const mentions = await this.prisma.mention.findMany({
          where: { organizationId },
          orderBy: { detectedAt: "desc" },
          take: 500,
          include: { aiAnalyses: true },
        });
        return mentions.map((m) => ({
          detectedAt: m.detectedAt.toISOString(),
          sourceType: m.sourceType,
          sourceProvider: m.sourceProvider,
          sourceUrl: m.sourceUrl,
          topic: m.topic,
          sentiment: m.aiAnalyses.find((a) => a.analysisType === "SENTIMENT")?.sentiment ?? "UNKNOWN",
          priority: m.priority,
        }));
      }

      default:
        return [];
    }
  }

  /** Delegates to EventsService.listNewMembers — the definitive "new members obtained at this
   * event" logic lives there so both the report and the event page's New Members tab agree. */
  private async countNewMembersObtained(organizationId: string, eventId: string): Promise<number> {
    return (await this.events.listNewMembers(organizationId, eventId)).length;
  }

  async get(organizationId: string, reportId: string) {
    const report = await this.prisma.report.findFirst({ where: { id: reportId, organizationId } });
    if (!report) throw new NotFoundException("Report not found");
    return report;
  }

  list(organizationId: string) {
    return this.prisma.report.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 50 });
  }
}
