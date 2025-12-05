"""iSolarCloud API client for Sungrow Solar integration."""
from __future__ import annotations

import logging
from typing import Any

import aiohttp

from .const import DEVICE_TYPE_ESS, POINT_IDS

_LOGGER = logging.getLogger(__name__)


class ISolarCloudError(Exception):
    """Base exception for iSolarCloud API errors."""


class AuthenticationError(ISolarCloudError):
    """Authentication failed."""


class ISolarCloudAPI:
    """Async client for iSolarCloud OpenAPI."""

    def __init__(
        self,
        host: str,
        username: str,
        password: str,
        appkey: str,
        secret_key: str,
        session: aiohttp.ClientSession | None = None,
    ) -> None:
        """Initialize the API client."""
        self.host = host.rstrip("/")
        self.username = username
        self.password = password
        self.appkey = appkey
        self.secret_key = secret_key
        self._session = session
        self._token: str | None = None
        self._user_id: str | None = None
        self._owns_session = False

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
            self._owns_session = True
        return self._session

    async def close(self) -> None:
        """Close the API client session."""
        if self._owns_session and self._session and not self._session.closed:
            await self._session.close()

    async def _request(
        self,
        endpoint: str,
        body: dict[str, Any] | None = None,
        requires_token: bool = True,
    ) -> dict[str, Any]:
        """Make an API request."""
        session = await self._get_session()
        url = f"{self.host}{endpoint}"

        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "sys_code": "901",
            "x-access-key": self.secret_key,
        }

        request_body: dict[str, Any] = {
            "appkey": self.appkey,
            "lang": "_en_US",
            **(body or {}),
        }

        if requires_token and self._token:
            request_body["token"] = self._token

        _LOGGER.debug("API request to %s: %s", endpoint, request_body)

        try:
            async with session.post(url, headers=headers, json=request_body) as response:
                data = await response.json()
        except aiohttp.ClientError as err:
            raise ISolarCloudError(f"Request failed: {err}") from err

        _LOGGER.debug("API response from %s: %s", endpoint, data.get("result_code"))

        # Check for token errors
        if data.get("result_code") == "E00003" or data.get("result_msg") == "er_token_login_invalid":
            _LOGGER.debug("Token invalid, attempting re-login")
            self._token = None
            if await self.login():
                return await self._request(endpoint, body, requires_token)
            raise AuthenticationError("Re-authentication failed")

        if data.get("result_code") != "1":
            error_msg = data.get("result_msg", f"API error: {data.get('result_code')}")
            raise ISolarCloudError(error_msg)

        return data

    async def login(self) -> bool:
        """Authenticate with iSolarCloud."""
        if not self.username or not self.password:
            raise AuthenticationError("Username and password required")

        if not self.appkey:
            raise AuthenticationError("App key required")

        _LOGGER.debug("Logging in as %s", self.username)

        try:
            data = await self._request(
                "/openapi/login",
                {
                    "user_account": self.username,
                    "user_password": self.password,
                },
                requires_token=False,
            )
        except ISolarCloudError as err:
            raise AuthenticationError(f"Login failed: {err}") from err

        result = data.get("result_data", {})

        if result.get("login_state") == "1" and result.get("token"):
            self._token = result["token"]
            self._user_id = result.get("user_id")
            _LOGGER.info("Login successful for %s", self.username)
            return True

        # Handle login errors
        login_errors = {
            "-1": "Account does not exist",
            "0": "Incorrect password",
            "2": "Account locked due to incorrect password",
            "5": "Account locked by admin",
        }

        error_msg = login_errors.get(
            str(result.get("login_state")),
            result.get("msg", "Login failed"),
        )
        raise AuthenticationError(error_msg)

    @property
    def is_authenticated(self) -> bool:
        """Check if we have a valid token."""
        return self._token is not None

    async def get_plant_list(self) -> list[dict[str, Any]]:
        """Get list of power stations."""
        if not self._token:
            await self.login()

        data = await self._request(
            "/openapi/getPowerStationList",
            {"curPage": 1, "size": 100},
        )

        result_data = data.get("result_data", {})
        return result_data.get("pageList", [])

    async def get_device_list(self, ps_id: str) -> list[dict[str, Any]]:
        """Get list of devices for a power station."""
        if not self._token:
            await self.login()

        data = await self._request(
            "/openapi/getDeviceList",
            {"ps_id": ps_id, "curPage": 1, "size": 100},
        )

        result_data = data.get("result_data", {})
        return result_data.get("pageList", [])

    async def get_device_realtime_data(
        self,
        ps_key_list: list[str],
        device_type: int = DEVICE_TYPE_ESS,
        point_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        """Get real-time data for devices."""
        if not self._token:
            await self.login()

        if point_ids is None:
            point_ids = POINT_IDS

        data = await self._request(
            "/openapi/getDeviceRealTimeData",
            {
                "device_type": device_type,
                "point_id_list": point_ids,
                "ps_key_list": ps_key_list,
            },
        )

        return data.get("result_data", {})

    async def test_connection(self) -> bool:
        """Test the API connection by attempting login."""
        try:
            await self.login()
            return True
        except AuthenticationError:
            return False
