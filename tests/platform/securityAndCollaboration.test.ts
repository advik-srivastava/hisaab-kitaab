import { beforeEach, describe, expect, it } from "vitest";

import { MemoryPlatformRepository, PlatformError, PlatformService } from "../../src/server/platform";
import { bundle, fixedNow, principals, users } from "./fixtures";

describe("server security and collaboration", () => {
  let repository: MemoryPlatformRepository;
  let service: PlatformService;

  beforeEach(async () => {
    repository = new MemoryPlatformRepository();
    service = new PlatformService(repository, () => fixedNow);
    await repository.putOrganization({ id: "org-alpha", name: "Alpha", createdAt: fixedNow.toISOString() });
    await repository.putOrganization({ id: "org-beta", name: "Beta", createdAt: fixedNow.toISOString() });
    for (const user of users()) await repository.putUser(user);
    await repository.saveBatchBundle(bundle());
  });

  it("denies unauthenticated access", async () => {
    expect(() => service.queryExceptions(undefined, {})).toThrow(expect.objectContaining({ code: "UNAUTHENTICATED" }));
  });

  it("prevents cross-tenant transaction access", async () => {
    await expect(service.getException(principals.outsider, "TXN-1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("prevents an Auditor from mutating reviews", async () => {
    await expect(service.reviewException(principals.auditor, { transactionId: "TXN-1", action: "REJECT", expectedVersion: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("prevents a Reviewer from managing policy", async () => {
    await expect(service.savePolicy(principals.reviewer, {
      name: "Unauthorized", state: "DRAFT",
      definition: { supportedCurrencies: ["INR"], expenseLimits: { Meals: 1, Taxi: 1, Hotel: 1 }, purchaseOrderRequiredAbove: 1, requiredFields: [] },
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects malformed policy input with a controlled validation error", async () => {
    await expect(service.savePolicy(principals.admin, {
      name: "Malformed", state: "DRAFT", definition: {} as never,
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("allows managers to assign and reviewers to review owned work", async () => {
    const assigned = await service.assignException(principals.manager, { transactionId: "TXN-1", reviewerId: principals.reviewer.userId, expectedVersion: 1 });
    expect(assigned.assignment?.reviewerId).toBe(principals.reviewer.userId);
    const reviewed = await service.reviewException(principals.reviewer, { transactionId: "TXN-1", action: "REJECT", note: "Outside policy", expectedVersion: assigned.version });
    expect(reviewed.review).toMatchObject({ action: "REJECT", reviewerId: principals.reviewer.userId });
    expect((await repository.listAudit("org-alpha", { transactionId: "TXN-1" })).map(({ action }) => action)).toEqual(["REVIEWER_ASSIGNED", "REJECT"]);
  });

  it("detects a stale concurrent review", async () => {
    const assigned = await service.assignException(principals.manager, { transactionId: "TXN-2", reviewerId: principals.reviewer.userId, expectedVersion: 1 });
    await service.reviewException(principals.reviewer, { transactionId: "TXN-2", action: "APPROVE", expectedVersion: assigned.version });
    await expect(service.reviewException(principals.reviewer, { transactionId: "TXN-2", action: "REJECT", expectedVersion: assigned.version })).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("reports partial failures for guarded bulk review", async () => {
    const assigned = await service.assignException(principals.manager, { transactionId: "TXN-3", reviewerId: principals.reviewer.userId, expectedVersion: 1 });
    const result = await service.bulkReview(principals.reviewer, {
      action: "MARK_NOT_DUPLICATE",
      items: [
        { transactionId: "TXN-3", expectedVersion: assigned.version },
        { transactionId: "TXN-2", expectedVersion: 1 },
      ],
    });
    expect(result.succeeded).toEqual(["TXN-3"]);
    expect(result.failed).toEqual([expect.objectContaining({ transactionId: "TXN-2", code: "FORBIDDEN" })]);
  });

  it("creates assignment notifications without erasing evidence", async () => {
    await service.assignException(principals.manager, { transactionId: "TXN-3", reviewerId: principals.reviewer.userId, expectedVersion: 1 });
    expect(await service.listNotifications(principals.reviewer)).toEqual([expect.objectContaining({ type: "HIGH_RISK_ASSIGNED", transactionId: "TXN-3" })]);
    expect((await service.getException(principals.manager, "TXN-3")).duplicateMatches).toHaveLength(1);
  });

  it("rejects MARK_NOT_DUPLICATE for non-duplicate evidence", async () => {
    await expect(service.reviewException(principals.manager, { transactionId: "TXN-1", action: "MARK_NOT_DUPLICATE", expectedVersion: 1 })).rejects.toBeInstanceOf(PlatformError);
  });
});
