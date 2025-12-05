"""DataUpdateCoordinator for Sungrow Solar integration."""
from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_PASSWORD, CONF_USERNAME
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import AuthenticationError, ISolarCloudAPI, ISolarCloudError
from .const import (
    CONF_APPKEY,
    CONF_HOST,
    CONF_POLL_INTERVAL,
    CONF_SECRET_KEY,
    DEFAULT_POLL_INTERVAL,
    DEVICE_TYPE_ESS,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)


class SungrowDataUpdateCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator to manage fetching Sungrow data from iSolarCloud API."""

    config_entry: ConfigEntry

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        api: ISolarCloudAPI,
    ) -> None:
        """Initialize the coordinator."""
        self.api = api
        self.plants: list[dict[str, Any]] = []
        self.devices: dict[str, list[dict[str, Any]]] = {}  # ps_id -> devices

        poll_interval = entry.data.get(CONF_POLL_INTERVAL, DEFAULT_POLL_INTERVAL)

        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=poll_interval),
        )

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch data from iSolarCloud API."""
        try:
            # Get plant list
            self.plants = await self.api.get_plant_list()
            _LOGGER.debug("Found %d plants", len(self.plants))

            if not self.plants:
                return {}

            # Get devices for each plant and collect ps_keys
            all_data: dict[str, Any] = {"plants": {}, "devices": {}}

            for plant in self.plants:
                ps_id = str(plant.get("ps_id", ""))
                ps_name = plant.get("ps_name", f"Plant {ps_id}")

                all_data["plants"][ps_id] = {
                    "name": ps_name,
                    "ps_id": ps_id,
                    "capacity": plant.get("total_capcity", {}),
                }

                # Get devices for this plant
                try:
                    devices = await self.api.get_device_list(ps_id)
                    self.devices[ps_id] = devices
                    _LOGGER.debug("Found %d devices for plant %s", len(devices), ps_id)

                    # Get real-time data for ESS devices
                    ess_devices = [
                        d for d in devices
                        if d.get("device_type") == DEVICE_TYPE_ESS
                    ]

                    if ess_devices:
                        ps_keys = [d.get("ps_key") for d in ess_devices if d.get("ps_key")]
                        if ps_keys:
                            realtime_data = await self.api.get_device_realtime_data(ps_keys)
                            device_points = realtime_data.get("device_point_list", [])

                            for device_data in device_points:
                                ps_key = device_data.get("ps_key")
                                points = device_data.get("device_point", {})

                                # Find device info
                                device_info = next(
                                    (d for d in ess_devices if d.get("ps_key") == ps_key),
                                    {},
                                )

                                all_data["devices"][ps_key] = {
                                    "ps_id": ps_id,
                                    "ps_key": ps_key,
                                    "device_name": device_info.get("device_name", "ESS Device"),
                                    "device_sn": device_info.get("device_sn", ""),
                                    "device_type": DEVICE_TYPE_ESS,
                                    "points": self._parse_points(points),
                                }
                except ISolarCloudError as err:
                    _LOGGER.warning("Error fetching devices for plant %s: %s", ps_id, err)

            return all_data

        except AuthenticationError as err:
            raise UpdateFailed(f"Authentication failed: {err}") from err
        except ISolarCloudError as err:
            raise UpdateFailed(f"Error communicating with API: {err}") from err

    def _parse_points(self, points: dict[str, Any]) -> dict[str, float | None]:
        """Parse point data, converting string values to floats."""
        parsed: dict[str, float | None] = {}

        for key, value in points.items():
            # Keys come as "p13011" format, extract the number
            point_id = key.lstrip("p") if key.startswith("p") else key

            if value is None or value == "" or value == "--":
                parsed[point_id] = None
            else:
                try:
                    parsed[point_id] = float(value)
                except (ValueError, TypeError):
                    _LOGGER.debug("Could not parse value for %s: %s", point_id, value)
                    parsed[point_id] = None

        return parsed

    def get_device_value(self, ps_key: str, point_id: str) -> float | None:
        """Get a specific value from device data."""
        if not self.data:
            return None

        device = self.data.get("devices", {}).get(ps_key, {})
        return device.get("points", {}).get(point_id)
