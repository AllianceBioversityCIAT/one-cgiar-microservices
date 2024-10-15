FROM grafana/loki:2.9.7

RUN mkdir -p /etc/loki

COPY local-config.yaml /etc/loki/local-config.yaml

EXPOSE 3100

CMD ["-config.file=/etc/loki/local-config.yaml"]