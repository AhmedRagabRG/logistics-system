# Logistics Intelligence API Contract

**Feature**: Core Logistics Intelligence Engine & Admin Command Center  
**Version**: 1.0.0  
**Date**: 2026-04-28

---

## Overview

The Logistics Intelligence API provides endpoints for external workflow integration (n8n) and admin
dashboard operations. All endpoints accept and return JSON. Errors follow a consistent structure.

**Base Path**: `/api/v1`

---

## External Workflow Endpoints

### POST /api/v1/quote

Main ingress endpoint for n8n workflows. Receives a shipment request, validates it, resolves
geographical zones, calculates pricing, checks the toggle state, and returns a quote with status.

#### Request

**Headers**:
- `Content-Type: application/json`
- `Authorization: Bearer <auth_token>`

**Body**:

```json
{
  "origin_postal_code": "string (required, max 20 chars)",
  "destination_postal_code": "string (required, max 20 chars)",
  "weight_kg": "number (required, > 0)",
  "cargo_type": "string (optional, max 64 chars)",
  "language": "string (required, enum: ar, tr, en)",
  "channel": "string (required, enum: whatsapp, telegram, email)"
}
```

#### Response

**200 OK — Quote Generated (Ready to Send)**

```json
{
  "success": true,
  "data": {
    "quote_id": 123,
    "status": "ready_to_send",
    "origin_region": "DE-North",
    "destination_region": "SI-West",
    "base_price": 1500.00,
    "markup_percent": 15.00,
    "final_price": 1725.00,
    "currency": "TRY",
    "is_oversize": false,
    "message": "Quote ready for dispatch"
  }
}
```

**200 OK — Quote Generated (Pending Review)**

```json
{
  "success": true,
  "data": {
    "quote_id": 124,
    "status": "pending",
    "origin_region": "DE-North",
    "destination_region": "SI-West",
    "base_price": 1500.00,
    "markup_percent": 15.00,
    "final_price": 1725.00,
    "currency": "TRY",
    "is_oversize": false,
    "review_reason": "Manual Approval mode is active",
    "message": "Quote requires admin review before dispatch"
  }
}
```

**200 OK — Oversize Load (Forced Manual Review)**

```json
{
  "success": true,
  "data": {
    "quote_id": 125,
    "status": "pending",
    "origin_region": "DE-North",
    "destination_region": "SI-West",
    "base_price": null,
    "markup_percent": null,
    "final_price": null,
    "currency": "TRY",
    "is_oversize": true,
    "review_reason": "Oversize Load: weight exceeds 22 tons",
    "message": "This shipment requires manual review due to weight"
  }
}
```

**200 OK — Vendor Failover (RFQ Initiated)**

```json
{
  "success": true,
  "data": {
    "quote_id": 126,
    "status": "pending",
    "origin_region": "DE-North",
    "destination_region": "HR-South",
    "base_price": null,
    "markup_percent": null,
    "final_price": null,
    "currency": "TRY",
    "is_oversize": false,
    "review_reason": "No internal route pricing available. RFQ initiated.",
    "rfq": {
      "target_country": "HR",
      "selected_vendors": [
        { "id": 5, "name": "Vendor A" },
        { "id": 8, "name": "Vendor B" },
        { "id": 12, "name": "Vendor C" }
      ]
    },
    "message": "No internal pricing available. Vendor RFQ initiated."
  }
}
```

**200 OK — Missing Data (Data Request Template)**

```json
{
  "success": true,
  "data": {
    "status": "data_request",
    "missing_fields": ["weight_kg"],
    "message": "Please provide the missing information to proceed with your quote."
  }
}
```

**400 Bad Request — Validation Error**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "weight_kg", "message": "Must be greater than 0" }
    ]
  }
}
```

**401 Unauthorized — Invalid Auth Token**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing auth token"
  }
}
```

---

## Admin Dashboard Endpoints

### GET /api/v1/quotes

List quotes with optional filtering.

#### Request

**Query Parameters**:
- `status` (optional): `pending`, `approved`, `rejected`, `ready_to_send`
- `from_date` (optional): ISO date string
- `to_date` (optional): ISO date string
- `page` (optional): number, default 1
- `limit` (optional): number, default 20

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "quotes": [
      {
        "id": 123,
        "origin_region": "DE-North",
        "destination_region": "SI-West",
        "final_price": 1725.00,
        "currency": "TRY",
        "status": "pending",
        "is_oversize": false,
        "created_at": "2026-04-28T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150
    }
  }
}
```

---

### POST /api/v1/quotes/:id/approve

Approve a pending quote.

#### Request

**Body** (optional):

```json
{
  "revised_price": 1800.00,
  "notes": "Approved with revised terms"
}
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "quote_id": 123,
    "status": "approved",
    "final_price": 1800.00,
    "approved_at": "2026-04-28T10:30:00Z"
  }
}
```

**409 Conflict — Already Processed**

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_PROCESSED",
    "message": "Quote has already been approved or rejected"
  }
}
```

---

### POST /api/v1/quotes/:id/reject

Reject a pending quote.

#### Request

**Body**:

```json
{
  "reason": "Route no longer serviced"
}
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "quote_id": 123,
    "status": "rejected",
    "rejection_reason": "Route no longer serviced",
    "rejected_at": "2026-04-28T10:30:00Z"
  }
}
```

---

### GET /api/v1/rfqs

List RFQ records.

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "rfqs": [
      {
        "id": 10,
        "quote_id": 126,
        "target_country": "HR",
        "status": "open",
        "selected_vendors": [
          { "id": 5, "name": "Vendor A" }
        ],
        "created_at": "2026-04-28T10:00:00Z"
      }
    ]
  }
}
```

---

### GET /api/v1/master-data/vendors

List vendors.

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "vendors": [
      {
        "id": 5,
        "name": "Vendor A",
        "country_coverage": "SI,HR,BA",
        "expertise_notes": "Slovenia specialist, SI-20 route expert",
        "priority_ranking": 10,
        "is_active": true
      }
    ]
  }
}
```

---

### POST /api/v1/master-data/vendors

Create a new vendor.

#### Request

**Body**:

```json
{
  "name": "New Vendor",
  "country_coverage": "SI,HR",
  "expertise_notes": "Balkan routes",
  "priority_ranking": 50,
  "contact_email": "vendor@example.com",
  "contact_phone": "+38612345678"
}
```

---

### GET /api/v1/master-data/settings

Get system settings.

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "master_logic_toggle": "manual_approval",
    "default_currency": "TRY",
    "exchange_rate_reference_date": "2026-04-28",
    "oversize_weight_threshold_tons": 22.00
  }
}
```

---

### PUT /api/v1/master-data/settings

Update system settings.

#### Request

**Body**:

```json
{
  "master_logic_toggle": "auto_send"
}
```

---

## Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "UPPER_SNAKE_CASE_ERROR_CODE",
    "message": "Human-readable description",
    "details?": [ ...optional field-level errors... ]
  }
}
```

**Standard Error Codes**:

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `VALIDATION_ERROR` | 400 | Request body failed validation |
| `UNAUTHORIZED` | 401 | Invalid or missing auth token |
| `NOT_FOUND` | 404 | Resource not found |
| `ALREADY_PROCESSED` | 409 | Quote already approved or rejected |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
