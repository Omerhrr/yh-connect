from tests.conftest import auth_headers

def test_public_faq_only_shows_active(client, admin_user):
    headers = auth_headers(admin_user["access_token"])

    resp = client.post(
        "/api/v1/admin/content/faq",
        json={"question": "How do I get paid?", "answer": "Milestones release to your wallet.", "category": "Payments"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    active_item = resp.json()

    resp = client.post(
        "/api/v1/admin/content/faq",
        json={"question": "Hidden question", "answer": "Shouldn't show up", "category": "Payments", "active": False},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    hidden_item = resp.json()

    resp = client.get("/api/v1/content/faq")
    assert resp.status_code == 200
    ids = [i["id"] for i in resp.json()]
    assert active_item["id"] in ids
    assert hidden_item["id"] not in ids

def test_admin_faq_crud_and_auth(client, admin_user, client_user):
    headers = auth_headers(admin_user["access_token"])

    resp = client.get("/api/v1/admin/content/faq", headers=headers)
    assert resp.status_code == 200

    resp = client.post(
        "/api/v1/admin/content/faq",
        json={"question": "What is escrow?", "answer": "Funds held safely until work is approved."},
        headers=headers,
    )
    assert resp.status_code == 201
    item = resp.json()
    assert item["category"] == "General"
    assert item["active"] is True

    resp = client.patch(
        f"/api/v1/admin/content/faq/{item['id']}",
        json={"answer": "Updated answer", "sort_order": 5},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["answer"] == "Updated answer"
    assert resp.json()["sort_order"] == 5

    resp = client.delete(f"/api/v1/admin/content/faq/{item['id']}", headers=headers)
    assert resp.status_code == 204

    resp = client.get("/api/v1/admin/content/faq", headers=headers)
    assert all(i["id"] != item["id"] for i in resp.json())

    client_headers = auth_headers(client_user["access_token"])
    resp = client.post(
        "/api/v1/admin/content/faq",
        json={"question": "x", "answer": "y"},
        headers=client_headers,
    )
    assert resp.status_code == 403
