# vector 服务器
## Prompt
SYSTEM_PROMPT: .env.example

剩余 prompt: src/utils/llm/prompt.ts

## 部署

docker build --platform linux/amd64 -t vector-server -f Dockerfile.app .

docker tag vector-server dvlindev/vector-server
docker push dvlindev/vector-server

docker pull dvlindev/vector-server
docker rm -f vector-server

docker run -d \
 -p 0.0.0.0:3100:13000 \
 --name vector-server \
 -v $(pwd)/app.env:/app/.env \
 dvlindev/vector-server