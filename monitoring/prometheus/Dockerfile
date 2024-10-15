FROM prom/prometheus

COPY prometheus.yaml /etc/prometheus/prometheus.yaml

EXPOSE 9090

CMD [ "--config.file=/etc/prometheus/prometheus.yaml" ]