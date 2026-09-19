# hisaabकिताब — PRODUCT SPECIFICATION

## POSITIONING

hisaabकिताब automatically clears clean Accounts-Payable transactions and sends only exceptions to Finance reviewers with evidence explaining each decision.

Tagline:

Review exceptions. Not every invoice.

---

# MVP

The product must support:

1. CSV/XLSX upload
2. transaction normalization
3. configurable policy validation
4. exact duplicate detection
5. probable duplicate detection
6. fuzzy duplicate detection
7. AUTO_PASS / REVIEW / HIGH_RISK
8. explainable exception details
9. APPROVE / REJECT / MARK_NOT_DUPLICATE
10. audit history
11. dashboard

---

# FOUR MAIN SCREENS

1. Upload
2. Dashboard
3. Exceptions
4. Exception Detail

Do not add more primary pages for the MVP.

---

# TRANSACTION BUSINESS FIELDS

vendorName
invoiceNumber
invoiceDate
amount
currency

Recommended:

expenseCategory
employeeId
department
purchaseOrder
description

System generated:

id
batchId
normalizedVendor
sourceFile
sourceSheet
sourceRow
createdAt

---

# DEMO POLICY

Supported currency:

INR

Limits:

Meals = 2000
Taxi = 3000
Hotel = 10000

PO required above:

25000

---

# VALIDATION

Missing vendor:
REVIEW

Missing invoice number:
REVIEW

Missing invoice date:
REVIEW

Missing amount:
HIGH_RISK

Missing currency:
REVIEW

Amount <= 0:
HIGH_RISK

Invalid date:
REVIEW

Future date:
REVIEW

Unsupported currency:
REVIEW

Meal > 2000:
REVIEW

Taxi > 3000:
REVIEW

Hotel > 10000:
HIGH_RISK

Missing PO when amount > 25000:
HIGH_RISK

---

# DUPLICATES

## EXACT

Same normalizedVendor
AND
same normalized invoiceNumber.

Result:

HIGH_RISK

Must identify matched transaction.

---

## PROBABLE

Same normalizedVendor
AND
same amount
AND
invoice dates within 3 days.

Result:

REVIEW

---

## FUZZY

Vendor similarity >= 90
AND
same amount
AND
invoice dates within 3 days.

Result:

REVIEW

Vendor similarity alone is never sufficient.

---

# VENDOR NORMALIZATION

lowercase

trim whitespace

remove punctuation

collapse spaces

normalize:

private -> pvt

limited -> ltd

Always retain original vendorName for display.

---

# SYSTEM DECISION

AUTO_PASS:

No meaningful failed rules and no duplicate match.

REVIEW:

Medium-severity validation failure
OR probable duplicate
OR fuzzy duplicate.

HIGH_RISK:

Exact duplicate
OR high-severity control failure.

HIGH_RISK does not mean fraud.

Similarity percentage does not represent fraud probability.

---

# UI STYLE

Brand:

hisaabकिताब

Style:

clean
professional
enterprise finance
Microsoft-inspired

Primary accent:
blue

Background:
very light neutral

Text:
dark navy

AUTO_PASS:
green

REVIEW:
amber

HIGH_RISK:
red

Avoid:

AI robot imagery
chatbot interfaces
excessive gradients
glassmorphism
unnecessary animations

---

# GOLDEN DEMO

1. Upload prepared Excel batch.

2. Display dashboard showing clean transactions and exceptions.

3. Open one policy violation.

4. Open exact duplicate.

5. Show current transaction and matched transaction side-by-side.

6. Show evidence explaining why it was flagged.

7. Reject duplicate.

8. Show new audit event.

9. Return to dashboard.

Target:

2–4 minutes.