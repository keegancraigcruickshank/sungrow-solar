"""Sensor platform for Sungrow Solar integration."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, SENSOR_TYPES
from .coordinator import SungrowDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Sungrow Solar sensors from a config entry."""
    coordinator: SungrowDataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]

    # Wait for first refresh to get device data
    await coordinator.async_config_entry_first_refresh()

    entities: list[SungrowSensorEntity] = []

    # Create sensors for each device
    if coordinator.data:
        for ps_key, device_data in coordinator.data.get("devices", {}).items():
            device_name = device_data.get("device_name", "ESS Device")
            device_sn = device_data.get("device_sn", ps_key)
            ps_id = device_data.get("ps_id", "")

            # Get plant name for device info
            plant_info = coordinator.data.get("plants", {}).get(ps_id, {})
            plant_name = plant_info.get("name", f"Plant {ps_id}")

            # Create a sensor for each point type
            for point_id, sensor_config in SENSOR_TYPES.items():
                entities.append(
                    SungrowSensorEntity(
                        coordinator=coordinator,
                        ps_key=ps_key,
                        point_id=point_id,
                        device_name=device_name,
                        device_sn=device_sn,
                        plant_name=plant_name,
                        sensor_config=sensor_config,
                    )
                )

    async_add_entities(entities)


class SungrowSensorEntity(CoordinatorEntity[SungrowDataUpdateCoordinator], SensorEntity):
    """Representation of a Sungrow sensor."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: SungrowDataUpdateCoordinator,
        ps_key: str,
        point_id: str,
        device_name: str,
        device_sn: str,
        plant_name: str,
        sensor_config: tuple,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)

        self._ps_key = ps_key
        self._point_id = point_id

        # Unpack sensor configuration
        name, unit, device_class, state_class, icon = sensor_config

        self._attr_name = name
        self._attr_native_unit_of_measurement = unit
        self._attr_device_class = device_class
        self._attr_state_class = state_class
        self._attr_icon = icon

        # Create unique ID
        self._attr_unique_id = f"{ps_key}_{point_id}"

        # Device info groups sensors by physical device
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, device_sn)},
            name=f"{plant_name} {device_name}",
            manufacturer="Sungrow",
            model="Energy Storage System",
            serial_number=device_sn,
        )

    @property
    def native_value(self) -> float | None:
        """Return the state of the sensor."""
        return self.coordinator.get_device_value(self._ps_key, self._point_id)

    @property
    def available(self) -> bool:
        """Return if entity is available."""
        if not self.coordinator.last_update_success:
            return False

        # Check if device still exists in data
        if not self.coordinator.data:
            return False

        return self._ps_key in self.coordinator.data.get("devices", {})
