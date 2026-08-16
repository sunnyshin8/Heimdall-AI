import { NextResponse } from "next/server";

const REGISTRY_URL = `http://localhost:${process.env.API_REGISTRY_PORT || "5002"}`;

export async function GET() {
  try {
    const [apisRes, statsRes] = await Promise.all([
      fetch(`${REGISTRY_URL}/apis`),
      fetch(`${REGISTRY_URL}/stats`),
    ]);
    const apis  = await apisRes.json();
    const stats = await statsRes.json();
    return NextResponse.json({ success: true, ...apis, stats });
  } catch {
    // Return mock data when Python service is not running
    const mockApis = [
      { id: "a1", name: "User Auth API", url: "https://auth.myapp.com/v2", owner: "platform-team", team: "infra", auth_type: "bearer", cors_origin: "https://myapp.com", rate_limit: "1000/min", environment: "production", status: "active", compliance_score: 90, risk_level: "Low", checks_passed: ["Authentication required","No wildcard CORS","HTTPS endpoint","Rate limiting declared","API versioning present","Owner/team assigned"], checks_failed: [], last_scanned_at: new Date().toISOString() },
      { id: "a2", name: "Payment Gateway", url: "https://pay.myapp.com/v1", owner: "payments-team", team: "fintech", auth_type: "api_key", cors_origin: "https://myapp.com", rate_limit: "500/min", environment: "production", status: "active", compliance_score: 90, risk_level: "Low", checks_passed: ["Authentication required","No wildcard CORS","HTTPS endpoint","Rate limiting declared","API versioning present","Owner/team assigned"], checks_failed: [], last_scanned_at: new Date().toISOString() },
      { id: "a3", name: "Legacy Reports API", url: "http://reports.internal/api", owner: "", team: "", auth_type: "none", cors_origin: "*", rate_limit: "", environment: "production", status: "active", compliance_score: 0, risk_level: "High", checks_passed: [], checks_failed: ["Authentication required","No wildcard CORS","HTTPS endpoint","Rate limiting declared","API versioning present","Owner/team assigned"], last_scanned_at: new Date().toISOString() },
      { id: "a4", name: "Notification Service", url: "https://notify.myapp.com/v3", owner: "comms-team", team: "product", auth_type: "bearer", cors_origin: "https://myapp.com", rate_limit: "5000/min", environment: "production", status: "active", compliance_score: 90, risk_level: "Low", checks_passed: ["Authentication required","No wildcard CORS","HTTPS endpoint","Rate limiting declared","API versioning present","Owner/team assigned"], checks_failed: [], last_scanned_at: new Date().toISOString() },
    ];
    const stats = { total_apis: 4, high_risk: 1, medium_risk: 0, low_risk: 3, avg_compliance_score: 67.5 };
    return NextResponse.json({ success: true, apis: mockApis, total: 4, stats });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${REGISTRY_URL}/apis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
