#!/bin/bash

# Start monitoring services
echo "Starting Zodiac Monitoring Stack..."

# Start Prometheus in the background
echo "Starting Prometheus..."
prometheus --config.file=/etc/prometheus/prometheus.yml \
           --storage.tsdb.path=/var/lib/prometheus \
           --web.console.templates=/etc/prometheus/consoles \
           --web.console.libraries=/etc/prometheus/console_libraries \
           --web.listen-address=:9090 \
           --web.enable-lifecycle &

# Start AlertManager in the background
echo "Starting AlertManager..."
alertmanager --config.file=/etc/alertmanager/alertmanager.yml \
             --storage.path=/var/lib/alertmanager \
             --web.listen-address=:9093 &

# Start Grafana in the background
echo "Starting Grafana..."
grafana-server --config=/etc/grafana/grafana.ini \
               --homepath=/usr/share/grafana \
               web &

# Wait for services to start
sleep 30

echo "Monitoring stack started successfully!"
echo "Prometheus: http://localhost:9090"
echo "AlertManager: http://localhost:9093"
echo "Grafana: http://localhost:3000"

# Keep the container running
tail -f /dev/null