FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js style.css silent-check-sso.html /usr/share/nginx/html/
COPY client-js/src ./client-js/src

EXPOSE 80
