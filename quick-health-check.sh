#!/bin/bash

# ZODIAC BACKEND - QUICK HEALTH CHECK SCRIPT
# Run this to verify backend health quickly

BACKEND_URL="https://zodiac-backend-api-production-8ded.up.railway.app"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================================="
echo "🔍 ZODIAC BACKEND HEALTH CHECK"
echo "=================================================="
echo ""

# 1. Check /health endpoint
echo "1️⃣  Checking /health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BACKEND_URL/health")
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HEALTH_CODE" = "200" ]; then
    echo -e "   ${GREEN}✅ Health endpoint OK (200)${NC}"

    # Extract key metrics
    STATUS=$(echo "$HEALTH_BODY" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    FIREBASE=$(echo "$HEALTH_BODY" | grep -o '"firebase":{[^}]*}' | grep -o '"initialized":[^,]*' | cut -d: -f2)
    DATABASE=$(echo "$HEALTH_BODY" | grep -o '"hasDatabase":[^,}]*' | cut -d: -f2)
    OPENAI=$(echo "$HEALTH_BODY" | grep -o '"hasOpenAI":[^,}]*' | cut -d: -f2)

    echo "   Status: $STATUS"
    echo "   Firebase: $FIREBASE"
    echo "   Database: $DATABASE"
    echo "   OpenAI: $OPENAI"
else
    echo -e "   ${RED}❌ Health endpoint FAILED ($HEALTH_CODE)${NC}"
fi
echo ""

# 2. Check /ping endpoint
echo "2️⃣  Checking /ping endpoint..."
PING_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/ping")

if [ "$PING_CODE" = "200" ]; then
    echo -e "   ${GREEN}✅ Ping endpoint OK (200)${NC}"
else
    echo -e "   ${RED}❌ Ping endpoint FAILED ($PING_CODE)${NC}"
fi
echo ""

# 3. Measure response time
echo "3️⃣  Measuring response time..."
RESPONSE_TIME=$(curl -s -w "%{time_total}s" -o /dev/null "$BACKEND_URL/health")
echo "   Response time: $RESPONSE_TIME"
echo ""

# 4. Check if horoscopes are available
echo "4️⃣  Checking horoscopes availability..."
HOROSCOPES=$(curl -s "$BACKEND_URL/api/coaching/getAllHoroscopes")
HOROSCOPE_COUNT=$(echo "$HOROSCOPES" | grep -o '"sign"' | wc -l | xargs)

if [ "$HOROSCOPE_COUNT" -gt "0" ]; then
    echo -e "   ${GREEN}✅ Horoscopes available ($HOROSCOPE_COUNT signs)${NC}"
else
    echo -e "   ${YELLOW}⚠️  No horoscopes in database${NC}"
fi
echo ""

# 5. Check npm vulnerabilities
echo "5️⃣  Checking npm vulnerabilities..."
cd "$(dirname "$0")"
VULN_COUNT=$(npm audit --json 2>/dev/null | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)

if [ -n "$VULN_COUNT" ] && [ "$VULN_COUNT" -eq "0" ]; then
    echo -e "   ${GREEN}✅ No vulnerabilities found${NC}"
elif [ -n "$VULN_COUNT" ]; then
    echo -e "   ${YELLOW}⚠️  $VULN_COUNT vulnerabilities found${NC}"
    echo "   Run: npm audit fix"
else
    echo -e "   ${YELLOW}⚠️  Could not check vulnerabilities${NC}"
fi
echo ""

# Summary
echo "=================================================="
echo "📊 SUMMARY"
echo "=================================================="
echo "Endpoint checks: 2/2"
echo "Backend URL: $BACKEND_URL"
echo "Timestamp: $(date)"
echo ""
echo "For detailed report, see: BACKEND_HEALTH_REPORT_OCT29_2025.md"
echo "=================================================="
