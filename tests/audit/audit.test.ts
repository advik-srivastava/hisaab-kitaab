import { describe, expect, it } from "vitest";

import { appendAuditEvent, applyReviewAction } from "../../src/core/audit";
import {
  getAuditEvents,
  getDecision,
  getDuplicateMatches,
  getReviewActions,
  getRuleResults,
  loadState,
  saveAnalyzedBatch,
} from "../../src/lib/storage";
import {
  analyzedBatch,
  storedDecision,
  storedDuplicate,
  storedRule,
} from "../storage/fixtures";
import { MemoryStorage } from "../storage/memoryStorage";

const firstReviewTime = new Date("2026-09-19T02:00:00.000Z");

function preparedStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  saveAnalyzedBatch(analyzedBatch(), storage);
  return storage;
}

describe("review actions", () => {
  it.each(["APPROVE", "REJECT", "MARK_NOT_DUPLICATE"] as const)(
    "%s creates one audit event",
    (action) => {
      const storage = preparedStorage();
      const before = loadState(storage).currentBatch!.auditEvents.length;
      const result = applyReviewAction(
        { transactionId: "TXN-001", action, reviewer: "reviewer@example.com" },
        { storage, now: () => firstReviewTime },
      );

      expect(result?.auditEvent.action).toBe(action);
      expect(loadState(storage).currentBatch!.auditEvents).toHaveLength(before + 1);
    },
  );

  it("stores reviewer identity", () => {
    const storage = preparedStorage();
    const result = applyReviewAction(
      { transactionId: "TXN-001", action: "APPROVE", reviewer: "Asha" },
      { storage, now: () => firstReviewTime },
    );
    expect(result?.auditEvent).toMatchObject({ actorType: "USER", actorId: "Asha" });
    expect(getReviewActions("TXN-001", storage)[0].reviewer).toBe("Asha");
  });

  it("stores reviewer note", () => {
    const storage = preparedStorage();
    applyReviewAction(
      {
        transactionId: "TXN-001",
        action: "REJECT",
        reviewer: "Asha",
        note: "Confirmed duplicate submission.",
      },
      { storage, now: () => firstReviewTime },
    );
    expect(getReviewActions("TXN-001", storage)[0].note).toBe(
      "Confirmed duplicate submission.",
    );
  });

  it("stores a valid ISO timestamp", () => {
    const storage = preparedStorage();
    const result = applyReviewAction(
      { transactionId: "TXN-001", action: "APPROVE", reviewer: "Asha" },
      { storage, now: () => firstReviewTime },
    );
    expect(result?.auditEvent.timestamp).toBe(firstReviewTime.toISOString());
    expect(Number.isNaN(Date.parse(result!.auditEvent.timestamp))).toBe(false);
  });

  it("records the correct transaction and batch IDs", () => {
    const storage = preparedStorage();
    const result = applyReviewAction(
      { transactionId: "TXN-001", action: "APPROVE", reviewer: "Asha" },
      { storage, now: () => firstReviewTime },
    );
    expect(result?.auditEvent).toMatchObject({
      transactionId: "TXN-001",
      batchId: "batch-1",
    });
  });

  it("captures and preserves the original system status", () => {
    const storage = preparedStorage();
    const result = applyReviewAction(
      { transactionId: "TXN-001", action: "APPROVE", reviewer: "Asha" },
      { storage, now: () => firstReviewTime },
    );
    expect(result?.auditEvent).toMatchObject({
      oldStatus: "HIGH_RISK",
      newStatus: "HIGH_RISK",
    });
  });

  it("persists reviewer action after reload", () => {
    const storage = preparedStorage();
    applyReviewAction(
      { transactionId: "TXN-001", action: "APPROVE", reviewer: "Asha" },
      { storage, now: () => firstReviewTime },
    );
    expect(getReviewActions("TXN-001", storage)[0].action).toBe("APPROVE");
    expect(loadState(storage).currentBatch?.reviewActions["TXN-001"]).toHaveLength(1);
  });

  it("returns undefined without changing state for an unknown transaction", () => {
    const storage = preparedStorage();
    const before = loadState(storage);
    expect(
      applyReviewAction(
        { transactionId: "UNKNOWN", action: "REJECT", reviewer: "Asha" },
        { storage, now: () => firstReviewTime },
      ),
    ).toBeUndefined();
    expect(loadState(storage)).toEqual(before);
  });
});

describe("review evidence immutability", () => {
  it("APPROVE does not delete rules", () => {
    const storage = preparedStorage();
    applyReviewAction(
      { transactionId: "TXN-001", action: "APPROVE", reviewer: "Asha" },
      { storage, now: () => firstReviewTime },
    );
    expect(getRuleResults("TXN-001", storage)).toEqual([storedRule]);
  });

  it("APPROVE does not delete duplicate matches", () => {
    const storage = preparedStorage();
    applyReviewAction(
      { transactionId: "TXN-001", action: "APPROVE", reviewer: "Asha" },
      { storage, now: () => firstReviewTime },
    );
    expect(getDuplicateMatches("TXN-001", storage)).toEqual([storedDuplicate]);
  });

  it("REJECT does not rewrite the original Decision", () => {
    const storage = preparedStorage();
    applyReviewAction(
      { transactionId: "TXN-001", action: "REJECT", reviewer: "Asha" },
      { storage, now: () => firstReviewTime },
    );
    expect(getDecision("TXN-001", storage)).toEqual(storedDecision);
  });

  it("MARK_NOT_DUPLICATE preserves original duplicate evidence", () => {
    const storage = preparedStorage();
    applyReviewAction(
      {
        transactionId: "TXN-001",
        action: "MARK_NOT_DUPLICATE",
        reviewer: "Asha",
      },
      { storage, now: () => firstReviewTime },
    );
    expect(getDuplicateMatches("TXN-001", storage)[0]).toEqual(storedDuplicate);
  });

  it("multiple actions produce ordered audit and review history", () => {
    const storage = preparedStorage();
    const times = [
      new Date("2026-09-19T02:00:00.000Z"),
      new Date("2026-09-19T03:00:00.000Z"),
    ];
    applyReviewAction(
      { transactionId: "TXN-001", action: "MARK_NOT_DUPLICATE", reviewer: "Asha" },
      { storage, now: () => times[0] },
    );
    applyReviewAction(
      { transactionId: "TXN-001", action: "APPROVE", reviewer: "Asha" },
      { storage, now: () => times[1] },
    );

    expect(getReviewActions("TXN-001", storage).map(({ action }) => action)).toEqual([
      "MARK_NOT_DUPLICATE",
      "APPROVE",
    ]);
    expect(getAuditEvents("TXN-001", storage).slice(-2).map(({ action }) => action)).toEqual([
      "MARK_NOT_DUPLICATE",
      "APPROVE",
    ]);
  });
});

describe("audit helpers", () => {
  it("appends a durable system audit event", () => {
    const storage = preparedStorage();
    const event = appendAuditEvent(
      {
        transactionId: "TXN-001",
        batchId: "batch-1",
        actorType: "SYSTEM",
        action: "CASE_OPENED",
        newStatus: "HIGH_RISK",
      },
      { storage, now: () => firstReviewTime },
    );
    expect(event).toMatchObject({ actorType: "SYSTEM", action: "CASE_OPENED" });
    expect(getAuditEvents("TXN-001", storage).at(-1)).toEqual(event);
  });

  it("filters audit events by transaction ID", () => {
    const storage = preparedStorage();
    appendAuditEvent(
      {
        transactionId: "TXN-OTHER",
        batchId: "batch-1",
        actorType: "SYSTEM",
        action: "CASE_OPENED",
      },
      { storage, now: () => firstReviewTime },
    );
    expect(getAuditEvents("TXN-001", storage).every(({ transactionId }) => transactionId === "TXN-001")).toBe(true);
    expect(getAuditEvents("TXN-OTHER", storage)).toHaveLength(1);
  });

  it("keeps audit ordering deterministic", () => {
    const storage = preparedStorage();
    appendAuditEvent(
      {
        transactionId: "TXN-001",
        batchId: "batch-1",
        actorType: "SYSTEM",
        action: "RULE_EVALUATED",
      },
      { storage, now: () => new Date("2026-09-19T02:00:00.000Z") },
    );
    appendAuditEvent(
      {
        transactionId: "TXN-001",
        batchId: "batch-1",
        actorType: "SYSTEM",
        action: "DUPLICATE_DETECTED",
      },
      { storage, now: () => new Date("2026-09-19T03:00:00.000Z") },
    );
    expect(getAuditEvents("TXN-001", storage).map(({ action }) => action)).toEqual([
      "STATUS_ASSIGNED",
      "RULE_EVALUATED",
      "DUPLICATE_DETECTED",
    ]);
  });

  it("rejects appends for the wrong batch without changing audit history", () => {
    const storage = preparedStorage();
    expect(
      appendAuditEvent(
        {
          transactionId: "TXN-001",
          batchId: "wrong-batch",
          actorType: "SYSTEM",
          action: "CASE_OPENED",
        },
        { storage, now: () => firstReviewTime },
      ),
    ).toBeUndefined();
    expect(getAuditEvents("TXN-001", storage)).toHaveLength(1);
  });
});
