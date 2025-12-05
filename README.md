# Sungrow Solar for Home Assistant

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=keegancruickshank&repository=sungrow-solar&category=integration)

Home Assistant integration for Sungrow solar systems via iSolarCloud API.

## Features

- Exposes 34 sensors for power, energy, battery, and grid metrics
- Works with Home Assistant Energy Dashboard
- Supports automations and scripts
- Polls iSolarCloud API at configurable intervals

## Installation

### HACS (Recommended)

1. Click the button above, or:
   - Open HACS in Home Assistant
   - Click the three dots menu → Custom repositories
   - Add `https://github.com/keegancruickshank/sungrow-solar` as an Integration
2. Search for "Sungrow Solar" and install
3. Restart Home Assistant
4. Go to Settings → Devices & Services → Add Integration → Sungrow Solar

### Manual

1. Copy `custom_components/sungrow_solar` to your `config/custom_components/` directory
2. Restart Home Assistant
3. Go to Settings → Devices & Services → Add Integration → Sungrow Solar

## Configuration

You'll need:
- **Username**: Your iSolarCloud account email
- **Password**: Your iSolarCloud password
- **App Key**: From iSolarCloud developer portal
- **Secret Key**: From iSolarCloud developer portal
- **API Region**: Select your region (Global, Europe, Australia, Hong Kong)
- **Poll Interval**: 60-600 seconds (default: 300)

## Sensors

### Power (Watts)
- Active Power, DC Power, Load Power
- Grid Export/Import Power
- Battery Charging/Discharging Power

### Energy (Watt-hours)
- Solar Energy Today / Total
- Grid Export Energy Today / Total
- Grid Import Energy Today / Total
- Load Energy Today / Total
- Battery Charge/Discharge Energy Today / Total

### Battery
- Battery Level (SOC %)
- Battery Health (SOH %)
- Battery Temperature, Voltage, Current, Capacity

### Grid
- Phase A/B/C Voltage
- Grid Frequency

### PV Strings
- MPPT1/2 Voltage and Current

## Energy Dashboard

The following sensors work with the Energy Dashboard:
- **Solar Production**: `sensor.*_total_solar_energy`
- **Grid Consumption**: `sensor.*_total_grid_import_energy`
- **Return to Grid**: `sensor.*_total_grid_export_energy`
- **Battery**: Use the battery level sensor

## Add-on

This repository also includes a Home Assistant add-on with a web-based energy flow visualization dashboard. The add-on and integration can be used together or separately.
