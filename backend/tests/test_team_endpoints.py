"""Spot-check tests for /api/auth/users (list) and PATCH /api/auth/users/{id} (role change).

Uses seeded tokens from seed_test_users.py.
"""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load from frontend/.env to hit the public preview URL exactly like the app does
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

ADMIN = "test_token_admin"
EDITOR = "test_token_editor1"
VIEWER = "test_token_viewer"


def h(token=None):
    return {"Authorization": f"Bearer {token}"} if token else {}


# ---- GET /api/auth/users ----
class TestListUsers:
    def test_admin_lists_users_200(self):
        r = requests.get(f"{BASE_URL}/api/auth/users", headers=h(ADMIN), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # Sanity: contains our seeded admin
        assert any(u.get("user_id") == "user_test_admin" and u.get("role") == "admin" for u in data)
        # Response shape
        for u in data:
            for k in ("user_id", "email", "name", "picture", "role"):
                assert k in u
            # Never leak Mongo _id
            assert "_id" not in u

    def test_editor_forbidden_403(self):
        r = requests.get(f"{BASE_URL}/api/auth/users", headers=h(EDITOR), timeout=15)
        assert r.status_code == 403, r.text

    def test_viewer_forbidden_403(self):
        r = requests.get(f"{BASE_URL}/api/auth/users", headers=h(VIEWER), timeout=15)
        assert r.status_code == 403, r.text

    def test_unauth_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/users", timeout=15)
        assert r.status_code == 401, r.text


# ---- PATCH /api/auth/users/{user_id} ----
class TestUpdateRole:
    TARGET = "user_test_ed2"  # editor2 — flip its role for tests

    def test_admin_updates_role_200_and_persists(self):
        # Change editor2 -> viewer
        r = requests.patch(
            f"{BASE_URL}/api/auth/users/{self.TARGET}",
            json={"role": "viewer"}, headers=h(ADMIN), timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Verify via GET
        lst = requests.get(f"{BASE_URL}/api/auth/users", headers=h(ADMIN), timeout=15).json()
        target = next((u for u in lst if u["user_id"] == self.TARGET), None)
        assert target is not None and target["role"] == "viewer"

        # Restore to editor
        r2 = requests.patch(
            f"{BASE_URL}/api/auth/users/{self.TARGET}",
            json={"role": "editor"}, headers=h(ADMIN), timeout=15,
        )
        assert r2.status_code == 200

    def test_invalid_role_400(self):
        r = requests.patch(
            f"{BASE_URL}/api/auth/users/{self.TARGET}",
            json={"role": "superadmin"}, headers=h(ADMIN), timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_editor_forbidden_403(self):
        r = requests.patch(
            f"{BASE_URL}/api/auth/users/{self.TARGET}",
            json={"role": "viewer"}, headers=h(EDITOR), timeout=15,
        )
        assert r.status_code == 403, r.text

    def test_viewer_forbidden_403(self):
        r = requests.patch(
            f"{BASE_URL}/api/auth/users/{self.TARGET}",
            json={"role": "viewer"}, headers=h(VIEWER), timeout=15,
        )
        assert r.status_code == 403, r.text

    def test_unauth_401(self):
        r = requests.patch(
            f"{BASE_URL}/api/auth/users/{self.TARGET}",
            json={"role": "viewer"}, timeout=15,
        )
        assert r.status_code == 401, r.text

    def test_unknown_user_404(self):
        r = requests.patch(
            f"{BASE_URL}/api/auth/users/user_does_not_exist_TEST",
            json={"role": "editor"}, headers=h(ADMIN), timeout=15,
        )
        assert r.status_code == 404, r.text
