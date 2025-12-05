"""Constants for the Sungrow Solar integration."""
from homeassistant.const import (
    UnitOfEnergy,
    UnitOfPower,
    UnitOfElectricPotential,
    UnitOfElectricCurrent,
    UnitOfTemperature,
    UnitOfFrequency,
    PERCENTAGE,
)
from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorStateClass,
)

DOMAIN = "sungrow_solar"

# Configuration keys
CONF_HOST = "host"
CONF_APPKEY = "appkey"
CONF_SECRET_KEY = "secret_key"
CONF_POLL_INTERVAL = "poll_interval"

# Default values
DEFAULT_POLL_INTERVAL = 300  # 5 minutes
DEFAULT_HOST = "https://gateway.isolarcloud.com"

# API hosts by region
API_HOSTS = {
    "Global": "https://gateway.isolarcloud.com",
    "Hong Kong": "https://gateway.isolarcloud.com.hk",
    "Europe": "https://gateway.isolarcloud.eu",
    "Australia": "https://augateway.isolarcloud.com",
}

# Device type for Energy Storage System
DEVICE_TYPE_ESS = 14

# Data point definitions with metadata for sensor creation
# Format: point_id -> (name, unit, device_class, state_class, icon)
SENSOR_TYPES = {
    # Power sensors (instantaneous)
    "13011": ("Active Power", UnitOfPower.WATT, SensorDeviceClass.POWER, SensorStateClass.MEASUREMENT, "mdi:solar-power"),
    "13003": ("DC Power", UnitOfPower.WATT, SensorDeviceClass.POWER, SensorStateClass.MEASUREMENT, "mdi:solar-panel"),
    "13119": ("Load Power", UnitOfPower.WATT, SensorDeviceClass.POWER, SensorStateClass.MEASUREMENT, "mdi:home-lightning-bolt"),
    "13121": ("Grid Export Power", UnitOfPower.WATT, SensorDeviceClass.POWER, SensorStateClass.MEASUREMENT, "mdi:transmission-tower-export"),
    "13149": ("Grid Import Power", UnitOfPower.WATT, SensorDeviceClass.POWER, SensorStateClass.MEASUREMENT, "mdi:transmission-tower-import"),
    "13126": ("Battery Charging Power", UnitOfPower.WATT, SensorDeviceClass.POWER, SensorStateClass.MEASUREMENT, "mdi:battery-charging"),
    "13150": ("Battery Discharging Power", UnitOfPower.WATT, SensorDeviceClass.POWER, SensorStateClass.MEASUREMENT, "mdi:battery-minus"),
    "13012": ("Reactive Power", UnitOfPower.WATT, SensorDeviceClass.REACTIVE_POWER, SensorStateClass.MEASUREMENT, "mdi:sine-wave"),

    # Energy sensors - Daily (resetting)
    "13112": ("Solar Energy Today", UnitOfEnergy.WATT_HOUR, SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING, "mdi:solar-power"),
    "13122": ("Grid Export Energy Today", UnitOfEnergy.WATT_HOUR, SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING, "mdi:transmission-tower-export"),
    "13147": ("Grid Import Energy Today", UnitOfEnergy.WATT_HOUR, SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING, "mdi:transmission-tower-import"),
    "13199": ("Load Energy Today", UnitOfEnergy.WATT_HOUR, SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING, "mdi:home-lightning-bolt"),
    "13028": ("Battery Charge Energy Today", UnitOfEnergy.WATT_HOUR, SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING, "mdi:battery-charging"),
    "13029": ("Battery Discharge Energy Today", UnitOfEnergy.WATT_HOUR, SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING, "mdi:battery-minus"),

    # Energy sensors - Total (cumulative, for energy dashboard)
    "13134": ("Total Solar Energy", UnitOfEnergy.WATT_HOUR, SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING, "mdi:solar-power"),
    "13125": ("Total Grid Export Energy", UnitOfEnergy.WATT_HOUR, SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING, "mdi:transmission-tower-export"),
    "13148": ("Total Grid Import Energy", UnitOfEnergy.WATT_HOUR, SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING, "mdi:transmission-tower-import"),
    "13130": ("Total Load Energy", UnitOfEnergy.WATT_HOUR, SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING, "mdi:home-lightning-bolt"),
    "13034": ("Total Battery Charge Energy", UnitOfEnergy.WATT_HOUR, SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING, "mdi:battery-charging"),
    "13035": ("Total Battery Discharge Energy", UnitOfEnergy.WATT_HOUR, SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING, "mdi:battery-minus"),

    # Battery sensors
    "13141": ("Battery Level", PERCENTAGE, SensorDeviceClass.BATTERY, SensorStateClass.MEASUREMENT, "mdi:battery"),
    "13142": ("Battery Health", PERCENTAGE, None, SensorStateClass.MEASUREMENT, "mdi:battery-heart-variant"),
    "13143": ("Battery Temperature", UnitOfTemperature.CELSIUS, SensorDeviceClass.TEMPERATURE, SensorStateClass.MEASUREMENT, "mdi:thermometer"),
    "13138": ("Battery Voltage", UnitOfElectricPotential.VOLT, SensorDeviceClass.VOLTAGE, SensorStateClass.MEASUREMENT, "mdi:flash"),
    "13139": ("Battery Current", UnitOfElectricCurrent.AMPERE, SensorDeviceClass.CURRENT, SensorStateClass.MEASUREMENT, "mdi:current-dc"),
    "13140": ("Battery Capacity", UnitOfEnergy.WATT_HOUR, SensorDeviceClass.ENERGY_STORAGE, SensorStateClass.MEASUREMENT, "mdi:battery"),

    # Grid sensors
    "13157": ("Grid Voltage Phase A", UnitOfElectricPotential.VOLT, SensorDeviceClass.VOLTAGE, SensorStateClass.MEASUREMENT, "mdi:flash"),
    "13158": ("Grid Voltage Phase B", UnitOfElectricPotential.VOLT, SensorDeviceClass.VOLTAGE, SensorStateClass.MEASUREMENT, "mdi:flash"),
    "13159": ("Grid Voltage Phase C", UnitOfElectricPotential.VOLT, SensorDeviceClass.VOLTAGE, SensorStateClass.MEASUREMENT, "mdi:flash"),
    "13007": ("Grid Frequency", UnitOfFrequency.HERTZ, SensorDeviceClass.FREQUENCY, SensorStateClass.MEASUREMENT, "mdi:sine-wave"),

    # PV string sensors
    "13001": ("MPPT1 Voltage", UnitOfElectricPotential.VOLT, SensorDeviceClass.VOLTAGE, SensorStateClass.MEASUREMENT, "mdi:solar-panel"),
    "13002": ("MPPT1 Current", UnitOfElectricCurrent.AMPERE, SensorDeviceClass.CURRENT, SensorStateClass.MEASUREMENT, "mdi:solar-panel"),
    "13105": ("MPPT2 Voltage", UnitOfElectricPotential.VOLT, SensorDeviceClass.VOLTAGE, SensorStateClass.MEASUREMENT, "mdi:solar-panel"),
    "13106": ("MPPT2 Current", UnitOfElectricCurrent.AMPERE, SensorDeviceClass.CURRENT, SensorStateClass.MEASUREMENT, "mdi:solar-panel"),
}

# List of all point IDs to request from API
POINT_IDS = list(SENSOR_TYPES.keys())
