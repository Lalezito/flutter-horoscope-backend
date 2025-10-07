#!/bin/bash

# 🌟 WEEKLY HOROSCOPE GENERATOR
# Generates all 72 weekly horoscopes using OpenAI

echo "🌟 Zodiac Weekly Horoscope Generator"
echo "===================================="
echo ""

# Check if ADMIN_KEY is set
if [ -z "$ADMIN_KEY" ]; then
    echo "⚠️  ADMIN_KEY environment variable not set"
    echo "Please set it with: export ADMIN_KEY=your_key"
    echo "Or run: source .env"
    exit 1
fi

# Backend URL
BACKEND_URL="https://zodiac-backend-api-production-8ded.up.railway.app"

# Ask for confirmation
echo "This will generate 72 weekly horoscopes (12 signs × 6 languages)"
echo "Estimated time: ~1-2 minutes"
echo "Cost estimate: ~$0.05-0.10 (using GPT-4o-mini)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Check current coverage
echo ""
echo "📊 Checking current coverage..."
curl -s "${BACKEND_URL}/api/weekly/checkMissing?admin_key=${ADMIN_KEY}" | jq '.'

echo ""
echo "🚀 Starting generation..."
echo ""

# Generate horoscopes
RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/weekly/generate?admin_key=${ADMIN_KEY}" -w "\n%{http_code}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Generation completed successfully!"
    echo ""
    echo "$BODY" | jq '.'
    echo ""
    echo "🎉 Weekly horoscopes are now available!"
elif [ "$HTTP_CODE" = "400" ]; then
    echo "ℹ️  Horoscopes already exist for this week"
    echo ""
    echo "$BODY" | jq '.'
    echo ""
    echo "To force regeneration, run:"
    echo "curl -X POST \"${BACKEND_URL}/api/weekly/generate?admin_key=${ADMIN_KEY}&force=true\""
else
    echo "❌ Generation failed with HTTP $HTTP_CODE"
    echo ""
    echo "$BODY" | jq '.' || echo "$BODY"
fi

echo ""
echo "📊 Final coverage check..."
curl -s "${BACKEND_URL}/api/weekly/checkMissing?admin_key=${ADMIN_KEY}" | jq '.'
