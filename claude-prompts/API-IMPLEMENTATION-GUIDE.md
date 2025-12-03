# API Implementation Guide

Complete guide for implementing API endpoints in the Polibit Demo frontend application.

## Table of Contents

1. [Base Configuration](#base-configuration)
2. [Authentication](#authentication)
3. [Structures API](#structures-api)
4. [Investors API](#investors-api)
5. [Investments API](#investments-api)
6. [Capital Calls API](#capital-calls-api)
7. [Distributions API](#distributions-api)
8. [Subscriptions API](#subscriptions-api)
9. [Investment Subscriptions API](#investment-subscriptions-api)
10. [Payments API](#payments-api)
11. [KYC Sessions API](#kyc-sessions-api)
12. [Firm Settings API](#firm-settings-api)
13. [Common Error Responses](#common-error-responses)

---

## Base Configuration

### Base URL
```
Production: https://your-api-domain.com/api
Development: http://localhost:3000/api
```

### Headers
All authenticated requests must include:
```javascript
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <your_auth_token>"
}
```

---

## Authentication

The API uses authentication middleware that checks for user credentials. Most endpoints require the `authenticate` middleware. Root (role 0) and Admin (role 1) users have different access levels.

### Role Levels
- **Root (0)**: Full access to all resources
- **Admin (1)**: Access to own resources only
- **Support (2)**: Read-only access to assigned structures
- **Investor (3)**: Investor role with access to investor-specific endpoints and lp-portal sections

**Note:** The Investor role (3) was previously labeled as "Customer" but now specifically represents investors. Users with role=3 have investor-specific fields in the users table.

---

## Structures API

### 1. Create Structure

**Endpoint:** `POST /api/structures`

**Access:** Private (Root/Admin roles only)

**Request Body:**
```json
{
  "name": "Tech Growth Fund I",                    // Required
  "type": "Fund",                                   // Required: Fund, SA/LLC, Fideicomiso, Private Debt
  "subtype": "Venture Capital",                     // Optional
  "description": "Early-stage tech investments",    // Optional
  "parentStructureId": "uuid",                      // Optional (for hierarchies)
  "status": "Active",                               // Optional, default: Active
  "totalCommitment": 50000000,                      // Optional, default: 0
  "managementFee": 2.0,                             // Optional, default: 2.0 (%)
  "carriedInterest": 20.0,                          // Optional, default: 20.0 (%)
  "hurdleRate": 8.0,                                // Optional, default: 8.0 (%)
  "waterfallType": "American",                      // Optional, default: American
  "inceptionDate": "2024-01-15T00:00:00.000Z",     // Optional, default: current date
  "termYears": 10,                                  // Optional, default: 10
  "extensionYears": 2,                              // Optional, default: 2
  "gp": "Tech Partners LP",                         // Optional
  "fundAdmin": "Admin Services Inc",                // Optional
  "legalCounsel": "Legal Associates",               // Optional
  "auditor": "Big Four Auditing",                   // Optional
  "taxAdvisor": "Tax Consultants LLC",              // Optional
  "bankAccounts": {},                               // Optional, JSON object
  "baseCurrency": "USD",                            // Optional, default: USD
  "taxJurisdiction": "Delaware",                    // Optional
  "regulatoryStatus": "Registered",                 // Optional
  "investmentStrategy": "Growth equity",            // Optional
  "targetReturns": "25% IRR",                       // Optional
  "riskProfile": "High",                            // Optional
  "stage": "Fundraising"                            // Optional
}
```

**Validation Rules:**
- `name`: Required, trimmed
- `type`: Required
- `parentStructureId`: Must be valid UUID and exist in database
- Maximum hierarchy level: 5
- Parent structure must belong to the same user

**Success Response (201):**
```json
{
  "success": true,
  "message": "Structure created successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Tech Growth Fund I",
    "type": "Fund",
    "status": "Active",
    "totalCommitment": 50000000,
    "totalCalled": 0,
    "totalDistributed": 0,
    "totalInvested": 0,
    "managementFee": 2.0,
    "carriedInterest": 20.0,
    "hurdleRate": 8.0,
    "waterfallType": "American",
    "baseCurrency": "USD",
    "hierarchyLevel": 1,
    "createdBy": "user-id",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Structure name is required"
}
```

### 2. Get All Structures

**Endpoint:** `GET /api/structures`

**Access:** Private

**Query Parameters:**
- `createdBy`: Filter by creator user ID
- `type`: Filter by structure type
- `status`: Filter by status
- `parentId`: Filter by parent structure ID

**Success Response (200):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Tech Growth Fund I",
      "type": "Fund",
      "status": "Active"
      // ... other fields
    }
  ]
}
```

### 3. Get Root Structures

**Endpoint:** `GET /api/structures/root`

**Access:** Private (Root/Admin only)

**Description:** Returns all root structures (structures without a parent). Root users see all root structures, Admin users see only their own.

**Success Response (200):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Tech Growth Fund I",
      "parentStructureId": null,
      "hierarchyLevel": 1
      // ... other fields
    }
  ]
}
```

### 4. Get Structure by ID

**Endpoint:** `GET /api/structures/:id`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Tech Growth Fund I"
    // ... all structure fields
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Structure not found"
}
```

### 5. Get Child Structures

**Endpoint:** `GET /api/structures/:id/children`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "child-structure-id",
      "name": "SPV 1",
      "parentStructureId": "parent-structure-id",
      "hierarchyLevel": 2
      // ... other fields
    }
  ]
}
```

### 6. Get Structure with Investors

**Endpoint:** `GET /api/structures/:id/with-investors`

**Access:** Private (Root/Admin only)

**Description:** Returns a structure with all investors (users with role=3) associated via the structure_investors junction table.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "structure-id",
    "name": "Tech Growth Fund I",
    "structure_investors": [
      {
        "investor": {
          "id": "user-id",
          "role": 3,
          "email": "investor@example.com",
          "fullName": "John Doe",
          "investorType": "Individual"
        }
      }
    ]
  }
}
```

**Note:** The `investor_id` field in the `structure_investors` junction table now references `users.id` where `role=3` (INVESTOR).

### 7. Update Structure

**Endpoint:** `PUT /api/structures/:id`

**Access:** Private (Root/Admin only)

**Request Body:** (All fields optional)
```json
{
  "name": "Updated Fund Name",
  "description": "Updated description",
  "status": "Active",
  "totalCommitment": 60000000,
  "managementFee": 2.5,
  "carriedInterest": 20.0
  // ... any other updateable fields
}
```

**Allowed Fields:**
- `name`, `description`, `status`, `subtype`, `totalCommitment`
- `managementFee`, `carriedInterest`, `hurdleRate`, `waterfallType`
- `termYears`, `extensionYears`, `finalDate`
- `gp`, `fundAdmin`, `legalCounsel`, `auditor`, `taxAdvisor`
- `bankAccounts`, `baseCurrency`, `taxJurisdiction`
- `regulatoryStatus`, `investmentStrategy`, `targetReturns`
- `riskProfile`, `stage`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Structure updated successfully",
  "data": {
    "id": "structure-id",
    "name": "Updated Fund Name"
    // ... updated fields
  }
}
```

### 8. Update Structure Financials

**Endpoint:** `PATCH /api/structures/:id/financials`

**Access:** Private (Root/Admin only)

**Request Body:**
```json
{
  "totalCalled": 15000000,        // Optional
  "totalDistributed": 5000000,    // Optional
  "totalInvested": 12000000       // Optional
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Structure financials updated successfully",
  "data": {
    "id": "structure-id",
    "totalCalled": 15000000,
    "totalDistributed": 5000000,
    "totalInvested": 12000000
  }
}
```

### 9. Add Admin/Support to Structure

**Endpoint:** `POST /api/structures/:id/admins`

**Access:** Private (Root/Admin only)

**Request Body:**
```json
{
  "userId": "user-id",                    // Required
  "role": 1,                              // Required: 1 (Admin) or 2 (Support)
  "canEdit": true,                        // Optional, default: true
  "canDelete": false,                     // Optional, default: false
  "canManageInvestors": true,             // Optional, default: true
  "canManageDocuments": true              // Optional, default: true
}
```

**Validation Rules:**
- `userId`: Required, must exist
- `role`: Required, must be 1 (Admin) or 2 (Support)
- Target user must have Admin or Support role
- User cannot be already assigned to structure

**Success Response (201):**
```json
{
  "success": true,
  "message": "User added to structure successfully",
  "data": {
    "structureId": "structure-id",
    "userId": "user-id",
    "role": 1,
    "canEdit": true,
    "canDelete": false
  }
}
```

### 10. Get Structure Admins

**Endpoint:** `GET /api/structures/:id/admins`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "structureId": "structure-id",
      "userId": "user-id",
      "role": 1,
      "canEdit": true,
      "canDelete": false
    }
  ]
}
```

### 11. Remove Admin/Support from Structure

**Endpoint:** `DELETE /api/structures/:id/admins/:targetUserId`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "message": "User removed from structure successfully"
}
```

### 12. Delete Structure

**Endpoint:** `DELETE /api/structures/:id`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Structure deleted successfully"
}
```

---

## Investors API

> **Note:** Investors are now managed as Users with role=3 (INVESTOR). All investor data is stored in the users table with investor-specific fields. The endpoints below create and manage users with the INVESTOR role.

### 1. Create Investor

**Endpoint:** `POST /api/investors`

**Access:** Private (Root/Admin only)

**Description:** Creates a new user with the INVESTOR role (role=3) and investor-specific fields.

**Request Body:**
```json
{
  // Common fields
  "investorType": "Individual",               // Required: Individual, Institution, Fund of Funds, Family Office
  "email": "john.doe@example.com",            // Required, unique
  "phoneNumber": "+1-555-0123",               // Optional
  "country": "United States",                 // Optional
  "taxId": "123-45-6789",                     // Optional
  "kycStatus": "Pending",                     // Optional, default: Pending
  "accreditedInvestor": true,                 // Optional, default: false
  "riskTolerance": "Moderate",                // Optional
  "investmentPreferences": {},                // Optional, JSON object

  // Individual fields (required if investorType is Individual)
  "fullName": "John Doe",                     // Required for Individual
  "dateOfBirth": "1985-03-15",                // Optional
  "nationality": "American",                  // Optional
  "passportNumber": "AB1234567",              // Optional
  "addressLine1": "123 Main St",              // Optional
  "addressLine2": "Apt 4B",                   // Optional
  "city": "New York",                         // Optional
  "state": "NY",                              // Optional
  "postalCode": "10001",                      // Optional

  // Institution fields (required if investorType is Institution)
  "institutionName": "Tech Investments LLC",  // Required for Institution
  "institutionType": "LLC",                   // Optional
  "registrationNumber": "REG123456",          // Optional
  "legalRepresentative": "Jane Smith",        // Optional

  // Fund of Funds fields (required if investorType is Fund of Funds)
  "fundName": "Global Ventures Fund",         // Required for Fund of Funds
  "fundManager": "John Manager",              // Optional
  "aum": 100000000,                           // Optional (Assets Under Management)

  // Family Office fields (required if investorType is Family Office)
  "officeName": "Smith Family Office",        // Required for Family Office
  "familyName": "Smith",                      // Optional
  "principalContact": "Robert Smith",         // Optional
  "assetsUnderManagement": 500000000          // Optional
}
```

**Validation Rules:**
- `investorType`: Required, must be one of: Individual, Institution, Fund of Funds, Family Office
- `email`: Required, valid email format, unique across all users
- Automatically sets `role` to 3 (INVESTOR)
- Type-specific required fields:
  - Individual: `fullName`
  - Institution: `institutionName`
  - Fund of Funds: `fundName`
  - Family Office: `officeName`

**Success Response (201):**
```json
{
  "success": true,
  "message": "Investor created successfully",
  "data": {
    "id": "user-id",
    "role": 3,
    "investorType": "Individual",
    "email": "john.doe@example.com",
    "fullName": "John Doe",
    "kycStatus": "Pending",
    "accreditedInvestor": true,
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Invalid investor type"
}
```
```json
{
  "success": false,
  "message": "User with this email already exists"
}
```
```json
{
  "success": false,
  "message": "Full name is required for individual investors"
}
```

### 2. Get All Investors

**Endpoint:** `GET /api/investors`

**Access:** Private (Root/Admin only)

**Description:** Returns all users with role=3 (INVESTOR). Filters by investor-specific criteria.

**Query Parameters:**
- `investorType`: Filter by type (Individual, Institution, Fund of Funds, Family Office)
- `kycStatus`: Filter by KYC status
- `accreditedInvestor`: Filter by accredited status (true/false)

**Success Response (200):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "user-id",
      "role": 3,
      "investorType": "Individual",
      "email": "john.doe@example.com",
      "fullName": "John Doe",
      "kycStatus": "Approved",
      "isActive": true
      // ... other fields based on type
    }
  ]
}
```

### 3. Search Investors

**Endpoint:** `GET /api/investors/search?q=searchTerm`

**Access:** Private (all authenticated users)

**Query Parameters:**
- `q`: Search query (minimum 2 characters)

**Description:** Searches across email, fullName, institutionName, fundName, and officeName fields for users with role=3 (INVESTOR).

**Success Response (200):**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "user-id",
      "role": 3,
      "investorType": "Individual",
      "email": "john.doe@example.com",
      "fullName": "John Doe"
    }
  ]
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Search query must be at least 2 characters"
}
```

### 4. Get Investor by ID

**Endpoint:** `GET /api/investors/:id`

**Access:** Private (Root/Admin can access any, Investors can access their own)

**Description:** Returns a user with role=3 (INVESTOR) by their user ID. Verifies the user is an investor.

**Access Control:**
- Root (role=0): Can access any investor's data
- Admin (role=1): Can access any investor's data
- Investor (role=3): Can only access their own data (when `:id` matches their user ID)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "role": 3,
    "investorType": "Individual",
    "email": "john.doe@example.com",
    "fullName": "John Doe",
    "phoneNumber": "+1-555-0123",
    "country": "United States",
    "kycStatus": "Approved",
    "accreditedInvestor": true,
    "isActive": true
    // ... all investor and user fields
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Invalid investor ID format"
}
```
```json
{
  "success": false,
  "message": "Investor not found"
}
```
```json
{
  "success": false,
  "message": "User is not an investor"
}
```
```json
{
  "success": false,
  "message": "Unauthorized access to investor data"
}
```

### 5. Get Investor with Structures

**Endpoint:** `GET /api/investors/:id/with-structures`

**Access:** Private (Root/Admin can access any, Investors can access their own)

**Description:** Returns an investor (user with role=3) along with all structures they're invested in via the structure_investors junction table.

**Access Control:**
- Root (role=0): Can access any investor's data
- Admin (role=1): Can access any investor's data
- Investor (role=3): Can only access their own data (when `:id` matches their user ID)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "role": 3,
    "email": "john.doe@example.com",
    "fullName": "John Doe",
    "structure_investors": [
      {
        "structure": {
          "id": "structure-id",
          "name": "Tech Growth Fund I",
          "type": "Fund"
        }
      }
    ]
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Unauthorized access to investor data"
}
```

### 6. Get Investor Portfolio Summary

**Endpoint:** `GET /api/investors/:id/portfolio`

**Access:** Private (Root/Admin can access any, Investors can access their own)

**Description:** Returns portfolio summary for an investor (user with role=3) by calling the database function `get_investor_portfolio_summary`.

**Access Control:**
- Root (role=0): Can access any investor's portfolio
- Admin (role=1): Can access any investor's portfolio
- Investor (role=3): Can only access their own portfolio (when `:id` matches their user ID)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalCommitment": 1000000,
    "totalCalled": 600000,
    "totalDistributed": 200000,
    "portfolioValue": 1200000,
    "irr": 15.5,
    "moic": 1.2
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Unauthorized access to investor data"
}
```

### 7. Get Investor Capital Calls Summary

**Endpoint:** `GET /api/investors/:id/capital-calls`

**Access:** Private (Root/Admin/Support can access any, Investors can access their own)

**Description:** Returns capital calls summary for an investor, including all structures they're invested in and detailed capital call allocations with payment status.

**Access Control:**
- Root (role=0): Can access any investor's capital calls
- Admin (role=1): Can access any investor's capital calls
- Support (role=2): Can access any investor's capital calls
- Investor (role=3): Can only access their own capital calls (when `:id` matches their user ID)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "investorId": "user-id",
    "investorName": "John Doe",
    "investorEmail": "john.doe@example.com",
    "summary": {
      "totalCalled": 5000000,
      "totalPaid": 4000000,
      "outstanding": 1000000,
      "totalCalls": 10
    },
    "structures": [
      {
        "id": "structure-id",
        "name": "Tech Growth Fund I",
        "type": "Fund",
        "status": "Active"
      }
    ],
    "capitalCalls": [
      {
        "id": "capital-call-id",
        "structureId": "structure-id",
        "structureName": "Tech Growth Fund I",
        "callNumber": "CC-2024-001",
        "callDate": "2024-02-01T00:00:00Z",
        "dueDate": "2024-03-01T00:00:00Z",
        "allocatedAmount": 500000,
        "paidAmount": 500000,
        "outstanding": 0,
        "status": "Paid",
        "purpose": "Investment in TechCo"
      },
      {
        "id": "capital-call-id-2",
        "structureId": "structure-id",
        "structureName": "Tech Growth Fund I",
        "callNumber": "CC-2024-002",
        "callDate": "2024-05-01T00:00:00Z",
        "dueDate": "2024-06-01T00:00:00Z",
        "allocatedAmount": 500000,
        "paidAmount": 300000,
        "outstanding": 200000,
        "status": "Partially Paid",
        "purpose": "Follow-on investment"
      }
    ]
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Invalid investor ID format"
}
```
```json
{
  "success": false,
  "message": "Investor not found"
}
```
```json
{
  "success": false,
  "message": "User is not an investor"
}
```
```json
{
  "success": false,
  "message": "Unauthorized access to investor data"
}
```

**Notes:**
- Returns empty arrays if no capital calls found
- Only shows structures with "Active" status
- Capital calls are ordered by call date (most recent first)
- Outstanding amount is calculated as allocatedAmount - paidAmount
- This endpoint bridges the users table (role=3) with the investors table via email matching

### 8. Update Investor

**Endpoint:** `PUT /api/investors/:id`

**Access:** Private (Root/Admin only)

**Description:** Updates an investor user's information. Verifies the user has role=3 (INVESTOR) before updating.

**Request Body:** (All fields optional)
```json
{
  "email": "newemail@example.com",
  "phoneNumber": "+1-555-9999",
  "kycStatus": "Approved",
  "accreditedInvestor": true,
  "fullName": "John Updated Doe",
  "isActive": true
  // ... any other updateable fields
}
```

**Allowed Fields:**
- Common: `email`, `phoneNumber`, `country`, `taxId`, `kycStatus`, `accreditedInvestor`, `riskTolerance`, `investmentPreferences`, `investorType`
- Individual: `fullName`, `dateOfBirth`, `nationality`, `passportNumber`, `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`
- Institution: `institutionName`, `institutionType`, `registrationNumber`, `legalRepresentative`
- Fund of Funds: `fundName`, `fundManager`, `aum`
- Family Office: `officeName`, `familyName`, `principalContact`, `assetsUnderManagement`
- User fields: `isActive`, `firstName`, `lastName`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Investor updated successfully",
  "data": {
    "id": "user-id",
    "role": 3,
    "email": "newemail@example.com",
    "isActive": true
    // ... updated fields
  }
}
```

### 9. Delete Investor

**Endpoint:** `DELETE /api/investors/:id`

**Access:** Private (Root/Admin only)

**Description:** Deletes an investor user. Verifies the user has role=3 (INVESTOR) before deletion. This will delete the user record from the users table.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Investor deleted successfully"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "User is not an investor"
}
```

---

### Database Migration Notes

The Investor model has been merged into the User model. To complete this migration in your database:

1. **Add investor columns to `users` table:**
   - `investor_type` (text)
   - `phone_number` (text)
   - `tax_id` (text)
   - `accredited_investor` (boolean)
   - `risk_tolerance` (text)
   - `investment_preferences` (jsonb)
   - Individual fields: `full_name`, `date_of_birth`, `nationality`, `passport_number`, `address_line1`, `address_line2`, `city`, `state`, `postal_code`
   - Institution fields: `institution_name`, `institution_type`, `registration_number`, `legal_representative`
   - Fund of Funds fields: `fund_name`, `fund_manager`, `aum`
   - Family Office fields: `office_name`, `family_name`, `principal_contact`, `assets_under_management`

2. **Update foreign key references:**
   - `structure_investors.investor_id` → references `users.id` (where role=3)
   - `capital_call_allocations.investor_id` → references `users.id` (where role=3)
   - `distribution_allocations.investor_id` → references `users.id` (where role=3)
   - Any other tables referencing `investors.id` should now reference `users.id`

3. **Migrate existing data:**
   - If you have existing data in an `investors` table, migrate it to the `users` table with `role=3`
   - Update all foreign key references to point to the new user IDs

4. **Drop deprecated table:**
   - After confirming all data is migrated and foreign keys are updated, drop the `investors` table

5. **Database function updates:**
   - Update `get_investor_portfolio_summary` function to work with `users` table where `role=3`

---

## Investments API

### 1. Create Investment

**Endpoint:** `POST /api/investments`

**Access:** Private (Root/Admin only)

**Request Body:**
```json
{
  "structureId": "structure-id",              // Required
  "projectId": "project-id",                  // Optional
  "investmentName": "TechCo Series B",        // Required
  "investmentType": "EQUITY",                 // Required: EQUITY, DEBT, MIXED
  "investmentDate": "2024-01-15T00:00:00Z",   // Optional, default: current date

  // Equity fields (required if type is EQUITY or MIXED)
  "equityInvested": 5000000,                  // Required for EQUITY/MIXED (> 0)
  "equityOwnershipPercent": 15.5,             // Optional

  // Debt fields (required if type is DEBT or MIXED)
  "principalProvided": 3000000,               // Required for DEBT/MIXED (> 0)
  "interestRate": 8.5,                        // Required for DEBT/MIXED (>= 0)
  "maturityDate": "2027-01-15T00:00:00Z",     // Optional

  // Additional fields
  "sector": "Technology",                     // Optional
  "geography": "United States",               // Optional
  "currency": "USD",                          // Optional, default: USD
  "notes": "Strategic investment"             // Optional
}
```

**Validation Rules:**
- `structureId`: Required, must exist and belong to user
- `investmentName`: Required, trimmed
- `investmentType`: Required, must be EQUITY, DEBT, or MIXED
- For EQUITY/MIXED: `equityInvested` must be > 0
- For DEBT/MIXED: `principalProvided` must be > 0, `interestRate` must be >= 0

**Success Response (201):**
```json
{
  "success": true,
  "message": "Investment created successfully",
  "data": {
    "id": "investment-id",
    "structureId": "structure-id",
    "investmentName": "TechCo Series B",
    "investmentType": "EQUITY",
    "investmentDate": "2024-01-15T00:00:00Z",
    "status": "Active",
    "equityInvested": 5000000,
    "equityOwnershipPercent": 15.5,
    "equityCurrentValue": 5000000,
    "currency": "USD",
    "createdBy": "user-id",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Invalid investment type"
}
```
```json
{
  "success": false,
  "message": "Equity invested amount is required"
}
```

### 2. Get All Investments

**Endpoint:** `GET /api/investments`

**Access:** Private (Root/Admin only)

**Query Parameters:**
- `structureId`: Filter by structure
- `projectId`: Filter by project
- `investmentType`: Filter by type (EQUITY, DEBT, MIXED)
- `status`: Filter by status

**Success Response (200):**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": "investment-id",
      "structureId": "structure-id",
      "investmentName": "TechCo Series B",
      "investmentType": "EQUITY",
      "status": "Active",
      "equityInvested": 5000000
      // ... other fields
    }
  ]
}
```

### 3. Get Active Investments

**Endpoint:** `GET /api/investments/active?structureId=structure-id`

**Access:** Private (Root/Admin only)

**Query Parameters:**
- `structureId`: Optional filter

**Success Response (200):**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "id": "investment-id",
      "investmentName": "TechCo Series B",
      "status": "Active"
    }
  ]
}
```

### 4. Get Investment by ID

**Endpoint:** `GET /api/investments/:id`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "investment-id",
    "structureId": "structure-id",
    "investmentName": "TechCo Series B",
    "investmentType": "EQUITY",
    "equityInvested": 5000000,
    "equityCurrentValue": 6500000,
    "irrPercent": 18.5,
    "moic": 1.3
    // ... all investment fields
  }
}
```

### 5. Get Investment with Structure

**Endpoint:** `GET /api/investments/:id/with-structure`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "investment-id",
    "investmentName": "TechCo Series B",
    "structure": {
      "id": "structure-id",
      "name": "Tech Growth Fund I",
      "type": "Fund"
    }
  }
}
```

### 6. Update Investment

**Endpoint:** `PUT /api/investments/:id`

**Access:** Private (Root/Admin only)

**Request Body:** (All fields optional)
```json
{
  "investmentName": "Updated Name",
  "status": "Active",
  "equityInvested": 5500000,
  "equityCurrentValue": 7000000,
  "principalRepaid": 1000000,
  "interestReceived": 250000,
  "sector": "FinTech",
  "notes": "Updated notes"
}
```

**Allowed Fields:**
- `investmentName`, `status`
- `equityInvested`, `equityOwnershipPercent`, `equityCurrentValue`
- `principalProvided`, `interestRate`, `maturityDate`
- `principalRepaid`, `interestReceived`, `outstandingPrincipal`
- `sector`, `geography`, `currency`, `notes`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Investment updated successfully",
  "data": {
    "id": "investment-id",
    "investmentName": "Updated Name"
    // ... updated fields
  }
}
```

### 7. Update Investment Performance

**Endpoint:** `PATCH /api/investments/:id/performance`

**Access:** Private (Root/Admin only)

**Request Body:**
```json
{
  "irrPercent": 18.5,               // Optional
  "moic": 1.3,                      // Optional
  "totalReturns": 1500000,          // Optional
  "equityCurrentValue": 6500000,    // Optional
  "outstandingPrincipal": 2000000   // Optional
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Performance metrics updated successfully",
  "data": {
    "id": "investment-id",
    "irrPercent": 18.5,
    "moic": 1.3,
    "totalReturns": 1500000
  }
}
```

### 8. Mark Investment as Exited

**Endpoint:** `PATCH /api/investments/:id/exit`

**Access:** Private (Root/Admin only)

**Request Body:**
```json
{
  "exitDate": "2024-06-15T00:00:00Z",     // Optional, default: current date
  "equityExitValue": 8000000              // Optional
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Investment marked as exited successfully",
  "data": {
    "id": "investment-id",
    "status": "Exited",
    "exitDate": "2024-06-15T00:00:00Z",
    "equityExitValue": 8000000
  }
}
```

### 9. Get Structure Portfolio Summary

**Endpoint:** `GET /api/investments/structure/:structureId/portfolio`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalInvested": 50000000,
    "currentValue": 65000000,
    "totalReturns": 15000000,
    "averageIrr": 16.5,
    "averageMoic": 1.3,
    "activeInvestments": 12,
    "exitedInvestments": 3
  }
}
```

### 10. Delete Investment

**Endpoint:** `DELETE /api/investments/:id`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Investment deleted successfully"
}
```

---

## Capital Calls API

### 1. Create Capital Call

**Endpoint:** `POST /api/capital-calls`

**Access:** Private (Root/Admin only)

**Request Body:**
```json
{
  "structureId": "structure-id",                    // Required
  "callNumber": "CC-2024-001",                      // Required
  "callDate": "2024-02-01T00:00:00Z",               // Optional, default: current date
  "dueDate": "2024-03-01T00:00:00Z",                // Optional, default: 30 days from now
  "totalCallAmount": 5000000,                       // Required (> 0)
  "purpose": "Investment in TechCo",                // Optional
  "notes": "First capital call for Q1 2024",        // Optional
  "investmentId": "investment-id",                  // Optional
  "createAllocations": true                         // Optional: auto-create allocations for all investors
}
```

**Validation Rules:**
- `structureId`: Required, must exist and belong to user
- `callNumber`: Required
- `totalCallAmount`: Required, must be > 0

**Success Response (201):**
```json
{
  "success": true,
  "message": "Capital call created successfully",
  "data": {
    "capitalCall": {
      "id": "capital-call-id",
      "structureId": "structure-id",
      "callNumber": "CC-2024-001",
      "callDate": "2024-02-01T00:00:00Z",
      "dueDate": "2024-03-01T00:00:00Z",
      "totalCallAmount": 5000000,
      "totalPaidAmount": 0,
      "totalUnpaidAmount": 5000000,
      "status": "Draft",
      "createdBy": "user-id",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "allocations": [
      // Array of allocations if createAllocations was true
    ]
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Total call amount must be positive"
}
```

### 2. Get All Capital Calls

**Endpoint:** `GET /api/capital-calls`

**Access:** Private (Root/Admin only)

**Query Parameters:**
- `structureId`: Filter by structure
- `status`: Filter by status (Draft, Sent, Partially Paid, Fully Paid, Overdue)

**Success Response (200):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "capital-call-id",
      "structureId": "structure-id",
      "callNumber": "CC-2024-001",
      "totalCallAmount": 5000000,
      "totalPaidAmount": 3000000,
      "totalUnpaidAmount": 2000000,
      "status": "Partially Paid"
      // ... other fields
    }
  ]
}
```

### 3. Get Capital Call by ID

**Endpoint:** `GET /api/capital-calls/:id`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "capital-call-id",
    "structureId": "structure-id",
    "callNumber": "CC-2024-001",
    "callDate": "2024-02-01T00:00:00Z",
    "dueDate": "2024-03-01T00:00:00Z",
    "totalCallAmount": 5000000,
    "status": "Sent"
    // ... all fields
  }
}
```

### 4. Get Capital Call with Allocations

**Endpoint:** `GET /api/capital-calls/:id/with-allocations`

**Access:** Private (Root/Admin only)

**Description:** Returns a capital call with all allocations. The `investorId` in allocations references users with role=3 (INVESTOR).

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "capital-call-id",
    "callNumber": "CC-2024-001",
    "totalCallAmount": 5000000,
    "allocations": [
      {
        "investorId": "user-id",
        "amount": 1000000,
        "paidAmount": 1000000,
        "status": "Paid"
      }
    ]
  }
}
```

### 5. Get Capital Call Summary for Structure

**Endpoint:** `GET /api/capital-calls/structure/:structureId/summary`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalCalls": 10,
    "totalCalled": 50000000,
    "totalPaid": 45000000,
    "totalUnpaid": 5000000,
    "avgPaymentRate": 90.0
  }
}
```

### 6. Update Capital Call

**Endpoint:** `PUT /api/capital-calls/:id`

**Access:** Private (Root/Admin only)

**Request Body:** (All fields optional)
```json
{
  "callDate": "2024-02-15T00:00:00Z",
  "dueDate": "2024-03-15T00:00:00Z",
  "totalCallAmount": 5500000,
  "purpose": "Updated purpose",
  "notes": "Updated notes",
  "status": "Sent"
}
```

**Allowed Fields:**
- `callDate`, `dueDate`, `totalCallAmount`, `purpose`, `notes`, `status`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Capital call updated successfully",
  "data": {
    "id": "capital-call-id",
    "totalCallAmount": 5500000
    // ... updated fields
  }
}
```

### 7. Mark Capital Call as Sent

**Endpoint:** `PATCH /api/capital-calls/:id/send`

**Access:** Private (Root/Admin only)

**Validation:** Capital call must be in Draft status

**Success Response (200):**
```json
{
  "success": true,
  "message": "Capital call marked as sent",
  "data": {
    "id": "capital-call-id",
    "status": "Sent"
  }
}
```

### 8. Mark Capital Call as Fully Paid

**Endpoint:** `PATCH /api/capital-calls/:id/mark-paid`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Capital call marked as paid",
  "data": {
    "id": "capital-call-id",
    "status": "Fully Paid",
    "totalPaidAmount": 5000000,
    "totalUnpaidAmount": 0
  }
}
```

### 9. Update Capital Call Payment

**Endpoint:** `PATCH /api/capital-calls/:id/update-payment`

**Access:** Private (Root/Admin only)

**Request Body:**
```json
{
  "paidAmount": 1000000    // Required (> 0)
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payment amounts updated successfully",
  "data": {
    "id": "capital-call-id",
    "totalPaidAmount": 4000000,
    "totalUnpaidAmount": 1000000,
    "status": "Partially Paid"
  }
}
```

### 10. Create Allocations for Capital Call

**Endpoint:** `POST /api/capital-calls/:id/create-allocations`

**Access:** Private (Root/Admin only)

**Description:** Automatically creates allocations for all investors (users with role=3) in the structure. The `investorId` in allocations will be the user ID.

**Success Response (201):**
```json
{
  "success": true,
  "message": "Allocations created successfully",
  "data": [
    {
      "capitalCallId": "capital-call-id",
      "investorId": "user-id-1",
      "amount": 2000000,
      "status": "Pending"
    },
    {
      "capitalCallId": "capital-call-id",
      "investorId": "user-id-2",
      "amount": 3000000,
      "status": "Pending"
    }
  ]
}
```

### 11. Delete Capital Call

**Endpoint:** `DELETE /api/capital-calls/:id`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Capital call deleted successfully"
}
```

---

## Distributions API

### 1. Create Distribution

**Endpoint:** `POST /api/distributions`

**Access:** Private (Root/Admin only)

**Request Body:**
```json
{
  "structureId": "structure-id",                    // Required
  "distributionNumber": "DIST-2024-001",            // Required
  "distributionDate": "2024-06-15T00:00:00Z",       // Optional, default: current date
  "totalAmount": 2000000,                           // Required (> 0)
  "source": "Exit proceeds from TechCo",            // Optional
  "notes": "Q2 2024 distribution",                  // Optional
  "investmentId": "investment-id",                  // Optional

  // Source breakdown (optional)
  "sourceEquityGain": 1500000,                      // Optional, default: 0
  "sourceDebtInterest": 300000,                     // Optional, default: 0
  "sourceDebtPrincipal": 200000,                    // Optional, default: 0
  "sourceOther": 0,                                 // Optional, default: 0

  // Waterfall
  "waterfallApplied": false,                        // Optional, default: false
  "createAllocations": true                         // Optional: auto-create allocations
}
```

**Validation Rules:**
- `structureId`: Required, must exist and belong to user
- `distributionNumber`: Required
- `totalAmount`: Required, must be > 0

**Success Response (201):**
```json
{
  "success": true,
  "message": "Distribution created successfully",
  "data": {
    "distribution": {
      "id": "distribution-id",
      "structureId": "structure-id",
      "distributionNumber": "DIST-2024-001",
      "distributionDate": "2024-06-15T00:00:00Z",
      "totalAmount": 2000000,
      "status": "Draft",
      "sourceEquityGain": 1500000,
      "sourceDebtInterest": 300000,
      "waterfallApplied": false,
      "createdBy": "user-id",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "allocations": []
  }
}
```

### 2. Get All Distributions

**Endpoint:** `GET /api/distributions`

**Access:** Private (Root/Admin only)

**Query Parameters:**
- `structureId`: Filter by structure
- `status`: Filter by status (Draft, Sent, Paid)

**Success Response (200):**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "id": "distribution-id",
      "structureId": "structure-id",
      "distributionNumber": "DIST-2024-001",
      "totalAmount": 2000000,
      "status": "Paid"
      // ... other fields
    }
  ]
}
```

### 3. Get Distribution by ID

**Endpoint:** `GET /api/distributions/:id`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "distribution-id",
    "structureId": "structure-id",
    "distributionNumber": "DIST-2024-001",
    "distributionDate": "2024-06-15T00:00:00Z",
    "totalAmount": 2000000,
    "status": "Draft"
    // ... all fields
  }
}
```

### 4. Get Distribution with Allocations

**Endpoint:** `GET /api/distributions/:id/with-allocations`

**Access:** Private (Root/Admin only)

**Description:** Returns a distribution with all allocations. The `investorId` in allocations references users with role=3 (INVESTOR).

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "distribution-id",
    "distributionNumber": "DIST-2024-001",
    "totalAmount": 2000000,
    "allocations": [
      {
        "investorId": "user-id",
        "amount": 400000,
        "status": "Paid"
      }
    ]
  }
}
```

### 5. Get Distribution Summary for Structure

**Endpoint:** `GET /api/distributions/structure/:structureId/summary`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalDistributions": 15,
    "totalDistributed": 10000000,
    "avgDistributionSize": 666667,
    "largestDistribution": 2000000
  }
}
```

### 6. Update Distribution

**Endpoint:** `PUT /api/distributions/:id`

**Access:** Private (Root/Admin only)

**Request Body:** (All fields optional)
```json
{
  "distributionDate": "2024-07-01T00:00:00Z",
  "totalAmount": 2200000,
  "source": "Updated source",
  "notes": "Updated notes",
  "status": "Sent",
  "sourceEquityGain": 1600000,
  "waterfallApplied": true,
  "lpTotalAmount": 1760000,
  "gpTotalAmount": 440000
}
```

**Allowed Fields:**
- `distributionDate`, `totalAmount`, `source`, `notes`, `status`
- `sourceEquityGain`, `sourceDebtInterest`, `sourceDebtPrincipal`, `sourceOther`
- `waterfallApplied`, `tier1Amount`, `tier2Amount`, `tier3Amount`, `tier4Amount`
- `lpTotalAmount`, `gpTotalAmount`, `managementFeeAmount`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Distribution updated successfully",
  "data": {
    "id": "distribution-id",
    "totalAmount": 2200000
    // ... updated fields
  }
}
```

### 7. Apply Waterfall Calculation

**Endpoint:** `POST /api/distributions/:id/apply-waterfall`

**Access:** Private (Root/Admin only)

**Description:** Applies waterfall calculation to the distribution based on structure's waterfall type

**Validation:** Waterfall must not be already applied

**Success Response (200):**
```json
{
  "success": true,
  "message": "Waterfall calculation applied successfully",
  "data": {
    "id": "distribution-id",
    "waterfallApplied": true,
    "tier1Amount": 1500000,
    "tier2Amount": 300000,
    "tier3Amount": 100000,
    "tier4Amount": 100000,
    "lpTotalAmount": 1600000,
    "gpTotalAmount": 400000
  }
}
```

### 8. Mark Distribution as Paid

**Endpoint:** `PATCH /api/distributions/:id/mark-paid`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Distribution marked as paid",
  "data": {
    "id": "distribution-id",
    "status": "Paid"
  }
}
```

### 9. Create Allocations for Distribution

**Endpoint:** `POST /api/distributions/:id/create-allocations`

**Access:** Private (Root/Admin only)

**Description:** Automatically creates allocations for all investors (users with role=3) in the structure. The `investorId` in allocations will be the user ID.

**Success Response (201):**
```json
{
  "success": true,
  "message": "Allocations created successfully",
  "data": [
    {
      "distributionId": "distribution-id",
      "investorId": "user-id",
      "amount": 400000,
      "status": "Pending"
    }
  ]
}
```

### 10. Get Investor Distribution Total

**Endpoint:** `GET /api/distributions/investor/:investorId/total?structureId=structure-id`

**Access:** Private (Root/Admin only)

**Description:** Returns total distributions for an investor (user with role=3) in a specific structure. The `investorId` parameter should be the user ID.

**Query Parameters:**
- `structureId`: Required

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "investorId": "user-id",
    "structureId": "structure-id",
    "totalDistributed": 5000000,
    "distributionCount": 12
  }
}
```

### 11. Delete Distribution

**Endpoint:** `DELETE /api/distributions/:id`

**Access:** Private (Root/Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Distribution deleted successfully"
}
```

---

## Subscriptions API

### 1. Create Subscription

**Endpoint:** `POST /api/subscriptions`

**Access:** Private

**Request Body:**
```json
{
  "structureId": "structure-id",        // Required
  "userId": "user-id",                  // Required
  "fundId": "fund-id",                  // Required
  "requestedAmount": "1000000",         // Required
  "currency": "USD",                    // Required
  "status": "pending",                  // Optional, default: pending
  "paymentId": "payment-id"             // Optional
}
```

**Validation Rules:**
- All required fields must be provided
- Fields are trimmed before saving

**Success Response (201):**
```json
{
  "success": true,
  "message": "Subscription created successfully",
  "data": {
    "id": "subscription-id",
    "structureId": "structure-id",
    "userId": "user-id",
    "fundId": "fund-id",
    "requestedAmount": "1000000",
    "currency": "USD",
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Get All Subscriptions

**Endpoint:** `GET /api/subscriptions`

**Access:** Private

**Query Parameters:**
- `structureId`: Filter by structure
- `userId`: Filter by user
- `fundId`: Filter by fund
- `status`: Filter by status
- `paymentId`: Filter by payment

**Success Response (200):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "subscription-id",
      "structureId": "structure-id",
      "userId": "user-id",
      "requestedAmount": "1000000",
      "status": "pending"
    }
  ]
}
```

### 3. Get Subscriptions by User

**Endpoint:** `GET /api/subscriptions/user/:userId`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "subscription-id",
      "structureId": "structure-id",
      "requestedAmount": "1000000",
      "status": "approved"
    }
  ]
}
```

### 4. Get Subscriptions by Structure

**Endpoint:** `GET /api/subscriptions/structure/:structureId`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": "subscription-id",
      "userId": "user-id",
      "requestedAmount": "500000",
      "status": "pending"
    }
  ]
}
```

### 5. Get Subscriptions by Status

**Endpoint:** `GET /api/subscriptions/status/:status`

**Access:** Private

**Valid Statuses:** pending, approved, rejected, completed, cancelled

**Success Response (200):**
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "id": "subscription-id",
      "structureId": "structure-id",
      "status": "approved"
    }
  ]
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Status must be one of: pending, approved, rejected, completed, cancelled"
}
```

### 6. Get Subscription by ID

**Endpoint:** `GET /api/subscriptions/:id`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "subscription-id",
    "structureId": "structure-id",
    "userId": "user-id",
    "fundId": "fund-id",
    "requestedAmount": "1000000",
    "currency": "USD",
    "status": "pending"
  }
}
```

### 7. Update Subscription

**Endpoint:** `PUT /api/subscriptions/:id`

**Access:** Private

**Request Body:** (All fields optional)
```json
{
  "structureId": "new-structure-id",
  "requestedAmount": "1500000",
  "currency": "EUR",
  "status": "approved",
  "paymentId": "new-payment-id"
}
```

**Allowed Fields:**
- `structureId`, `userId`, `fundId`, `requestedAmount`, `currency`, `status`, `paymentId`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Subscription updated successfully",
  "data": {
    "id": "subscription-id",
    "requestedAmount": "1500000",
    "status": "approved"
  }
}
```

### 8. Update Subscription Status

**Endpoint:** `PATCH /api/subscriptions/:id/status`

**Access:** Private

**Request Body:**
```json
{
  "status": "approved"    // Required: pending, approved, rejected, completed, cancelled
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Subscription status updated successfully",
  "data": {
    "id": "subscription-id",
    "status": "approved"
  }
}
```

### 9. Update Subscription Payment ID

**Endpoint:** `PATCH /api/subscriptions/:id/payment`

**Access:** Private

**Request Body:**
```json
{
  "paymentId": "new-payment-id"    // Required
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payment ID updated successfully",
  "data": {
    "id": "subscription-id",
    "paymentId": "new-payment-id"
  }
}
```

### 10. Delete Subscription

**Endpoint:** `DELETE /api/subscriptions/:id`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "message": "Subscription deleted successfully"
}
```

---

## Investment Subscriptions API

> **Note:** The `investorId` field in Investment Subscriptions now references `users.id` where `role=3` (INVESTOR), not a separate investors table.

### 1. Create Investment Subscription

**Endpoint:** `POST /api/investment-subscriptions`

**Access:** Private

**Description:** Creates a subscription linking an investment to an investor (user with role=3).

**Request Body:**
```json
{
  "investmentId": "investment-id",      // Required
  "investorId": "user-id",              // Required (must be user with role=3)
  "fundId": "fund-id",                  // Required
  "requestedAmount": "500000",          // Required
  "currency": "USD",                    // Required
  "adminNotes": "Priority investor"     // Optional
}
```

**Validation Rules:**
- All required fields must be provided
- `investorId` must reference a valid user with role=3 (INVESTOR)
- Fields are trimmed before saving
- Status defaults to "pending"
- linkedFundOwnershipCreated defaults to false

**Success Response (201):**
```json
{
  "success": true,
  "message": "Investment subscription created successfully",
  "data": {
    "id": "subscription-id",
    "investmentId": "investment-id",
    "investorId": "user-id",
    "fundId": "fund-id",
    "requestedAmount": "500000",
    "currency": "USD",
    "status": "pending",
    "linkedFundOwnershipCreated": false,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Get All Investment Subscriptions

**Endpoint:** `GET /api/investment-subscriptions`

**Access:** Private

**Query Parameters:**
- `investmentId`: Filter by investment
- `investorId`: Filter by investor
- `fundId`: Filter by fund
- `status`: Filter by status

**Success Response (200):**
```json
{
  "success": true,
  "count": 12,
  "data": [
    {
      "id": "subscription-id",
      "investmentId": "investment-id",
      "investorId": "investor-id",
      "requestedAmount": "500000",
      "status": "pending"
    }
  ]
}
```

### 3. Get Investment Subscription by ID

**Endpoint:** `GET /api/investment-subscriptions/:id`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "subscription-id",
    "investmentId": "investment-id",
    "investorId": "investor-id",
    "fundId": "fund-id",
    "requestedAmount": "500000",
    "currency": "USD",
    "status": "pending",
    "adminNotes": "Priority investor"
  }
}
```

### 4. Get Subscriptions by Investment

**Endpoint:** `GET /api/investment-subscriptions/investment/:investmentId`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "subscription-id",
      "investorId": "investor-id",
      "requestedAmount": "500000",
      "status": "approved"
    }
  ]
}
```

### 5. Get Subscriptions by Investor

**Endpoint:** `GET /api/investment-subscriptions/investor/:investorId`

**Access:** Private

**Description:** Returns all subscriptions for an investor. The `investorId` parameter should be the user ID of a user with role=3 (INVESTOR).

**Success Response (200):**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "id": "subscription-id",
      "investmentId": "investment-id",
      "investorId": "user-id",
      "requestedAmount": "500000",
      "status": "pending"
    }
  ]
}
```

### 6. Get Subscriptions by Status

**Endpoint:** `GET /api/investment-subscriptions/status/:status`

**Access:** Private

**Valid Statuses:** pending, submitted, approved, rejected, cancelled

**Success Response (200):**
```json
{
  "success": true,
  "count": 20,
  "data": [
    {
      "id": "subscription-id",
      "investmentId": "investment-id",
      "status": "approved"
    }
  ]
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Status must be one of: pending, submitted, approved, rejected, cancelled"
}
```

### 7. Update Investment Subscription

**Endpoint:** `PUT /api/investment-subscriptions/:id`

**Access:** Private

**Request Body:** (All fields optional)
```json
{
  "requestedAmount": "600000",
  "currency": "EUR",
  "status": "submitted",
  "approvalReason": "Approved by investment committee",
  "adminNotes": "Updated notes",
  "linkedFundOwnershipCreated": true
}
```

**Allowed Fields:**
- `requestedAmount`, `currency`, `status`, `approvalReason`, `adminNotes`, `linkedFundOwnershipCreated`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Investment subscription updated successfully",
  "data": {
    "id": "subscription-id",
    "requestedAmount": "600000",
    "status": "submitted"
  }
}
```

### 8. Submit Subscription

**Endpoint:** `PATCH /api/investment-subscriptions/:id/submit`

**Access:** Private

**Description:** Changes status from pending to submitted

**Success Response (200):**
```json
{
  "success": true,
  "message": "Subscription submitted successfully",
  "data": {
    "id": "subscription-id",
    "status": "submitted"
  }
}
```

### 9. Approve Subscription

**Endpoint:** `PATCH /api/investment-subscriptions/:id/approve`

**Access:** Private

**Request Body:**
```json
{
  "approvalReason": "Meets all investment criteria"    // Optional
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Subscription approved successfully",
  "data": {
    "id": "subscription-id",
    "status": "approved",
    "approvalReason": "Meets all investment criteria"
  }
}
```

### 10. Reject Subscription

**Endpoint:** `PATCH /api/investment-subscriptions/:id/reject`

**Access:** Private

**Request Body:**
```json
{
  "approvalReason": "Insufficient funds verification"    // Required for rejection
}
```

**Validation:** Approval reason is required for rejection

**Success Response (200):**
```json
{
  "success": true,
  "message": "Subscription rejected successfully",
  "data": {
    "id": "subscription-id",
    "status": "rejected",
    "approvalReason": "Insufficient funds verification"
  }
}
```

### 11. Delete Investment Subscription

**Endpoint:** `DELETE /api/investment-subscriptions/:id`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "message": "Investment subscription deleted successfully"
}
```

---

## Payments API

### 1. Create Payment

**Endpoint:** `POST /api/payments`

**Access:** Private

**Content-Type:** `multipart/form-data` (supports file upload)

**Request Body:**
```json
{
  "email": "investor@example.com",      // Required
  "submissionId": "submission-id",      // Required
  "transactionHash": "0x123abc...",     // Optional
  "amount": "1000000",                  // Required
  "structureId": "structure-id",        // Required
  "contractId": "contract-id",          // Required
  "status": "pending",                  // Optional, default: pending
  "tokenId": "token-123"                // Optional
}
```

**File Upload:**
- Field name: `file`
- Allowed types: Images, PDFs
- File is stored in Supabase Storage at `payments/{submissionId}/`

**Validation Rules:**
- `email`, `submissionId`, `amount`, `structureId`, `contractId` are required
- Email is converted to lowercase
- All string fields are trimmed

**Success Response (201):**
```json
{
  "success": true,
  "message": "Payment created successfully",
  "data": {
    "id": "payment-id",
    "email": "investor@example.com",
    "submissionId": "submission-id",
    "paymentImage": "https://storage-url/payments/submission-id/receipt.pdf",
    "transactionHash": "0x123abc...",
    "amount": "1000000",
    "structureId": "structure-id",
    "contractId": "contract-id",
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Get All Payments

**Endpoint:** `GET /api/payments`

**Access:** Private

**Query Parameters:**
- `email`: Filter by email
- `submissionId`: Filter by submission
- `structureId`: Filter by structure
- `contractId`: Filter by contract
- `status`: Filter by status
- `transactionHash`: Filter by transaction hash

**Success Response (200):**
```json
{
  "success": true,
  "count": 25,
  "data": [
    {
      "id": "payment-id",
      "email": "investor@example.com",
      "submissionId": "submission-id",
      "amount": "1000000",
      "status": "completed"
    }
  ]
}
```

### 3. Get Payments by Email

**Endpoint:** `GET /api/payments/email/:email`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "payment-id",
      "email": "investor@example.com",
      "amount": "1000000",
      "status": "completed"
    }
  ]
}
```

### 4. Get Payment by Submission ID

**Endpoint:** `GET /api/payments/submission/:submissionId`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "payment-id",
    "email": "investor@example.com",
    "submissionId": "submission-id",
    "amount": "1000000",
    "paymentImage": "https://storage-url/receipt.pdf",
    "status": "completed"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Payment not found for this submission ID"
}
```

### 5. Get Payment by Transaction Hash

**Endpoint:** `GET /api/payments/transaction/:transactionHash`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "payment-id",
    "email": "investor@example.com",
    "transactionHash": "0x123abc...",
    "amount": "1000000",
    "status": "completed"
  }
}
```

### 6. Get Payments by Structure

**Endpoint:** `GET /api/payments/structure/:structureId`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "id": "payment-id",
      "structureId": "structure-id",
      "amount": "1000000",
      "status": "completed"
    }
  ]
}
```

### 7. Get Payments by Status

**Endpoint:** `GET /api/payments/status/:status`

**Access:** Private

**Valid Statuses:** pending, completed, failed, processing

**Success Response (200):**
```json
{
  "success": true,
  "count": 30,
  "data": [
    {
      "id": "payment-id",
      "amount": "1000000",
      "status": "completed"
    }
  ]
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Status must be one of: pending, completed, failed, processing"
}
```

### 8. Get Payment by ID

**Endpoint:** `GET /api/payments/:id`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "payment-id",
    "email": "investor@example.com",
    "submissionId": "submission-id",
    "paymentImage": "https://storage-url/receipt.pdf",
    "amount": "1000000",
    "structureId": "structure-id",
    "status": "completed"
  }
}
```

### 9. Update Payment

**Endpoint:** `PUT /api/payments/:id`

**Access:** Private

**Content-Type:** `multipart/form-data` (supports file upload)

**Request Body:** (All fields optional)
```json
{
  "email": "newemail@example.com",
  "transactionHash": "0xnew123...",
  "amount": "1200000",
  "status": "completed",
  "tokenId": "new-token-456"
}
```

**Allowed Fields:**
- `email`, `transactionHash`, `amount`, `status`, `tokenId`

**File Upload:** If new file is provided, it replaces the existing paymentImage

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payment updated successfully",
  "data": {
    "id": "payment-id",
    "email": "newemail@example.com",
    "amount": "1200000",
    "status": "completed"
  }
}
```

### 10. Update Payment Status

**Endpoint:** `PATCH /api/payments/:id/status`

**Access:** Private

**Request Body:**
```json
{
  "status": "completed"    // Required: pending, completed, failed, processing
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payment status updated successfully",
  "data": {
    "id": "payment-id",
    "status": "completed"
  }
}
```

### 11. Update Payment Transaction Hash

**Endpoint:** `PATCH /api/payments/:id/transaction`

**Access:** Private

**Request Body:**
```json
{
  "transactionHash": "0xnew123..."    // Required
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Transaction hash updated successfully",
  "data": {
    "id": "payment-id",
    "transactionHash": "0xnew123..."
  }
}
```

### 12. Delete Payment

**Endpoint:** `DELETE /api/payments/:id`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payment deleted successfully"
}
```

---

## KYC Sessions API

### 1. Create KYC Session

**Endpoint:** `POST /api/kyc-sessions`

**Access:** Private

**Request Body:**
```json
{
  "userId": "user-id",                          // Required
  "sessionId": "vudy-session-123",              // Required
  "provider": "Vudy",                           // Required
  "expiresAt": "2024-12-31T23:59:59.000Z"      // Optional
}
```

**Validation Rules:**
- `userId`, `sessionId`, `provider` are required
- If user already has a kycId, returns existing session instead of creating new one
- Status defaults to "pending"
- After creation, updates user's kycId field

**Success Response (201):**
```json
{
  "success": true,
  "message": "KYC session created successfully",
  "data": {
    "id": "kyc-session-id",
    "userId": "user-id",
    "sessionId": "vudy-session-123",
    "provider": "Vudy",
    "status": "pending",
    "expiresAt": "2024-12-31T23:59:59.000Z",
    "verificationData": {},
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "isExisting": false
}
```

**Success Response - Existing Session (200):**
```json
{
  "success": true,
  "message": "User already has an existing KYC session",
  "data": {
    "id": "existing-kyc-session-id",
    "userId": "user-id",
    "status": "completed"
  },
  "isExisting": true
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "User not found"
}
```

### 2. Get All KYC Sessions

**Endpoint:** `GET /api/kyc-sessions`

**Access:** Private

**Query Parameters:**
- `userId`: Filter by user
- `provider`: Filter by provider
- `status`: Filter by status

**Success Response (200):**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": "kyc-session-id",
      "userId": "user-id",
      "sessionId": "vudy-session-123",
      "provider": "Vudy",
      "status": "completed"
    }
  ]
}
```

### 3. Get KYC Session by ID

**Endpoint:** `GET /api/kyc-sessions/:id`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "kyc-session-id",
    "userId": "user-id",
    "sessionId": "vudy-session-123",
    "provider": "Vudy",
    "status": "completed",
    "verificationData": {
      "firstName": "John",
      "lastName": "Doe",
      "documentType": "passport"
    },
    "pdfUrl": "https://storage-url/kyc-report.pdf",
    "completedAt": "2024-01-16T14:30:00.000Z"
  }
}
```

### 4. Get KYC Session by Session ID

**Endpoint:** `GET /api/kyc-sessions/session/:sessionId`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "kyc-session-id",
    "sessionId": "vudy-session-123",
    "status": "completed"
  }
}
```

### 5. Get KYC Sessions by User

**Endpoint:** `GET /api/kyc-sessions/user/:userId`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "kyc-session-id",
      "userId": "user-id",
      "status": "completed",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### 6. Get Latest KYC Session for User

**Endpoint:** `GET /api/kyc-sessions/user/:userId/latest`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "kyc-session-id",
    "userId": "user-id",
    "status": "completed",
    "createdAt": "2024-01-16T10:30:00.000Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "No KYC sessions found for this user"
}
```

### 7. Get KYC Sessions by Status

**Endpoint:** `GET /api/kyc-sessions/status/:status`

**Access:** Private

**Valid Statuses:** pending, in_progress, completed, failed, expired

**Success Response (200):**
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "id": "kyc-session-id",
      "userId": "user-id",
      "status": "completed"
    }
  ]
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Status must be one of: pending, in_progress, completed, failed, expired"
}
```

### 8. Update KYC Session

**Endpoint:** `PUT /api/kyc-sessions/:id`

**Access:** Private

**Request Body:** (All fields optional)
```json
{
  "status": "completed",
  "verificationData": {
    "firstName": "John",
    "lastName": "Doe",
    "documentType": "passport",
    "documentNumber": "AB1234567"
  },
  "pdfUrl": "https://storage-url/kyc-report.pdf",
  "completedAt": "2024-01-16T14:30:00.000Z",
  "expiresAt": "2025-01-16T14:30:00.000Z"
}
```

**Allowed Fields:**
- `status`, `verificationData`, `pdfUrl`, `completedAt`, `expiresAt`

**Success Response (200):**
```json
{
  "success": true,
  "message": "KYC session updated successfully",
  "data": {
    "id": "kyc-session-id",
    "status": "completed",
    "completedAt": "2024-01-16T14:30:00.000Z"
  }
}
```

### 9. Mark KYC Session as Completed

**Endpoint:** `PATCH /api/kyc-sessions/:id/complete`

**Access:** Private

**Request Body:**
```json
{
  "verificationData": {                 // Required
    "firstName": "John",
    "lastName": "Doe",
    "documentType": "passport"
  },
  "pdfUrl": "https://storage-url/report.pdf"    // Optional
}
```

**Validation:** verificationData is required

**Success Response (200):**
```json
{
  "success": true,
  "message": "KYC session completed successfully",
  "data": {
    "id": "kyc-session-id",
    "status": "completed",
    "verificationData": {
      "firstName": "John",
      "lastName": "Doe",
      "documentType": "passport"
    },
    "completedAt": "2024-01-16T14:30:00.000Z"
  }
}
```

### 10. Mark KYC Session as Failed

**Endpoint:** `PATCH /api/kyc-sessions/:id/fail`

**Access:** Private

**Request Body:**
```json
{
  "reason": "Document verification failed"    // Optional
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "KYC session marked as failed",
  "data": {
    "id": "kyc-session-id",
    "status": "failed",
    "verificationData": {
      "failureReason": "Document verification failed"
    }
  }
}
```

### 11. Delete KYC Session

**Endpoint:** `DELETE /api/kyc-sessions/:id`

**Access:** Private

**Success Response (200):**
```json
{
  "success": true,
  "message": "KYC session deleted successfully"
}
```

---

## Firm Settings API

### 1. Get Firm Settings

**Endpoint:** `GET /api/firm-settings`

**Access:** Private

**Description:** Gets firm settings. If no settings exist, initializes with defaults.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "settings-id",
    "firmName": "My Investment Firm",
    "firmLogo": "https://storage-url/logo.png",
    "firmDescription": "Leading investment management firm",
    "firmWebsite": "https://example.com",
    "firmAddress": "123 Wall Street, New York, NY 10005",
    "firmPhone": "+1-555-0100",
    "firmEmail": "info@example.com",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Create Firm Settings

**Endpoint:** `POST /api/firm-settings`

**Access:** Private

**Description:** Creates firm settings (only if none exist)

**Request Body:**
```json
{
  "firmName": "My Investment Firm",                        // Optional, default: My Firm
  "firmLogo": "https://storage-url/logo.png",              // Optional
  "firmDescription": "Leading investment management",      // Optional
  "firmWebsite": "https://example.com",                    // Optional
  "firmAddress": "123 Wall Street",                        // Optional
  "firmPhone": "+1-555-0100",                              // Optional
  "firmEmail": "info@example.com"                          // Optional
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Firm settings created successfully",
  "data": {
    "id": "settings-id",
    "firmName": "My Investment Firm",
    "firmLogo": "https://storage-url/logo.png"
    // ... all fields
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Firm settings already exist. Use PUT to update."
}
```

### 3. Update Firm Settings (Without ID)

**Endpoint:** `PUT /api/firm-settings`

**Access:** Private

**Request Body:** (All fields optional)
```json
{
  "firmName": "Updated Firm Name",
  "firmLogo": "https://new-url/logo.png",
  "firmDescription": "Updated description",
  "firmWebsite": "https://newsite.com",
  "firmAddress": "456 New Street",
  "firmPhone": "+1-555-0200",
  "firmEmail": "newemail@example.com"
}
```

**Allowed Fields:**
- `firmName`, `firmLogo`, `firmDescription`, `firmWebsite`, `firmAddress`, `firmPhone`, `firmEmail`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Firm settings updated successfully",
  "data": {
    "id": "settings-id",
    "firmName": "Updated Firm Name"
    // ... updated fields
  }
}
```

### 4. Update Firm Settings by ID

**Endpoint:** `PUT /api/firm-settings/:id`

**Access:** Private

**Request Body:** (All fields optional)
```json
{
  "firmName": "Updated Firm Name",
  "firmEmail": "newemail@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Firm settings updated successfully",
  "data": {
    "id": "settings-id",
    "firmName": "Updated Firm Name"
  }
}
```

### 5. Delete Firm Settings

**Endpoint:** `DELETE /api/firm-settings`

**Access:** Private (Admin only)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Firm settings deleted successfully"
}
```

---

## Common Error Responses

### Authentication Errors

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### Authorization Errors

**403 Forbidden:**
```json
{
  "success": false,
  "message": "Unauthorized access to structure"
}
```

### Validation Errors

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Email is required"
}
```

```json
{
  "success": false,
  "message": "Invalid email format"
}
```

```json
{
  "success": false,
  "message": "No valid fields provided for update"
}
```

### Not Found Errors

**404 Not Found:**
```json
{
  "success": false,
  "message": "Structure not found"
}
```

### Server Errors

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "Error creating structure: [error details]"
}
```

---

## General Notes

### Field Types
- **UUID**: Standard UUID format (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- **Date/Time**: ISO 8601 format (e.g., `2024-01-15T10:30:00.000Z`)
- **Numbers**: Can be integers or decimals
- **Booleans**: `true` or `false`
- **JSON Objects**: Valid JSON structures

### Common Patterns

1. **Role-Based Access:**
   - Root (role 0) can access all resources
   - Admin (role 1) can only access their own resources
   - Support (role 2) has read-only access to assigned structures

2. **Required vs Optional:**
   - Required fields will return 400 error if missing
   - Optional fields use default values if not provided

3. **String Trimming:**
   - All string inputs are trimmed automatically
   - Email addresses are converted to lowercase

4. **Timestamps:**
   - `createdAt` is set automatically on creation
   - `updatedAt` is updated automatically on updates

5. **Cascading Deletes:**
   - Be careful when deleting structures, investors, or investments
   - Some related data may be deleted automatically

---

## Implementation Tips

### 1. Error Handling
Always check the `success` field in responses:
```javascript
const response = await fetch('/api/structures', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});

const result = await response.json();

if (!result.success) {
  // Handle error
  console.error(result.message);
  return;
}

// Use result.data
console.log(result.data);
```

### 2. Pagination
For endpoints returning large datasets, consider implementing pagination on the frontend using offset/limit patterns or cursor-based pagination.

### 3. Caching
Consider caching frequently accessed data like structures, investors, and firm settings to reduce API calls.

### 4. File Uploads
When uploading files (payments, documents), use `FormData`:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('email', 'user@example.com');
formData.append('amount', '1000000');

const response = await fetch('/api/payments', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### 5. Query Parameters
Build query strings for filtering:
```javascript
const params = new URLSearchParams({
  status: 'Active',
  type: 'Fund'
});

const response = await fetch(`/api/structures?${params}`);
```

---

This guide provides complete documentation for implementing all API endpoints in your frontend application. Each endpoint includes request/response examples, validation rules, and error handling patterns.
