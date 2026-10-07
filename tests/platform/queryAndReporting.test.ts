import { beforeEach, describe, expect, it } from "vitest";

import { ExportService } from "../../src/server/exports/service";
import { MemoryPlatformRepository, PlatformService } from "../../src/server/platform";
import { bundle, fixedNow, principals, users } from "./fixtures";

describe("server Finance queries and reporting", () => {
  let repository: MemoryPlatformRepository;
  let service: PlatformService;

  beforeEach(async () => {
    repository = new MemoryPlatformRepository();
    service = new PlatformService(repository, () => fixedNow);
    for (const user of users()) await repository.putUser(user);
    await repository.saveBatchBundle(bundle());
  });

  it("searches invoice, vendor, employee, and department without AUTO_PASS rows", async () => {
    expect((await service.queryExceptions(principals.manager, { search: "INV-2" })).items.map(({ transaction }) => transaction.id)).toEqual(["TXN-2"]);
    expect((await service.queryExceptions(principals.manager, { search: "Contoso" })).items.map(({ transaction }) => transaction.id)).toEqual(["TXN-1"]);
    expect((await service.queryExceptions(principals.manager, { search: "EMP-3" })).items.map(({ transaction }) => transaction.id)).toEqual(["TXN-3"]);
    expect((await service.queryExceptions(principals.manager, { search: "Sales" })).items.every(({ transaction }) => transaction.department === "Sales")).toBe(true);
    expect((await service.queryExceptions(principals.manager, {})).items.some(({ decision }) => decision.status === "AUTO_PASS")).toBe(false);
  });

  it("sorts and paginates deterministically", async () => {
    const first = await service.queryExceptions(principals.manager, { sortBy: "amount", sortDirection: "desc", page: 1, pageSize: 2 });
    const second = await service.queryExceptions(principals.manager, { sortBy: "amount", sortDirection: "desc", page: 2, pageSize: 2 });
    expect(first).toMatchObject({ totalItems: 4, totalPages: 2 });
    expect(first.items.map(({ transaction }) => transaction.id)).toEqual(["TXN-1", "TXN-2"]);
    expect(second.items.map(({ transaction }) => transaction.id)).toEqual(["TXN-3", "TXN-4"]);
  });

  it("supports advanced filters", async () => {
    expect((await service.queryExceptions(principals.manager, { status: "REVIEW", department: "Sales", amountMin: 2000, amountMax: 3000 })).items.map(({ transaction }) => transaction.id)).toEqual(["TXN-2"]);
    expect((await service.queryExceptions(principals.manager, { duplicateType: "EXACT" })).totalItems).toBe(2);
    expect((await service.queryExceptions(principals.manager, { ageBucket: "SEVEN_PLUS_DAYS" })).totalItems).toBeGreaterThan(0);
    expect((await service.queryExceptions(principals.manager, { reviewStatus: "UNREVIEWED" })).totalItems).toBe(4);
  });

  it("persists saved filters per user", async () => {
    const saved = await service.saveFilter(principals.manager, { name: "High-value exceptions", query: { amountMin: 10000, status: "HIGH_RISK" } });
    expect(await service.listFilters(principals.manager)).toEqual([saved]);
    expect(await service.listFilters(principals.reviewer)).toEqual([]);
  });

  it("builds My Queue from assignment ownership", async () => {
    await service.assignException(principals.manager, { transactionId: "TXN-1", reviewerId: principals.reviewer.userId, expectedVersion: 1 });
    const queue = await service.queryMyQueue(principals.reviewer);
    expect(queue.items.map(({ transaction }) => transaction.id)).toEqual(["TXN-1"]);
  });

  it("calculates batch history and review progress without AUTO_PASS", async () => {
    const assigned = await service.assignException(principals.manager, { transactionId: "TXN-1", reviewerId: principals.reviewer.userId, expectedVersion: 1 });
    await service.reviewException(principals.reviewer, { transactionId: "TXN-1", action: "APPROVE", expectedVersion: assigned.version });
    const history = await service.listBatches(principals.manager);
    expect(history[0].reviewProgress).toEqual({ exceptions: 4, reviewed: 1, remaining: 3, percentage: 25 });
    expect(history[0].policyVersionId).toBe("policy-v1");
  });

  it("returns trends from real batches and unresolved aging", async () => {
    const trends = await service.trends(principals.auditor);
    expect(trends).toEqual([expect.objectContaining({ batchId: "batch-alpha", transactionsProcessed: 5, autoClearRate: 0.2 })]);
    const aging = await service.aging(principals.manager);
    expect(Object.values(aging.buckets).reduce((total, count) => total + count, 0)).toBe(4);
    expect(aging.oldestUnresolved?.transactionId).toBe("TXN-4");
  });

  it("retains source traceability and original evidence", async () => {
    const detail = await service.getExceptionDetail(principals.auditor, "TXN-3");
    expect(detail.transaction).toMatchObject({ sourceFile: "finance.xlsx", sourceSheet: "Invoices", sourceRow: 4 });
    expect(detail.matchedTransaction?.id).toBe("TXN-4");
    expect(detail.duplicateMatches[0].evidence).toContain("Same invoice number");
  });

  it("creates tenant-scoped CSV/XLSX exception, audit, and batch exports", async () => {
    const exports = new ExportService(repository, service, () => fixedNow);
    const csv = await exports.exceptions(principals.manager, { status: "HIGH_RISK" }, "csv");
    const xlsx = await exports.exceptions(principals.manager, { duplicateType: "EXACT" }, "xlsx");
    const audit = await exports.audit(principals.auditor, "batch-alpha");
    const report = await exports.batchReport(principals.manager, "batch-alpha");
    expect(new TextDecoder().decode(csv.bytes)).toContain("transactionId");
    expect(xlsx.bytes.byteLength).toBeGreaterThan(100);
    expect(new TextDecoder().decode(audit.bytes)).toContain("PROCESSING_COMPLETED");
    expect(report.bytes.byteLength).toBeGreaterThan(100);
    expect(await repository.listExports("org-alpha")).toHaveLength(4);
  });

  it("enforces export permissions by role", async () => {
    const exports = new ExportService(repository, service, () => fixedNow);
    await expect(exports.exceptions(principals.auditor, {}, "csv")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(exports.audit(principals.reviewer)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows only Admin policy changes and preserves versions", async () => {
    const definition = { supportedCurrencies: ["INR"], expenseLimits: { Meals: 2000, Taxi: 3000, Hotel: 10000 }, purchaseOrderRequiredAbove: 25000, requiredFields: ["vendorName" as const] };
    const first = await service.savePolicy(principals.admin, { name: "Policy v1", state: "ACTIVE", definition });
    const second = await service.savePolicy(principals.admin, { name: "Policy v2", state: "ACTIVE", definition });
    const policies = await service.listPolicies(principals.admin);
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(policies.find(({ id }) => id === first.id)?.state).toBe("RETIRED");
    expect((await repository.getBatch("org-alpha", "batch-alpha"))?.policyVersionId).toBe("policy-v1");
  });
});
