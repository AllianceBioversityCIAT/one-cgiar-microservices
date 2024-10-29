
# Log Monitoring with Grafana

This project implements a log monitoring environment that uses Grafana, Prometheus, Loki, and Promtail for efficient collection, storage, and visualization of logs from Docker containers. It allows users to query and analyze logs in real time, facilitating problem identification and performance tracking of applications


## Deployment

Docker newtwork

```bash
  docker network create monitoring
```
Prometheus

```bash
  sudo docker run -d --name prometheus \
  --network monitoring \
  -v prometheus.yaml:/etc/prometheus/prometheus.yaml \
  -p 9090:9090 \
  prom/prometheus
```
Grafana

```bash
  docker run -d --name grafana \
  --network monitoring \
  -p 3000:3000 \
  -e "GF_SECURITY_ADMIN_PASSWORD=admin" \
  grafana/grafana
```
Loki

```bash
  sudo docker run -d --name loki \
  --network monitoring \
  -p 3100:3100 \
  -v /home/ec2-user/loki/local-config.yaml:/etc/loki/local-config.yaml \
  -v /home/ec2-user/loki/data:/loki \
  --user $(id -u):$(id -g) \
  grafana/loki:2.9.7

```
Promtail

```bash
  docker run -d --name promtail \
  --network monitoring \
  -v /var/lib/docker/containers:/var/lib/docker/containers:ro \
  -v $(pwd)/promtail-config.yaml:/etc/promtail/promtail.yaml \
  grafana/promtail:latest -config.file=/etc/promtail/promtail.yaml

```
### Usage

Once all the containers are deployed, access Grafana at http://localhost:3000. Configure Loki as a data source and start querying the logs from your containers..