#!/bin/sh
API_URL="${API_URL:-http://localhost:8080/api}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"

sed \
  -e "s|__API_URL__|${API_URL}|g" \
  -e "s|__KEYCLOAK_URL__|${KEYCLOAK_URL}|g" \
  /usr/share/nginx/html/config.js.template \
  > /usr/share/nginx/html/config.js

exec nginx -g "daemon off;"
