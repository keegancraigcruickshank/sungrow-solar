"""Config flow for Sungrow Solar integration."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.const import CONF_PASSWORD, CONF_USERNAME
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import AuthenticationError, ISolarCloudAPI, ISolarCloudError
from .const import (
    API_HOSTS,
    CONF_APPKEY,
    CONF_HOST,
    CONF_POLL_INTERVAL,
    CONF_SECRET_KEY,
    DEFAULT_HOST,
    DEFAULT_POLL_INTERVAL,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)


class SungrowSolarConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Sungrow Solar."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            try:
                # Test the connection
                session = async_get_clientsession(self.hass)
                api = ISolarCloudAPI(
                    host=user_input[CONF_HOST],
                    username=user_input[CONF_USERNAME],
                    password=user_input[CONF_PASSWORD],
                    appkey=user_input[CONF_APPKEY],
                    secret_key=user_input[CONF_SECRET_KEY],
                    session=session,
                )

                if not await api.test_connection():
                    errors["base"] = "cannot_connect"
                else:
                    # Get plants to create a unique ID
                    plants = await api.get_plant_list()
                    if plants:
                        # Use first plant ID as unique identifier
                        await self.async_set_unique_id(f"sungrow_{plants[0].get('ps_id', 'unknown')}")
                        self._abort_if_unique_id_configured()

                    return self.async_create_entry(
                        title=f"Sungrow Solar ({user_input[CONF_USERNAME]})",
                        data=user_input,
                    )

            except AuthenticationError as err:
                _LOGGER.error("Authentication failed: %s", err)
                errors["base"] = "invalid_auth"
            except ISolarCloudError as err:
                _LOGGER.error("API error: %s", err)
                errors["base"] = "cannot_connect"
            except Exception:
                _LOGGER.exception("Unexpected exception")
                errors["base"] = "unknown"

        # Build list of hosts for selection
        host_options = list(API_HOSTS.values())

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_USERNAME): str,
                    vol.Required(CONF_PASSWORD): str,
                    vol.Required(CONF_APPKEY): str,
                    vol.Required(CONF_SECRET_KEY): str,
                    vol.Required(CONF_HOST, default=DEFAULT_HOST): vol.In(host_options),
                    vol.Optional(
                        CONF_POLL_INTERVAL, default=DEFAULT_POLL_INTERVAL
                    ): vol.All(vol.Coerce(int), vol.Range(min=60, max=600)),
                }
            ),
            errors=errors,
        )
