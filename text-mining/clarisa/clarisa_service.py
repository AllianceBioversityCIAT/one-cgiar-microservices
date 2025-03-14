import os
import requests
import jwt
from dotenv import load_dotenv

load_dotenv()

load_dotenv()


class ClarisaService:
    def __init__(self):
        self.clarisa_host = os.getenv("CLARISA_HOST")
        if not self.clarisa_host.endswith("api/"):
            self.clarisa_host = self.clarisa_host.rstrip("/") + "/api/"
        self.login = os.getenv("CLARISA_LOGIN")
        self.password = os.getenv("CLARISA_PASSWORD")
        self.owner_mis = os.getenv("CLARISA_MIS")
        self.token = None

    def get_token(self):
        if not self.token or not self._valid_token(self.token):
            url = self.clarisa_host + "auth/login"
            response = requests.post(
                url, json={"login": self.login, "password": self.password})
            if response.status_code == 200:
                self.token = response.json().get("access_token")
            else:
                raise Exception("Failed to retrieve Clarisa token")
        return self.token

    def _valid_token(self, token):
        try:
            decoded = jwt.decode(token, options={"verify_signature": False})
            now = int(__import__("time").time())
            return decoded.get("exp", 0) > now
        except jwt.InvalidTokenError:
            return False

    def authorize_client(self, client_mis: str, client_secret: str) -> (bool, dict):
        """
        Llama al endpoint de Clarisa para validar el cliente. Se espera que el endpoint
        retorne datos que incluyan receiver_mis. Se valida que su acrónimo coincida con el valor owner_mis.
        """
        token = self.get_token()
        url = self.clarisa_host + "app-secrets/validate"
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "client_id": client_mis,
            "secret": client_secret
        }
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            data = response.json()
            receiver_mis = data.get("receiver_mis", {})
            if receiver_mis.get("acronym") == self.owner_mis:
                return True, data
        return False, {}
