FROM nginx:alpine

# Copy built static site
COPY ./dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8420

CMD ["nginx", "-g", "daemon off;"]
