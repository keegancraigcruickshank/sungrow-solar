"""The Sungrow Solar integration."""
from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_PASSWORD, CONF_USERNAME, Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import ISolarCloudAPI
from .const import CONF_APPKEY, CONF_HOST, CONF_SECRET_KEY, DOMAIN
from .coordinator import SungrowDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Sungrow Solar from a config entry."""
    session = async_get_clientsession(hass)

    api = ISolarCloudAPI(
        host=entry.data[CONF_HOST],
        username=entry.data[CONF_USERNAME],
        password=entry.data[CONF_PASSWORD],
        appkey=entry.data[CONF_APPKEY],
        secret_key=entry.data[CONF_SECRET_KEY],
        session=session,
    )

    coordinator = SungrowDataUpdateCoordinator(hass, entry, api)

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    if unload_ok := await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        coordinator: SungrowDataUpdateCoordinator = hass.data[DOMAIN].pop(entry.entry_id)
        await coordinator.api.close()

    return unload_ok
