#!/bin/bash
# Test DocuSeal webhook endpoint

# Configuration
API_URL="${1:-https://api-polibit-demo-t.vercel.app}"
SIGNATURE="2900f56566097c95876078f8ebed731a374a888d7f5a5a518e2e5d9f518775d8"

echo "Testing DocuSeal Webhook at: $API_URL/api/docuseal/webhook"
echo "================================================"
echo ""

# Test 1: submission.created event
echo "Test 1: submission.created event"
echo "--------------------------------"
curl -X POST "$API_URL/api/docuseal/webhook" \
  -H "Content-Type: application/json" \
  -H "X-PoliBit-Signature: $SIGNATURE" \
  -d '{
    "event_type": "submission.created",
    "timestamp": "2025-11-29T02:23:41Z",
    "data": {
      "email": "test@example.com",
      "submission": {
        "id": 999999,
        "status": "created",
        "url": "https://docuseal.com/e/test123",
        "audit_log_url": "https://docuseal.com/audit/test123",
        "created_at": "2025-11-29T02:23:41Z"
      }
    }
  }' | jq '.'

echo ""
echo ""

# Test 2: submission.completed event
echo "Test 2: submission.completed event"
echo "-----------------------------------"
curl -X POST "$API_URL/api/docuseal/webhook" \
  -H "Content-Type: application/json" \
  -H "X-PoliBit-Signature: $SIGNATURE" \
  -d '{
    "event_type": "submission.completed",
    "timestamp": "2025-11-29T02:23:41Z",
    "data": {
      "email": "test@example.com",
      "submission": {
        "id": 999999,
        "status": "completed",
        "url": "https://docuseal.com/e/test123",
        "audit_log_url": "https://docuseal.com/audit/test123",
        "completed_at": "2025-11-29T02:25:00Z"
      }
    }
  }' | jq '.'

echo ""
echo ""

# Test 3: Invalid signature
echo "Test 3: Invalid signature (should fail)"
echo "----------------------------------------"
curl -X POST "$API_URL/api/docuseal/webhook" \
  -H "Content-Type: application/json" \
  -H "X-PoliBit-Signature: invalid_signature" \
  -d '{
    "event_type": "submission.completed",
    "data": {
      "email": "test@example.com",
      "submission": {
        "id": 999999,
        "status": "completed"
      }
    }
  }' | jq '.'

echo ""
echo "================================================"
echo "Tests completed!"
echo ""
echo "Check Vercel logs at: https://vercel.com/dashboard"
echo "Search for: [DocuSeal Webhook]"
