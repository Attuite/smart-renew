FROM node:22-alpine

ENV NODE_ENV=production \
    URBAN_HEALTH_HOST=0.0.0.0 \
    URBAN_HEALTH_PORT=4182 \
    URBAN_HEALTH_DATA_DIR=/var/lib/urban-health

WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /var/lib/urban-health && chown node:node /var/lib/urban-health

USER node
EXPOSE 4182
VOLUME ["/var/lib/urban-health"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4182/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
