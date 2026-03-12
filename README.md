ГАЙД ПО ЗАПУСКУ

docker build -t maf-speaker-client .
docker run -p 3000:3000 maf-speaker-client


Если нативно то

npm i
npm run dev


!!! НЕ ЗАБУДЬ ЗАКИНУТЬ В ENV и в DOCKERFILE В 11 строку URL для сокет подлючения