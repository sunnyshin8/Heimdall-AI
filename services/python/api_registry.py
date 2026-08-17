#!/usr/bin/env python3
"""
Heimdall AI: API Registry & CRM Service (Python Flask)
====================================================
Acts as a CRM for registered API endpoints.
State is stored in CockroachDB (pg8000).
"""

import os
import ssl
from datetime import datetime, timezone
from urllib.parse import urlparse
from flask import Flask, request, jsonify
import pg8000.dbapi

app = Flask(__name__)
DATABASE_URL = os.environ.get("DATABASE_URL")

def get_db():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not set")
    parsed = urlparse(DATABASE_URL)
    ssl_ctx = ssl.create_default_context() if "sslmode=verify-full" in DATABASE_URL else None
    return pg8000.dbapi.connect(
        user=parsed.username,
        password=parsed.password,
        host=parsed.hostname,
        port=parsed.port or 26257,
        database=parsed.path.lstrip('/'),
        ssl_context=ssl_ctx
    )

def dict_fetchall(cursor):
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]

def dict_fetchone(cursor):
    row = cursor.fetchone()
    if row:
        columns = [col[0] for col in cursor.description]
        return dict(zip(columns, row))
    return None

SECURITY_CHECKS = [
    {"id": "has_auth",      "label": "Authentication required",    "weight": 25},
    {"id": "no_wildcard_cors","label": "No wildcard CORS origin",  "weight": 20},
    {"id": "uses_https",    "label": "HTTPS endpoint",            "weight": 20},
    {"id": "rate_limited",  "label": "Rate limiting declared",     "weight": 15},
    {"id": "versioned",     "label": "API versioning present",     "weight": 10},
    {"id": "has_owner",     "label": "Owner/team assigned",        "weight": 10},
]

def calculate_compliance(api_record):
    passed = []
    failed = []
    score = 0
    url = api_record.get("url", "").lower()
    
    checks = {
        "has_auth":        api_record.get("auth_type") not in [None, "", "none"],
        "no_wildcard_cors": api_record.get("cors_origin", "*") != "*",
        "uses_https":      url.startswith("https://"),
        "rate_limited":    bool(api_record.get("rate_limit")),
        "versioned":       any(f"/v{i}" in url for i in range(1, 10)),
        "has_owner":       bool(api_record.get("owner") or api_record.get("team")),
    }

    for check in SECURITY_CHECKS:
        if checks.get(check["id"], False):
            score += check["weight"]
            passed.append(check["label"])
        else:
            failed.append(check["label"])

    return score, passed, failed

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "api-registry-db"})

@app.route("/apis", methods=["GET"])
def list_apis():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM apis ORDER BY compliance_score DESC")
                apis = dict_fetchall(cur)
                for a in apis:
                    for k, v in a.items():
                        if isinstance(v, datetime):
                            a[k] = v.isoformat()
                return jsonify({"success": True, "apis": apis, "total": len(apis)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/apis", methods=["POST"])
def register_api():
    data = request.json or {}
    required = ["name", "url"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Missing required field: {field}"}), 400

    score, passed, failed = calculate_compliance(data)
    risk = "Low" if score >= 80 else "Medium" if score >= 50 else "High"
    now = datetime.now(timezone.utc)

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO apis (name, url, owner, team, auth_type, cors_origin, rate_limit, environment, status, compliance_score, risk_level, checks_passed, checks_failed, created_at, updated_at, last_scanned_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                """, (
                    data["name"], data["url"], data.get("owner", ""), data.get("team", ""),
                    data.get("auth_type", "none"), data.get("cors_origin", "*"), data.get("rate_limit", ""),
                    data.get("environment", "production"), "active", score, risk, passed, failed,
                    now, now, now
                ))
                record = dict_fetchone(cur)
                
                cur.execute("""
                    INSERT INTO api_scan_history (api_id, score, risk, passed, failed, trigger_type, scanned_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (record["id"], score, risk, passed, failed, "registration", now))
                
                conn.commit()
                
                for k, v in record.items():
                    if isinstance(v, datetime):
                        record[k] = v.isoformat()
                return jsonify({"success": True, "api": record}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/stats", methods=["GET"])
def stats():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT risk_level, compliance_score FROM apis")
                apis = dict_fetchall(cur)
                total = len(apis)
                high_risk = sum(1 for a in apis if a["risk_level"] == "High")
                medium_risk = sum(1 for a in apis if a["risk_level"] == "Medium")
                low_risk = sum(1 for a in apis if a["risk_level"] == "Low")
                avg_score = round(sum(a["compliance_score"] for a in apis) / max(total, 1), 1)
                return jsonify({
                    "total_apis": total,
                    "high_risk": high_risk,
                    "medium_risk": medium_risk,
                    "low_risk": low_risk,
                    "avg_compliance_score": avg_score,
                })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("API_REGISTRY_PORT", 5002))
    print(f"[API Registry] Starting on port {port} with CockroachDB...")
    app.run(host="0.0.0.0", port=port)
