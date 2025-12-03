#!/usr/bin/with-contenv bashio

# Export configuration as environment variables
export SUNGROW_APPKEY=$(bashio::config 'appkey')
export SUNGROW_SECRET_KEY=$(bashio::config 'secret_key')
export SUNGROW_AUTHORIZE_URL=$(bashio::config 'authorize_url')
export SUNGROW_HOST=$(bashio::config 'host')
export SUNGROW_POLL_INTERVAL=$(bashio::config 'poll_interval')

# Get ingress entry for proper URL handling
export INGRESS_ENTRY=$(bashio::addon.ingress_entry)

bashio::log.info "Starting Sungrow Solar addon..."
bashio::log.info "API Host: ${SUNGROW_HOST}"
bashio::log.info "Poll Interval: ${SUNGROW_POLL_INTERVAL}s"
bashio::log.info "AppKey length: ${#SUNGROW_APPKEY}"
bashio::log.info "SecretKey length: ${#SUNGROW_SECRET_KEY}"

cd /app
exec node server.js
