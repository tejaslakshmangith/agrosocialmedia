#!/bin/sh
set -e

# Substitute environment variables in firebase-config.js if they are provided.
# This allows Firebase credentials to be injected at runtime without rebuilding
# the image.
CONFIG_FILE="/usr/share/nginx/html/firebase-config.js"

if [ -f "$CONFIG_FILE" ]; then
    # Only substitute if the env var is non-empty so that the placeholder
    # values are replaced only when the caller explicitly sets them.
    if [ -n "$FIREBASE_API_KEY" ]; then
        sed -i "s|YOUR_FIREBASE_API_KEY|${FIREBASE_API_KEY}|g" "$CONFIG_FILE"
    fi
    if [ -n "$FIREBASE_AUTH_DOMAIN" ]; then
        # Replace the full authDomain placeholder value
        sed -i "s|YOUR_PROJECT\.firebaseapp\.com|${FIREBASE_AUTH_DOMAIN}|g" "$CONFIG_FILE"
    fi
    if [ -n "$FIREBASE_PROJECT_ID" ]; then
        sed -i "s|YOUR_PROJECT_ID|${FIREBASE_PROJECT_ID}|g" "$CONFIG_FILE"
        # storageBucket pattern uses the project id too
        sed -i "s|YOUR_PROJECT\.appspot\.com|${FIREBASE_PROJECT_ID}.appspot.com|g" "$CONFIG_FILE"
    fi
    if [ -n "$FIREBASE_MESSAGING_SENDER_ID" ]; then
        sed -i "s|SENDER_ID|${FIREBASE_MESSAGING_SENDER_ID}|g" "$CONFIG_FILE"
    fi
    if [ -n "$FIREBASE_APP_ID" ]; then
        sed -i "s|APP_ID|${FIREBASE_APP_ID}|g" "$CONFIG_FILE"
    fi
    # Allow overriding the OpenWeather API key that ships in firebase-config.js
    if [ -n "$OPENWEATHER_API_KEY" ]; then
        sed -i "s|OPENWEATHER_API_KEY = \"[^\"]*\"|OPENWEATHER_API_KEY = \"${OPENWEATHER_API_KEY}\"|g" "$CONFIG_FILE"
    fi
fi

echo "Starting nginx..."
exec "$@"
