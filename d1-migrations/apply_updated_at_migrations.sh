#!/usr/bin/env bash
#
# Helper script to check and apply updated_at migrations to a D1 database using wrangler.
#
# Usage:
#   ./apply_updated_at_migrations.sh <DB_NAME>
# Example:
#   ./apply_updated_at_migrations.sh fleetcommand
#
DB="${1:-fleetcommand}"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Using D1 database: $DB"
CHECK_ONLY="0"
[ "$2" = "--check-only" ] || [ "$2" = "--dry-run" ] && CHECK_ONLY="1"
[ "$CHECK_ONLY" = "1" ] && echo "Mode: check-only (no migrations applied)"

FILES=("015_add_updated_at_vehicles.sql" "016_add_updated_at_maintenance_orders.sql" "017_add_updated_at_users.sql" "018_add_updated_at_licenses.sql" "019_add_updated_at_insurances.sql" "020_add_updated_at_ctes.sql" "021_add_updated_at_receitas.sql" "022_add_updated_at_parts.sql" "023_add_updated_at_expenses.sql" "024_add_updated_at_fuel_entries.sql" "025_add_updated_at_tires.sql")
TABLES=("vehicles" "maintenance_orders" "users" "licenses" "insurances" "ctes" "receitas" "parts" "expenses" "fuel_entries" "tires")

for idx in "${!FILES[@]}"; do
  FILE="${ROOT_DIR}/${FILES[$idx]}"
  TABLE="${TABLES[$idx]}"
  if [ ! -f "$FILE" ]; then
    echo "Migration file not found: $FILE â€” skipping."
    continue
  fi

  CHECK_SQL="$(mktemp)"
  echo "SELECT name FROM pragma_table_info('$TABLE') WHERE name='updated_at';" > "$CHECK_SQL"


  if [ "$CHECK_ONLY" = "1" ]; then
    OUT="$(npx wrangler d1 execute "$DB" --remote --file="$CHECK_SQL" 2>&1)"
    if echo "$OUT" | grep -q "updated_at"; then echo "$TABLE: true"; else echo "$TABLE: false"; fi
    rm -f "$CHECK_SQL"
    continue
  fi
  echo "Checking if column 'updated_at' exists on table '$TABLE'..."
  npx wrangler d1 execute "$DB" --remote --file="$CHECK_SQL"

  echo
  read -p "Apply migration ${FILES[$idx]} for table $TABLE? (y/N) " yn
  if [ "$yn" = "y" ] || [ "$yn" = "Y" ]; then
    echo "Applying $FILE ..."
    npx wrangler d1 execute "$DB" --remote --file="$FILE"
    echo "Done."
  else
    echo "Skipped $TABLE."
  fi
  rm -f "$CHECK_SQL"
done

echo
echo "Finished. Review output above for any errors."

