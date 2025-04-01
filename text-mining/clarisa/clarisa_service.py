import os
import requests
import jwt
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class ClarisaService:
    def __init__(self):
        self.clarisa_host = os.getenv("CLARISA_HOST")
        if not self.clarisa_host.endswith("api/"):
            self.clarisa_host = self.clarisa_host.rstrip("/") + "/api/"
        self.login = os.getenv("CLARISA_LOGIN")
        self.password = os.getenv("CLARISA_PASSWORD")
        self.owner_mis = os.getenv("CLARISA_MIS")
        self.token = None
        logger.info(
            f"ClarisaService initialized with host: {self.clarisa_host}")

    def get_token(self):
        if not self.token or not self._valid_token(self.token):
            logger.debug("Token missing or expired, requesting new token")
            url = self.clarisa_host + "auth/login"
            response = requests.post(
                url, json={"login": self.login, "password": self.password})
            if response.status_code == 200:
                self.token = response.json().get("access_token")
                logger.info("Successfully obtained new Clarisa token")
            else:
                error_msg = f"Failed to retrieve Clarisa token. Status: {response.status_code}"
                logger.error(error_msg)
                raise Exception(error_msg)
        return self.token

    def _valid_token(self, token):
        try:
            decoded = jwt.decode(token, options={"verify_signature": False})
            now = int(__import__("time").time())
            valid = decoded.get("exp", 0) > now
            if not valid:
                logger.debug("Token has expired")
            return valid
        except jwt.InvalidTokenError:
            logger.warning("Invalid token format")
            return False

    def authorize_client(self, client_mis: str, client_secret: str) -> (bool, dict):
        """
        Llama al endpoint de Clarisa para validar el cliente. Se espera que el endpoint
        retorne datos que incluyan receiver_mis. Se valida que su acrónimo coincida con el valor owner_mis.
        """
        logger.info(f"Authorizing client: {client_mis}")
        token = self.get_token()
        url = self.clarisa_host + "app-secrets/validate"
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "client_id": client_mis,
            "secret": client_secret
        }

        try:
            response = requests.post(url, json=payload, headers=headers)
            if response.status_code == 200:
                data = response.json()
                receiver_mis = data.get("receiver_mis", {})
                if receiver_mis.get("acronym") == self.owner_mis:
                    logger.info(f"Client {client_mis} successfully authorized")
                    return True, data
                else:
                    logger.warning(
                        f"Client {client_mis} MIS mismatch: expected {self.owner_mis}, got {receiver_mis.get('acronym')}")
            else:
                logger.warning(
                    f"Client {client_mis} authorization failed. Status: {response.status_code}")
            return False, {}
        except Exception as e:
            logger.error(f"Error during client authorization: {str(e)}")
            return False, {}
