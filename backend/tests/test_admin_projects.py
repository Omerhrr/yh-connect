from tests.conftest import auth_headers


def _post_project(client, client_user):
    resp = client.post(
        "/api/v1/projects",
        json={
            "title": "Renovate warehouse roof",
            "description": "Replace corrugated roofing sheets",
            "category_id": "civil-structural-engineering",
            "budget_min": 150000,
            "budget_max": 400000,
            "location": "Kano, Nigeria",
        },
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _hire(client, client_user, professional_user, project):
    resp = client.post(
        f"/api/v1/projects/{project['id']}/bids",
        json={"amount": 300000, "cover_letter": "Ready to start", "estimated_days": 10},
        headers=auth_headers(professional_user["access_token"]),
    )
    assert resp.status_code == 201, resp.text
    bid = resp.json()
    resp = client.patch(
        f"/api/v1/bids/{bid['id']}", json={"status": "accepted"}, headers=auth_headers(client_user["access_token"])
    )
    assert resp.status_code == 200, resp.text


def test_admin_projects_list_count_and_search(client, client_user, professional_user, admin_user):
    project = _post_project(client, client_user)
    headers = auth_headers(admin_user["access_token"])

    resp = client.get("/api/v1/admin/projects/count", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1

    resp = client.get("/api/v1/admin/projects?status_filter=open", headers=headers)
    assert resp.status_code == 200
    assert all(p["status"] == "open" for p in resp.json())
    assert any(p["id"] == project["id"] for p in resp.json())

    resp = client.get(f"/api/v1/admin/projects?q={project['title'][:10]}", headers=headers)
    assert resp.status_code == 200
    assert any(p["id"] == project["id"] for p in resp.json())

    resp = client.get("/api/v1/admin/projects?has_dispute=true", headers=headers)
    assert resp.status_code == 200
    assert all(p["has_open_dispute"] for p in resp.json())


def test_admin_project_detail_has_parties_and_financials(client, client_user, professional_user, admin_user):
    project = _post_project(client, client_user)
    _hire(client, client_user, professional_user, project)

    headers = auth_headers(admin_user["access_token"])
    resp = client.get(f"/api/v1/admin/projects/{project['id']}", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["client"]["id"] == client_user["user"]["id"]
    assert data["client"]["email"] == client_user["user"]["email"]
    assert data["professional"]["id"] == professional_user["user"]["id"]
    assert "financials" in data
    assert data["financials"]["total_funded"] == 0
    assert data["wallet_transactions"] == []


def test_admin_projects_require_admin(client, client_user):
    headers = auth_headers(client_user["access_token"])
    resp = client.get("/api/v1/admin/projects/count", headers=headers)
    assert resp.status_code == 403
