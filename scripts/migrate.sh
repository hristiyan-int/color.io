#!/bin/bash

# Color.io Database Migration Script
# Runs the initial schema migration against Supabase

SUPABASE_URL="https://nylzkyftbhuyqrvtrssh.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55bHpreWZ0Ymh1eXFydnRyc3NoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkxNDQ5MiwiZXhwIjoyMDgwNDkwNDkyfQ.epsznw-FLmCtCAkB0pNGkU9WwVoxrd5BPjLXp1UGKrs"

echo "Running Color.io database migration..."

# Read SQL file
SQL_FILE="/root/color.io/supabase/migrations/001_initial_schema.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "Error: SQL file not found at $SQL_FILE"
    exit 1
fi

# Execute SQL via Supabase REST API
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(cat "$SQL_FILE" | jq -Rs .)}"

echo ""
echo "Migration complete!"
