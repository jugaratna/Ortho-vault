"""OrthoVault backend API tests"""
import io
import os
import pytest
import requests

BASE_URL = "https://surgical-vault-2.preview.emergentagent.com"
API = BASE_URL.rstrip("/") + "/api"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


# Module: health check
class TestHealth:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        d = r.json()
        assert "message" in d and "status" in d
        assert d["status"] == "ok"


# Module: file upload / retrieve via Emergent Object Storage
class TestUploadDownload:
    # 1x1 png bytes
    PNG = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
           b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\x00\x01"
           b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
    PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"

    def test_upload_image_and_fetch(self, s):
        files = {"file": ("test.png", io.BytesIO(self.PNG), "image/png")}
        r = s.post(f"{API}/upload", files=files, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("storage_path", "size", "name", "mime", "kind"):
            assert k in d
        assert d["kind"] == "image"
        assert d["mime"] == "image/png"
        assert d["name"] == "test.png"
        assert d["size"] > 0

        # fetch back
        r2 = s.get(f"{API}/files/{d['storage_path']}", timeout=60)
        assert r2.status_code == 200
        assert r2.content == self.PNG
        assert "image" in (r2.headers.get("content-type") or "")

    def test_upload_pdf(self, s):
        files = {"file": ("doc.pdf", io.BytesIO(self.PDF), "application/pdf")}
        r = s.post(f"{API}/upload", files=files, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kind"] == "pdf"
        assert "pdf" in d["mime"]

    def test_get_missing_file_404(self, s):
        r = s.get(f"{API}/files/orthovault/uploads/patients/does-not-exist-xyz.png", timeout=60)
        assert r.status_code == 404


# Module: patient CRUD + upsert
class TestPatients:
    created_ids = []

    def _payload(self, name="TEST_Alpha"):
        return {
            "name": name,
            "age": 42,
            "sex": "Male",
            "mobile": "9876543210",
            "country_code": "+91",
            "history": "TEST history",
            "date_of_surgery": "2025-01-15",
            "result": "TEST result",
            "pre_op": [],
            "post_op": [],
            "videos": [],
        }

    def test_create_patient(self, s):
        r = s.post(f"{API}/patients", json=self._payload("TEST_Create"))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] and len(d["id"]) >= 8
        assert d["name"] == "TEST_Create"
        assert d["age"] == 42
        assert d["sex"] == "Male"
        assert d["mobile"] == "9876543210"
        assert "_id" not in d
        TestPatients.created_ids.append(d["id"])

        # verify persistence via GET by id
        g = s.get(f"{API}/patients/{d['id']}")
        assert g.status_code == 200
        gd = g.json()
        assert gd["id"] == d["id"]
        assert gd["history"] == "TEST history"
        assert "_id" not in gd

    def test_list_no_objectid_leak(self, s):
        r = s.get(f"{API}/patients")
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) >= 1
        for p in arr:
            assert "_id" not in p
            assert "id" in p

    def test_upsert_updates_no_duplicate(self, s):
        # create
        r = s.post(f"{API}/patients", json=self._payload("TEST_Upsert"))
        pid = r.json()["id"]
        TestPatients.created_ids.append(pid)
        before = len(s.get(f"{API}/patients").json())

        # upsert with same id but changed name
        payload = self._payload("TEST_UpsertChanged")
        payload["id"] = pid
        payload["age"] = 55
        r2 = s.post(f"{API}/patients", json=payload)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["id"] == pid
        assert d2["name"] == "TEST_UpsertChanged"
        assert d2["age"] == 55

        after = len(s.get(f"{API}/patients").json())
        assert after == before, f"duplicate created: before={before} after={after}"

        # confirm via GET
        g = s.get(f"{API}/patients/{pid}").json()
        assert g["name"] == "TEST_UpsertChanged"
        assert g["age"] == 55

    def test_get_nonexistent_404(self, s):
        r = s.get(f"{API}/patients/nonexistent-id-xyz-123")
        assert r.status_code == 404

    def test_delete_and_double_delete(self, s):
        # create fresh
        r = s.post(f"{API}/patients", json=self._payload("TEST_Delete"))
        pid = r.json()["id"]
        d = s.delete(f"{API}/patients/{pid}")
        assert d.status_code == 200
        assert d.json().get("ok") is True
        # gone
        assert s.get(f"{API}/patients/{pid}").status_code == 404
        # double delete -> 404
        assert s.delete(f"{API}/patients/{pid}").status_code == 404

    def test_persist_media_arrays(self, s):
        p = self._payload("TEST_WithMedia")
        p["pre_op"] = [{
            "id": "m1", "name": "x.png", "kind": "image", "mime": "image/png",
            "size": 10, "storage_path": "orthovault/uploads/patients/x.png",
            "section": "pre_op", "uploaded_at": "2025-01-01T00:00:00+00:00"
        }]
        r = s.post(f"{API}/patients", json=p)
        assert r.status_code == 200
        pid = r.json()["id"]
        TestPatients.created_ids.append(pid)
        g = s.get(f"{API}/patients/{pid}").json()
        assert len(g["pre_op"]) == 1
        assert g["pre_op"][0]["kind"] == "image"

    @classmethod
    def teardown_class(cls):
        sess = requests.Session()
        for pid in cls.created_ids:
            try:
                sess.delete(f"{API}/patients/{pid}", timeout=10)
            except Exception:
                pass
