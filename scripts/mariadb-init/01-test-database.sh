#!/bin/sh
# Runs once, when the MariaDB volume is first created (docker-entrypoint-initdb.d).
# Creates <db>_test for integration tests and grants the app user access.
# The integration suite DROPS and recreates this database on every run.
set -eu
TEST_DB="${MARIADB_DATABASE}_test"
# In GRANT, "_" is a wildcard; escape it so the grant covers exactly TEST_DB.
GRANT_DB=$(printf '%s' "$TEST_DB" | sed 's/_/\\_/g')

mariadb -uroot -p"${MARIADB_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`${GRANT_DB}\`.* TO '${MARIADB_USER}'@'%';
FLUSH PRIVILEGES;
SQL
