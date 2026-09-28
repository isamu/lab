# Expense claims: design

## 1. Overview

The system takes a claim from the employee who paid, sends it to their manager, and passes it on to Accounting. The screens run in the browser and call a server API.

## 2. Terms

- "Claimant" means the employee who paid and asks to be reimbursed.
- "Approver" means the manager who approves the claim.

## 3. Structure

The screens are a single-page application that sends JSON to the server. Claims are stored in a relational database, and receipt images go to object storage.

### 3.1 Sign-in

Employees log in through the company identity provider over SAML. The approver of each claimant comes from the HR system.

### 3.2 Data

Each claim keeps its lines and its approvals in separate tables. Amounts are stored as whole yen.

## 4. Flow

When a claimant submits a claim, the approver gets an email. Once it is approved, the claim waits for payment by Accounting. A returned claim is a state in the tables of Section 3.2.

## 5. Service levels

A screen should respond within two seconds under normal load. The service level agreement (SLA) is 99.5% availability each month, and a month below the SLA gets a written report.
