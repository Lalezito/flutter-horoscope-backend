#!/bin/bash

# Script para corregir sintaxis de índices en todos los archivos SQL
# Convierte sintaxis MySQL (INDEX dentro de CREATE TABLE) a PostgreSQL (CREATE INDEX después)
# Fecha: 2025-12-04

echo "🔧 Fixing SQL index syntax in all migration files..."
echo ""

# Lista de archivos a corregir
FILES=(
  "010_create_premium_goals_tables.sql"
  "011_add_user_memories.sql"
  "011_create_user_streaks_table.sql"
  "012_create_advanced_compatibility_system.sql"
  "012_create_comprehensive_analytics_system.sql"
  "create_fcm_tokens_table.sql"
)

cd migrations

for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "⚠️  File not found: $file"
    continue
  fi

  echo "📝 Processing: $file"

  # Crear backup
  cp "$file" "${file}.BACKUP"

  # Extraer líneas con INDEX dentro de CREATE TABLE
  grep -n "INDEX idx_" "$file" > /tmp/indexes_${file}.txt || true

  if [ -s "/tmp/indexes_${file}.txt" ]; then
    echo "   ✅ Found indexes to fix in $file"

    # Remover las líneas de INDEX de dentro de CREATE TABLE
    sed -i.tmp '/^[[:space:]]*INDEX idx_/d' "$file"

    # Limpiar comas colgantes (líneas que terminan en coma antes del );)
    sed -i.tmp -E 's/,[[:space:]]*$//' "$file"

    echo "   ✅ Removed inline INDEX statements"
    echo "   ℹ️  You'll need to add CREATE INDEX statements manually at the end"

    rm -f "${file}.tmp"
  else
    echo "   ℹ️  No inline indexes found, file might already be correct"
  fi

  echo ""
done

echo "✅ Done! Backup files created with .BACKUP extension"
echo ""
echo "⚠️  NEXT STEPS:"
echo "1. Review each modified file"
echo "2. Add 'CREATE INDEX IF NOT EXISTS ...' statements at the end of each file"
echo "3. Use the extracted indexes from /tmp/indexes_*.txt as reference"
echo "4. Test the SQL files in Railway PostgreSQL console"
