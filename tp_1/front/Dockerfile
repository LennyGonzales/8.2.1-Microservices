FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js style.css silent-check-sso.html /usr/share/nginx/html/
COPY client-js/src /usr/share/nginx/html/client-js/src
COPY config.js.template docker-entrypoint.sh /usr/share/nginx/html/

RUN chmod +x /usr/share/nginx/html/docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/usr/share/nginx/html/docker-entrypoint.sh"]
