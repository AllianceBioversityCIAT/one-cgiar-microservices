FROM grafana/grafana:latest

# Cambiar a usuario root
USER root

# Instalar Nginx
RUN apk add --no-cache nginx

# Copiar la configuración de Nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Exponer puertos
EXPOSE 80

# Cambiar de nuevo a usuario grafana para ejecutar Grafana
USER grafana

# Comando para iniciar Nginx y Grafana
CMD openrc default && nginx && /run.sh