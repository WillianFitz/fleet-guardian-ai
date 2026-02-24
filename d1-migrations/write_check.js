const fs = require("fs");
const script = `#!/usr/bin/env bash
# Check-only: list which tables have updated_at on remote D1
DB="${1:-fleetcommand}"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Using D1 database: $DB (check-only)"
echo ""
FILES=("015_add_updated_at_vehicles.sql" "016_add_updated_at_maintenance_orders.sql" "017_add_updated_at_users.sql" "018_add_updated_at_licenses.sql" "019_add_updated_at_insurances.sql" "020_add_updated_at_ctes.sql" "021_add_updated_at_receitas.sql" "022_add_updated_at_parts.sql" "023_add_updated_at_expenses.sql" "024_add_updated_at_fuel_entries.sql" "025_add_updated_at_tires.sql")
TABLES=("vehicles" "maintenance_orders" "users" "licenses" "insurances" "ctes" "receitas" "parts" "expenses" "fuel_entries" "tires")
for idx in "${!FILES[@]}"; do
  TABLE="${TABLES[$idx]}"
  CHECK_SQL="$(mktemp)"
  echo "SELECT name FROM pragma_table_info(\"$TABLE\") WHERE name=\"updated_at\";" > "$CHECK_SQL"
  OUT="$(npx wrangler d1 execute "$DB" --remote --file="$CHECK_SQL" 2>&1)"
  rm -f "$CHECK_SQL"
  if echo "$OUT" | grep -q "updated_at"; then
    echo "$TABLE: true"
  else
    echo "$TABLE: false"
  fi
done
echo ""
echo "Summary: table -> hasUpdatedAt"
`;
fs.writeFileSync("d1-migrations/check_updated_at.sh", script, "utf8");
console.log("OK");
