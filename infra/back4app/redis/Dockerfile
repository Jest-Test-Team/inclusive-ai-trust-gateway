FROM redis:7-alpine

EXPOSE 6379

CMD ["redis-server", "--appendonly", "no", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
