#!/data/data/com.termux/files/usr/bin/bash

set -u

BASE="http://localhost:8787"
COOKIE_JAR="$HOME/gallery-cookies.txt"
LOGIN_BODY=""

printf '\n====================================\n'
printf ' Frontend Authentication Test\n'
printf '====================================\n'
printf 'Worker: %s\n\n' "$BASE"

# Check required tools.
for cmd in curl node; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        printf 'ERROR: Required command not found: %s\n' "$cmd"
        exit 1
    fi
done

# Check the local Worker.
printf '[1/5] Checking Worker connection...\n'

if ! curl -sS --connect-timeout 3 \
    "$BASE/frontend/check?type=gallery" \
    -o /dev/null; then
    printf 'ERROR: Worker is not reachable at %s\n' "$BASE"
    printf 'Start your local Worker and run this script again.\n'
    exit 1
fi

printf 'Worker is reachable.\n\n'

# Collect credentials without displaying the password.
printf '[2/5] Enter Gallery credentials.\n'

read -r -p 'Gallery username [gallery]: ' USERNAME
USERNAME="${USERNAME:-gallery}"

while [ -z "${PASSWORD:-}" ]; do
    read -r -s -p 'Gallery password: ' PASSWORD
    printf '\n'

    if [ -z "$PASSWORD" ]; then
        printf 'Password cannot be empty. Try again.\n'
    fi
done

export USERNAME PASSWORD

# Build valid JSON safely.
LOGIN_BODY="$(node -e '
let password = process.env.PASSWORD;
let username = process.env.USERNAME;

process.stdout.write(JSON.stringify({
    type: "gallery",
    username,
    password
}));
')" || {
    printf 'ERROR: Could not build login request.\n'
    unset PASSWORD LOGIN_BODY
    exit 1
}

# Remove the previous cookie jar to prevent stale-session confusion.
rm -f "$COOKIE_JAR"

printf '\n[3/5] Testing Gallery login...\n'

LOGIN_RESPONSE="$(
    curl -sS \
        -c "$COOKIE_JAR" \
        -X POST "$BASE/frontend/login" \
        -H 'Content-Type: application/json' \
        --data "$LOGIN_BODY" \
        -w '\n__HTTP_STATUS__:%{http_code}'
)" || {
    printf 'ERROR: Login request failed to connect.\n'
    unset PASSWORD LOGIN_BODY
    exit 1
}

printf '%s\n' "$LOGIN_RESPONSE" |
    sed '/^__HTTP_STATUS__:/d'

LOGIN_STATUS="$(
    printf '%s\n' "$LOGIN_RESPONSE" |
    sed -n 's/^__HTTP_STATUS__://p' |
    tail -n 1
)"

unset PASSWORD LOGIN_BODY

printf 'HTTP status: %s\n' "${LOGIN_STATUS:-unknown}"

if [ "$LOGIN_STATUS" != "200" ]; then
    printf '\nLogin did not succeed. Stopping further tests.\n'
    printf 'Check the error above before continuing.\n'
    exit 1
fi

# Verify the Gallery session explicitly.
printf '\n[4/5] Testing Gallery session...\n'

CHECK_RESPONSE="$(
    curl -sS \
        -b "$COOKIE_JAR" \
        -w '\n__HTTP_STATUS__:%{http_code}' \
        "$BASE/frontend/check?type=gallery"
)" || {
    printf 'ERROR: Session check request failed.\n'
    exit 1
}

printf '%s\n' "$CHECK_RESPONSE" |
    sed '/^__HTTP_STATUS__:/d'

CHECK_STATUS="$(
    printf '%s\n' "$CHECK_RESPONSE" |
    sed -n 's/^__HTTP_STATUS__://p' |
    tail -n 1
)"

printf 'HTTP status: %s\n' "${CHECK_STATUS:-unknown}"

if [ "$CHECK_STATUS" != "200" ]; then
    printf 'WARNING: Login returned 200, but session verification failed.\n'
    exit 1
fi

# Logout only the Gallery frontend session.
printf '\n[5/5] Testing Gallery logout...\n'

LOGOUT_RESPONSE="$(
    curl -sS \
        -b "$COOKIE_JAR" \
        -c "$COOKIE_JAR" \
        -X POST "$BASE/frontend/logout?type=gallery" \
        -w '\n__HTTP_STATUS__:%{http_code}'
)" || {
    printf 'ERROR: Logout request failed.\n'
    exit 1
}

printf '%s\n' "$LOGOUT_RESPONSE" |
    sed '/^__HTTP_STATUS__:/d'

LOGOUT_STATUS="$(
    printf '%s\n' "$LOGOUT_RESPONSE" |
    sed -n 's/^__HTTP_STATUS__://p' |
    tail -n 1
)"

printf 'HTTP status: %s\n' "${LOGOUT_STATUS:-unknown}"

# Confirm the Gallery session is no longer authenticated.
printf '\nVerifying session after logout...\n'

AFTER_LOGOUT="$(
    curl -sS \
        -b "$COOKIE_JAR" \
        -w '\n__HTTP_STATUS__:%{http_code}' \
        "$BASE/frontend/check?type=gallery"
)" || {
    printf 'ERROR: Post-logout check failed to connect.\n'
    exit 1
}

printf '%s\n' "$AFTER_LOGOUT" |
    sed '/^__HTTP_STATUS__:/d'

AFTER_STATUS="$(
    printf '%s\n' "$AFTER_LOGOUT" |
    sed -n 's/^__HTTP_STATUS__://p' |
    tail -n 1
)"

if [ "$LOGOUT_STATUS" = "200" ] &&
   [ "$AFTER_STATUS" = "401" ]; then
    printf '\nPASS: Gallery login, session, and logout tests succeeded.\n'
else
    printf '\nCHECK: Expected logout HTTP 200 and post-logout HTTP 401.\n'
    printf 'Actual logout: %s; post-logout check: %s\n' \
        "${LOGOUT_STATUS:-unknown}" \
        "${AFTER_STATUS:-unknown}"
    exit 1
fi

rm -f "$COOKIE_JAR"
printf 'Temporary cookie jar removed.\n'
