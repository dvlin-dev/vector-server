# vector 服务器

## 主服务

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

<!-- docker run -d -p 0.0.0.0:3100:3100 --name vector-server dvlindev/vector-server -->

docker stop vector-server
docker rm vector-server
docker run -d -p 0.0.0.0:3100:13000 --name vector-server -v $(pwd)/app.env:/app/.env dvlindev/vector-server

<!-- docker run -d -p 0.0.0.0:3100:13000 --name vector-server --env-file $(pwd)/app.env dvlindev/vector-server -->


npx prisma migrate deploy