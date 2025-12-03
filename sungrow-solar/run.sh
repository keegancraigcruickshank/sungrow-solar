#!/usr/bin/with-contenv bashio

# Export configuration as environment variables
export SUNGROW_USERNAME=$(bashio::config 'username')
export SUNGROW_PASSWORD=$(bashio::config 'password')
export SUNGROW_HOST=$(bashio::config 'host')
export SUNGROW_POLL_INTERVAL=$(bashio::config 'poll_interval')

# Get ingress entry for proper URL handling
export INGRESS_ENTRY=$(bashio::addon.ingress_entry)

bashio::log.info "Starting Sungrow Solar addon..."
bashio::log.info "API Host: ${SUNGROW_HOST}"
bashio::log.info "Poll Interval: ${SUNGROW_POLL_INTERVAL}s"
bashio::log.info "Username: ${SUNGROW_USERNAME}"

cd /app
exec node server.js
