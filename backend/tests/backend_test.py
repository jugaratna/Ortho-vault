"""OrthoVault backend auth-boundary + RBAC tests (Iteration 3 security).

Requires seeded users/sessions (see seed_test_users.py):
  admin  -> test_token_admin
  editor1 -> test_token_editor1  (user_id=user_test_ed1)
  editor2 -> test_token_editor2  (user_id=user_test_ed2)
  viewer -> test_token_viewer
"""
import io
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = "https://surgical-vault-2.preview.emergentagent.com"
API = BASE_URL.rstrip("/") + "/api"

ADMIN = "test_token_admin"
EDITOR1 = "test_token_editor1"
EDITOR2 = "test_token_editor2"
VIEWER = "test_token_viewer"


def h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def s():
    return requests.Session()


# Module: public root
class TestPublicRoot:
    def test_root_no_auth(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        d = r.json()
        assert d.get("status") == "ok"
        assert "message" in d


# Module: unauth boundary — every PHI endpoint returns 401 without a bearer token
class TestUnauth401:
    def test_list_patients_no_auth(self, s):
        assert s.get(f"{API}/patients").status_code == 401

    def test_list_patients_bad_token(self, s):
        r = s.get(f"{API}/patients", headers=h("not-a-real-token-xyz"))
        assert r.status_code == 401

    def test_post_patients_no_auth(self, s):
        r = s.post(f"{API}/patients", json={"name": "X", "age": 1, "sex": "Male", "mobile": "1"})
        assert r.status_code == 401

    def test_delete_patient_no_auth(self, s):
        assert s.delete(f"{API}/patients/anything").status_code == 401

    def test_upload_no_auth(self, s):
        r = s.post(f"{API}/upload", files={"file": ("a.png", b"x", "image/png")})
        assert r.status_code == 401

    def test_files_no_auth(self, s):
        r = s.get(f"{API}/files/orthovault/uploads/patients/nope.png")
        assert r.status_code == 401

    def test_transcribe_no_auth(self, s):
        r = s.post(f"{API}/transcribe", files={"file": ("a.wav", b"x", "audio/wav")})
        assert r.status_code == 401

    def test_ai_draft_no_auth(self, s):
        r = s.post(f"{API}/ai/draft-discharge", json={"operative_note": "x"})
        assert r.status_code == 401

    def test_auth_me_no_auth(self, s):
        assert s.get(f"{API}/auth/me").status_code == 401


# Module: session exchange rejects bogus session_id
class TestSessionExchange:
    def test_bogus_session_id(self, s):
        r = s.post(f"{API}/auth/session", json={"session_id": "bogus-does-not-exist-xyz"})
        assert r.status_code in (400, 401), f"got {r.status_code}: {r.text}"


# Module: auth/me works with valid token
class TestAuthMe:
    def test_admin_me(self, s):
        r = s.get(f"{API}/auth/me", headers=h(ADMIN))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "admin"
        assert d["user_id"] == "user_test_admin"


# Module: patient CRUD with roles
class TestPatientsRBAC:
    created = []  # (owner_token, pid)

    def test_admin_can_list(self, s):
        r = s.get(f"{API}/patients", headers=h(ADMIN))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_create_sets_owner(self, s):
        payload = {"name": "TEST_AdminP", "age": 30, "sex": "Male", "mobile": "1", "country_code": "+91"}
        r = s.post(f"{API}/patients", headers=h(ADMIN), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        # owner_id is not in Patient response model but must persist. Confirm via list.
        assert d["name"] == "TEST_AdminP"
        TestPatientsRBAC.created.append((ADMIN, d["id"]))

    def test_editor_creates_and_owns(self, s):
        payload = {"name": "TEST_Ed1P", "age": 44, "sex": "Female", "mobile": "2"}
        r = s.post(f"{API}/patients", headers=h(EDITOR1), json=payload)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        TestPatientsRBAC.created.append((EDITOR1, pid))
        # editor1 sees it
        lst = s.get(f"{API}/patients", headers=h(EDITOR1)).json()
        ids = [p["id"] for p in lst]
        assert pid in ids

    def test_editor_isolation(self, s):
        """editor2 must NOT see editor1's or admin's patients."""
        lst = s.get(f"{API}/patients", headers=h(EDITOR2)).json()
        # editor2 has created nothing this session
        for _tok, pid in TestPatientsRBAC.created:
            assert pid not in [p["id"] for p in lst], f"editor2 leaked pid={pid}"

    def test_editor_cannot_access_admin_patient_by_id(self, s):
        # find the admin-created patient
        admin_pids = [pid for tok, pid in TestPatientsRBAC.created if tok == ADMIN]
        assert admin_pids, "seed missing admin patient"
        pid = admin_pids[0]
        r = s.get(f"{API}/patients/{pid}", headers=h(EDITOR2))
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"

    def test_viewer_cannot_create(self, s):
        r = s.post(f"{API}/patients", headers=h(VIEWER),
                   json={"name": "TEST_ViewerP", "age": 1, "sex": "Male", "mobile": "3"})
        assert r.status_code == 403

    def test_viewer_cannot_delete(self, s):
        # use admin's patient id
        admin_pids = [pid for tok, pid in TestPatientsRBAC.created if tok == ADMIN]
        pid = admin_pids[0]
        r = s.delete(f"{API}/patients/{pid}", headers=h(VIEWER))
        assert r.status_code == 403

    def test_admin_sees_everyones(self, s):
        lst = s.get(f"{API}/patients", headers=h(ADMIN)).json()
        ids = {p["id"] for p in lst}
        for _tok, pid in TestPatientsRBAC.created:
            assert pid in ids, f"admin should see pid={pid}"

    @classmethod
    def teardown_class(cls):
        sess = requests.Session()
        for tok, pid in cls.created:
            try:
                sess.delete(f"{API}/patients/{pid}", headers=h(ADMIN), timeout=10)
            except Exception:
                pass


# Module: file upload / download namespacing + path traversal
class TestFilesSecurity:
    PNG = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
           b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\x00\x01"
           b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
    ed1_path = None

    def test_editor1_upload_namespaced(self, s):
        files = {"file": ("t.png", io.BytesIO(self.PNG), "image/png")}
        r = s.post(f"{API}/upload", headers=h(EDITOR1), files=files, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "orthovault/uploads/patients/user_test_ed1/" in d["storage_path"], d["storage_path"]
        TestFilesSecurity.ed1_path = d["storage_path"]

    def test_editor1_can_fetch_own(self, s):
        assert TestFilesSecurity.ed1_path
        r = s.get(f"{API}/files/{TestFilesSecurity.ed1_path}", headers=h(EDITOR1), timeout=60)
        assert r.status_code == 200
        assert r.content == self.PNG

    def test_editor2_cannot_fetch_others_file(self, s):
        assert TestFilesSecurity.ed1_path
        r = s.get(f"{API}/files/{TestFilesSecurity.ed1_path}", headers=h(EDITOR2), timeout=60)
        assert r.status_code == 403

    def test_admin_can_fetch_any(self, s):
        assert TestFilesSecurity.ed1_path
        r = s.get(f"{API}/files/{TestFilesSecurity.ed1_path}", headers=h(ADMIN), timeout=60)
        assert r.status_code == 200

    def test_path_traversal_rejected(self, s):
        r = s.get(f"{API}/files/orthovault/uploads/patients/../../etc/passwd", headers=h(ADMIN))
        assert r.status_code == 400

    def test_outside_app_prefix_rejected(self, s):
        r = s.get(f"{API}/files/other-app/uploads/x.png", headers=h(ADMIN))
        assert r.status_code == 400

    # NEW: iteration 4 tightening — admin must also be forced into uploads/patients/ prefix
    def test_admin_orthovault_non_upload_prefix_rejected(self, s):
        """Even admin can no longer read orthovault objects outside uploads/patients/."""
        r = s.get(f"{API}/files/orthovault/something-else/foo.png", headers=h(ADMIN))
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"

    def test_admin_orthovault_bare_rejected(self, s):
        r = s.get(f"{API}/files/orthovault/other/thing.bin", headers=h(ADMIN))
        assert r.status_code == 400

    def test_admin_can_still_read_any_users_file_under_prefix(self, s):
        """Admin can still read editor1's file since it IS under uploads/patients/."""
        assert TestFilesSecurity.ed1_path, "prior upload test must have set ed1_path"
        r = s.get(f"{API}/files/{TestFilesSecurity.ed1_path}", headers=h(ADMIN), timeout=60)
        # Must be 200 (or 404 if object missing) — must NOT be 400/403
        assert r.status_code in (200, 404), f"unexpected {r.status_code}: {r.text}"
        assert r.status_code != 400
        assert r.status_code != 403

    def test_admin_valid_prefix_missing_object_not_400_or_403(self, s):
        """Constructed valid-prefix path pointing at a nonexistent object under another user's namespace.
        Should be 404 (S3 miss), not 400/403."""
        r = s.get(
            f"{API}/files/orthovault/uploads/patients/user_test_ed1/does-not-exist-xyz.png",
            headers=h(ADMIN), timeout=30,
        )
        assert r.status_code != 400, f"prefix check wrongly rejected: {r.text}"
        assert r.status_code != 403, f"admin wrongly forbidden: {r.text}"
        assert r.status_code in (404, 500), f"unexpected {r.status_code}: {r.text}"

    def test_percent_encoded_traversal_rejected(self, s):
        """%2e%2e (encoded dots) traversal must be rejected with 400.
        Send the URL raw so requests doesn't decode %2e. """
        # Build URL manually so %2e stays literal in the wire path
        url = f"{API}/files/orthovault/uploads/patients/%2e%2e/%2e%2e/etc/passwd"
        # requests preserves already-encoded sequences in the path
        r = s.get(url, headers=h(ADMIN), timeout=15)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"

    def test_percent_encoded_traversal_uppercase_rejected(self, s):
        url = f"{API}/files/orthovault/uploads/patients/%2E%2E/etc/passwd"
        r = s.get(url, headers=h(ADMIN), timeout=15)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"

    def test_editor_cross_user_isolation_still_403(self, s):
        """Regression: editor2 requesting editor1's actual file must still get 403 (not 400)."""
        assert TestFilesSecurity.ed1_path
        r = s.get(f"{API}/files/{TestFilesSecurity.ed1_path}", headers=h(EDITOR2), timeout=30)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"

    def test_viewer_upload_forbidden(self, s):
        files = {"file": ("t.png", io.BytesIO(self.PNG), "image/png")}
        r = s.post(f"{API}/upload", headers=h(VIEWER), files=files, timeout=60)
        assert r.status_code == 403


# Module: admin can PATCH roles, non-admin cannot
class TestUserAdmin:
    def test_non_admin_cannot_list_users(self, s):
        r = s.get(f"{API}/auth/users", headers=h(EDITOR1))
        assert r.status_code == 403

    def test_admin_lists_users(self, s):
        r = s.get(f"{API}/auth/users", headers=h(ADMIN))
        assert r.status_code == 200
        emails = {u["email"] for u in r.json()}
        assert "ed2@ortho.test" in emails

    def test_non_admin_cannot_patch_role(self, s):
        r = s.patch(f"{API}/auth/users/user_test_ed2", headers=h(EDITOR1), json={"role": "admin"})
        assert r.status_code == 403

    def test_admin_can_patch_role(self, s):
        # promote ed2 to viewer, then back to editor
        r = s.patch(f"{API}/auth/users/user_test_ed2", headers=h(ADMIN), json={"role": "viewer"})
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # confirm via list
        users = s.get(f"{API}/auth/users", headers=h(ADMIN)).json()
        ed2 = next(u for u in users if u["user_id"] == "user_test_ed2")
        assert ed2["role"] == "viewer"
        # revert
        s.patch(f"{API}/auth/users/user_test_ed2", headers=h(ADMIN), json={"role": "editor"})

    def test_invalid_role_rejected(self, s):
        r = s.patch(f"{API}/auth/users/user_test_ed2", headers=h(ADMIN), json={"role": "superadmin"})
        assert r.status_code == 400
