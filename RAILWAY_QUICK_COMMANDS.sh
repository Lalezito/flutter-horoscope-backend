#!/bin/bash

# Railway Quick Commands - Backend Zodiac
# Comandos útiles para gestionar el deployment de Railway

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="https://zodiac-backend-api-production-8ded.up.railway.app"

echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Railway Quick Commands - Zodiac Backend v2.2.0  ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check version
check_version() {
    echo -e "${BLUE}Verificando versión en producción...${NC}"
    curl -s "$API_URL/health" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f\"Version: {data['version']}\")
print(f\"Status: {data['status']}\")
print(f\"Uptime: {data['uptime']:.0f}s ({data['uptime']/60:.1f} min)\")
"
}

# Function to check health
check_health() {
    echo -e "${BLUE}Checking health status...${NC}"
    curl -s "$API_URL/health" | python3 -m json.tool
}

# Function to check routes
check_routes() {
    echo -e "${BLUE}Verificando rutas cargadas...${NC}"
    curl -s "$API_URL/api/routes" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f\"Total rutas: {data['total']}\")
print(f\"Cargadas: {data['loaded']}\")
print(f\"Fallidas: {data['failed']}\")
print('\nRutas disponibles:')
for route in data['routes']:
    status = '✅' if route['status'] == 'loaded' else '❌'
    print(f\"  {status} {route['path']} - {route['description']}\")
"
}

# Function to trigger deployment
trigger_deployment() {
    echo -e "${BLUE}Triggering deployment via empty commit...${NC}"
    git commit --allow-empty -m "chore: trigger Railway deployment"
    git push origin main
    echo -e "${YELLOW}Esperando 120 segundos para deployment...${NC}"
    sleep 120
    check_version
}

# Function to view logs (requires Railway CLI)
view_logs() {
    echo -e "${BLUE}Viewing Railway logs...${NC}"
    if command -v railway &> /dev/null; then
        railway logs
    else
        echo -e "${YELLOW}Railway CLI no instalado.${NC}"
        echo "Instalar: npm install -g @railway/cli"
        echo "O ver logs en: https://railway.app/project/a06dde84-af4b-4c32-99d4-b1f536176a7d"
    fi
}

# Function to open Railway dashboard
open_dashboard() {
    echo -e "${BLUE}Opening Railway dashboard...${NC}"
    open "https://railway.app/project/a06dde84-af4b-4c32-99d4-b1f536176a7d"
}

# Menu
echo "Comandos disponibles:"
echo ""
echo "  1) check_version          - Ver versión actual en producción"
echo "  2) check_health           - Ver estado completo del backend"
echo "  3) check_routes           - Ver rutas cargadas"
echo "  4) trigger_deployment     - Forzar deployment (commit vacío)"
echo "  5) view_logs              - Ver logs de Railway (requiere CLI)"
echo "  6) open_dashboard         - Abrir Railway Dashboard"
echo ""
echo "Ejemplos de uso:"
echo "  source RAILWAY_QUICK_COMMANDS.sh"
echo "  check_version"
echo "  check_health"
echo ""

# If script is sourced, make functions available
# If executed, show menu and wait for input
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo -e "${YELLOW}Ejecuta: source RAILWAY_QUICK_COMMANDS.sh${NC}"
    echo -e "${YELLOW}Luego usa las funciones listadas arriba${NC}"
fi
