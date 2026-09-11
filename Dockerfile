# Static export served by nginx. The build happens before this (npm run
# build:cloudrun), so the image carries only the finished site — no Node, no
# node_modules, nothing with a CVE feed attached to it.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY dist/ /usr/share/nginx/html/

# nginx's own entrypoint expands ${PORT} in the template at startup.
ENV PORT=8080
EXPOSE 8080
