#!/bin/bash
# Script to link Railway service and deploy

cd "/Users/alejandrocaceres/Desktop/appstore - zodia/backend/flutter-horoscope-backend"

echo "🔗 Linking to Railway service..."
railway service

echo ""
echo "🚀 Deploying to Railway..."
railway up

echo ""
echo "✅ Deployment triggered!"
