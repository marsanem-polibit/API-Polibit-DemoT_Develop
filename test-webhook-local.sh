#!/bin/bash
# Test DocuSeal webhook locally with Vercel CLI

echo "Starting local Vercel development server..."
echo "This will run your API locally on http://localhost:3000"
echo ""
echo "In another terminal, you can test the webhook with:"
echo "curl -X POST http://localhost:3000/api/docuseal/webhook \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'X-PoliBit-Signature: 2900f56566097c95876078f8ebed731a374a888d7f5a5a518e2e5d9f518775d8' \\"
echo "  -d '{...webhook payload...}'"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

vercel dev
