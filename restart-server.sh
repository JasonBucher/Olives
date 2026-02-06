#!/usr/bin/env bash

PORT=8001
SERVE_DIR="."

echo "🔄 Restarting local prototype server..."

# Kill any existing http.server on this port
PID=$(lsof -ti tcp:$PORT)
if [ -n "$PID" ]; then
  echo "🛑 Stopping server on port $PORT (PID $PID)"
  kill $PID
  sleep 0.5
else
  echo "ℹ️  No existing server running on port $PORT"
fi

# Move to serve directory
if [ ! -d "$SERVE_DIR" ]; then
  echo "❌ Serve directory '$SERVE_DIR' not found"
  exit 1
fi

cd "$SERVE_DIR" || exit 1

echo "🚀 Starting server from $(pwd)"
python3 -m http.server $PORT > /dev/null 2>&1 &

NEW_PID=$!
echo "✅ Server running at http://localhost:$PORT (PID $NEW_PID)"