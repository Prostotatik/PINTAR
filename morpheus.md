curl https://api.mor.org/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "minimax-m2.5",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'