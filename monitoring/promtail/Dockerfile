FROM grafana/promtail:latest

RUN mkdir -p /etc/promtail

COPY promtail-config.yaml /etc/promtail/promtail.yaml

CMD ["-config.file=/etc/promtail/promtail.yaml"]