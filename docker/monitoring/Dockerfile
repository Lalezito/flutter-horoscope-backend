# Multi-stage monitoring container
FROM grafana/grafana:latest as grafana
FROM prom/prometheus:latest as prometheus
FROM prom/alertmanager:latest as alertmanager

# Multi-stage monitoring container
FROM alpine:3.18
RUN apk add --no-cache ca-certificates tzdata curl bash

# Copy binaries from official images
COPY --from=grafana /usr/share/grafana /usr/share/grafana
COPY --from=prometheus /bin/prometheus /bin/prometheus
COPY --from=alertmanager /bin/alertmanager /bin/alertmanager

# Configuration files
COPY monitoring/prometheus.yml /etc/prometheus/
COPY monitoring/alertmanager.yml /etc/alertmanager/
COPY monitoring/grafana.ini /etc/grafana/
COPY monitoring/alert_rules.yml /etc/prometheus/
COPY monitoring/start-services.sh /monitoring/
COPY monitoring/grafana-dashboard.json /var/lib/grafana/dashboards/

# Create directories
RUN mkdir -p /var/lib/prometheus /var/lib/grafana /var/lib/alertmanager

# Make startup script executable
RUN chmod +x /monitoring/start-services.sh

EXPOSE 3000 9090 9093

CMD ["/monitoring/start-services.sh"]