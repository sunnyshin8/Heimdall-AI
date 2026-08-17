'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
  Shield, Terminal, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Play,
  User, FileText, GitPullRequest, Database, Layers, Cpu, ArrowRight, Info,
  Globe, Lock, Zap, TrendingUp, Code2, Server, Plus, Activity
} from 'lucide-react';

type TabType = 'landing' | 'dashboard' | 'registry' | 'about';

interface ApiRecord {
  id: string; name: string; url: string; owner: string; team: string;
  auth_type: string; cors_origin: string; rate_limit: string; environment: string;
  status: string; compliance_score: number; risk_level: string;
  checks_passed: string[]; checks_failed: string[]; last_scanned_at: string;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>('landing');
  const [prs, setPrs] = useState<any[]>([]);
  const [selectedPr, setSelectedPr] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingPrs, setLoadingPrs] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [prUrl, setPrUrl] = useState('');
  const [rrKey, setRrKey] = useState(0);
  const [apis, setApis] = useState<ApiRecord[]>([]);
  const [apiStats, setApiStats] = useState<any>(null);
  const [loadingApis, setLoadingApis] = useState(false);
  const [selectedApi, setSelectedApi] = useState<ApiRecord | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [newApi, setNewApi] = useState({ name: '', url: '', owner: '', team: '', auth_type: 'bearer', cors_origin: 'https://', rate_limit: '' });

  useEffect(() => { fetchPrs(); }, []);
  useEffect(() => {
    const iv = setInterval(() => setRrKey(k => k + 1), 7000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    if (selectedPr) fetchLogs(selectedPr.id || selectedPr.prId);
    else setLogs([]);
  }, [selectedPr]);
  useEffect(() => {
    if (activeTab === 'registry') fetchApis();
  }, [activeTab]);

  const fetchPrs = async () => {
    setLoadingPrs(true);
    try {
      const res = await fetch('/api/prs');
      const data = await res.json();
      if (data.success) { setPrs(data.prs); if (data.prs.length > 0 && !selectedPr) setSelectedPr(data.prs[0]); }
    } catch (err) { console.error(err); } finally { setLoadingPrs(false); }
  };

  const fetchLogs = async (prId: string) => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/prs/logs?prId=${prId}`);
      const data = await res.json();
      if (data.success) setLogs(data.logs);
    } catch (err) { console.error(err); } finally { setLoadingLogs(false); }
  };

  const fetchApis = async () => {
    setLoadingApis(true);
    try {
      const res = await fetch('/api/registry');
      const data = await res.json();
      if (data.success) { setApis(data.apis || []); setApiStats(data.stats); }
    } catch (err) { console.error(err); } finally { setLoadingApis(false); }
  };

  const handleRegisterApi = async () => {
    try {
      const res = await fetch('/api/registry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newApi) });
      const data = await res.json();
      if (data.success) { setShowRegisterForm(false); setNewApi({ name: '', url: '', owner: '', team: '', auth_type: 'bearer', cors_origin: 'https://', rate_limit: '' }); fetchApis(); }
    } catch (err) { console.error(err); }
  };

  const handleTriggerScan = async () => {
    if (!prUrl) return;
    setScanning(true);
    try {
      const res = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prUrl }) });
      const data = await res.json();
      if (data.success) { await fetchPrs(); if (data.result) setSelectedPr(data.result); }
      else alert("Scan failed: " + (data.error || "Unknown error"));
    } catch (err) { console.error(err); } finally { setScanning(false); setPrUrl(''); }
  };

  const getStatusBadge = (s: string) => {
    if (s === 'Passed') return <span className="badge badge-passed">Passed</span>;
    if (s === 'Failed') return <span className="badge badge-failed">Failed</span>;
    return <span className="badge badge-pending">Pending</span>;
  };
  const getStatusIcon = (s: string) => {
    if (s === 'Success') return <CheckCircle2 style={{ color: '#1d885d' }} size={18} />;
    if (s === 'Failure') return <XCircle style={{ color: '#c93b3b' }} size={18} />;
    return <AlertTriangle style={{ color: '#c07d17' }} size={18} />;
  };
  const riskColor = (r: string) => r === 'High' ? '#c93b3b' : r === 'Medium' ? '#c07d17' : '#1d885d';
  const riskBg = (r: string) => r === 'High' ? '#fdf2f2' : r === 'Medium' ? '#fef8eb' : '#ebf9f3';

  const totalAudited = prs.length;
  const failedAudits = prs.filter(p => p.status === 'Failed').length;
  const passedAudits = prs.filter(p => p.status === 'Passed').length;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* NAVBAR */}
      <div className="navbar clay-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setActiveTab('landing')}>
          <div style={{ background: 'var(--clay-primary)', padding: '0.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={24} style={{ color: 'var(--clay-primary-text)' }} />
          </div>
          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b' }}>Heimdall AI</span>
        </div>
        <div className="nav-links">
          {(['landing', 'dashboard', 'registry', 'about'] as TabType[]).map(t => (
            <div key={t} className={`nav-item ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
              {t === 'landing' ? 'Home' : t === 'dashboard' ? 'Audit Dashboard' : t === 'registry' ? 'API Registry' : 'How it Works'}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }} className="hide-mobile">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.45rem 1rem', borderRadius: '14px', fontSize: '0.8rem', background: '#f1f5f9', border: '1.5px solid #fff' }}>
            <Database size={14} style={{ color: 'var(--clay-success-text)' }} />
            <span style={{ color: '#475569', fontWeight: 700 }}>CockroachDB Active</span>
          </div>
          {session ? (
            <button className="clay-btn" style={{ background: '#fff', color: '#475569', boxShadow: 'var(--clay-card-shadow)', padding: '0.45rem 1rem' }} onClick={() => signOut()}>Sign Out</button>
          ) : (
            <button className="clay-btn clay-btn-primary" style={{ padding: '0.45rem 1rem' }} onClick={() => signIn('credentials', { callbackUrl: '/' })}>Sign In (admin/admin)</button>
          )}
        </div>
      </div>

      {/* LANDING */}
      {activeTab === 'landing' && (
        <div>
          <div className="hero-v2">
            <div className="hero-v2-left">
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ padding: '0.3rem 0.9rem', borderRadius: '20px', background: 'linear-gradient(135deg,#f8f0ff,#fce8f3)', border: '1.5px solid rgba(155,93,229,0.2)', fontSize: '0.75rem', fontWeight: 800, color: '#9b5de5', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
                  Autonomous Security
                </span>
              </div>
              <h1 className="hero-v2-title">Guard Your AI<br />Agent Pipelines with<br /><span className="highlight">Multimodel Triage</span></h1>
              <p className="hero-v2-subtitle">Heimdall AI audits every pull request, detects credential leaks, runs a live <strong>Round Robin debate</strong> between AI personas to crush false positives, and auto-generates code patches backed by CockroachDB vector memory.</p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' as const }}>
                <button className="clay-btn clay-btn-primary" onClick={() => setActiveTab('dashboard')}>Enter Audit Dashboard <ArrowRight size={18} /></button>
                <button className="clay-btn" style={{ background: '#fff', color: '#475569', boxShadow: 'var(--clay-card-shadow)' }} onClick={() => setActiveTab('registry')}>API Registry</button>
              </div>
              <div style={{ display: 'flex', gap: '2rem', marginTop: '2.25rem', flexWrap: 'wrap' as const }}>
                {[{ label: 'AI Agents', value: '4' }, { label: 'Services', value: '13 components' }, { label: 'False Positives', value: 'Round Robin' }].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#1e293b' }}>{s.value}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.2rem' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="hero-v2-right">
              <div className="falcon-aura" />
              {[{ size: 10, dur: '7s', delay: '0s' }, { size: 7, dur: '9s', delay: '2s' }, { size: 12, dur: '11s', delay: '4s' }, { size: 6, dur: '8s', delay: '1.5s' }].map((sp, i) => (
                <div key={i} className="falcon-sparkle" style={{ width: sp.size, height: sp.size, animationDuration: sp.dur, animationDelay: sp.delay }} />
              ))}
              <div className="falcon-container">
                <img src="/falcon.png" alt="Heimdall AI iridescent falcon guardian" className="falcon-img" />
              </div>
            </div>
          </div>

          <div className="bento-outer" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '1.25rem', marginBottom: '3rem', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {[
                { icon: <XCircle size={24} style={{ color: 'var(--clay-danger-text)' }} />, bg: 'var(--clay-danger)', title: 'Secrets & Credential Auditing', desc: 'Detects AWS keys, Slack webhooks and hardcoded DB strings. Regex cross-validated by AI.' },
                { icon: <Layers size={24} style={{ color: 'var(--clay-warning-text)' }} />, bg: 'var(--clay-warning)', title: 'Compliance RAG on CockroachDB', desc: 'pgvector cosine similarity against policy table. CORS, SQL injection & crypto rules in milliseconds.' },
                { icon: <Globe size={24} style={{ color: 'var(--clay-success-text)' }} />, bg: 'var(--clay-success)', title: 'API Registry & Health CRM', desc: 'Register APIs, score compliance (HTTPS, auth, CORS, rate limits). Go monitor probes endpoints every 30s.' },
              ].map(c => (
                <div key={c.title} className="clay-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem 1.5rem' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.icon}</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.3rem' }}>{c.title}</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>{c.desc}</div>
                  </div>
                </div>
              ))}
              <div className="clay-card" style={{ flex: 1, background: 'linear-gradient(135deg,#f8f0ff,#fce8f3)', border: '2px solid rgba(155,93,229,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#9b5de5', marginBottom: '0.35rem' }}>5 runtimes. 1 security platform.</div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' as const }}>
                    {['TypeScript', 'Python', 'Go', 'Java', 'Shell'].map(l => (
                      <span key={l} style={{ padding: '0.2rem 0.55rem', borderRadius: '8px', background: 'rgba(155,93,229,0.1)', fontSize: '0.72rem', fontWeight: 700, color: '#9b5de5', border: '1px solid rgba(155,93,229,0.2)' }}>{l}</span>
                    ))}
                  </div>
                </div>
                <button className="clay-btn clay-btn-primary" style={{ whiteSpace: 'nowrap' as const, flexShrink: 0, fontSize: '0.8rem', padding: '0.5rem 1rem' }} onClick={() => setActiveTab('about')}>How it works <ArrowRight size={14} /></button>
              </div>
            </div>
            <div className="rr-widget" key={rrKey} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}><span className="rr-arena-badge">Live Arena</span><div className="live-dot" /></div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>Round Robin AI Triage</span>
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.85rem' }}>PR #412 - SQL Injection Finding</div>
              <div className="rr-match-row auditor appear-1"><div className="rr-avatar" style={{ background: '#fdf2f2' }}>🔴</div><div className="rr-speech"><strong>Security Auditor</strong>Raw concat exposes injection vectors - must block.</div></div>
              <div className="rr-match-row developer appear-2"><div className="rr-avatar" style={{ background: '#ebf9f3' }}>🟢</div><div className="rr-speech"><strong>Practical Developer</strong>Internal microservice - trusted API inputs, low risk.</div></div>
              <div className="rr-match-row compliance appear-3"><div className="rr-avatar" style={{ background: '#ecf3fe' }}>🔵</div><div className="rr-speech"><strong>Compliance Officer</strong>Policy mandates parameterized queries - no exceptions.</div></div>
              <div style={{ flex: 1 }} />
              <div className="rr-winner-bar"><span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>Verdict:</span><span className="rr-winner-badge" style={{ background: '#fdf2f2', color: '#c93b3b' }}>True Positive</span><span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: 'auto' }}>Patch dispatched</span></div>
              <div className="rr-score-row">
                <div className="rr-score-chip">🔴 Auditor<br /><strong style={{ color: '#c93b3b' }}>2 wins</strong></div>
                <div className="rr-score-chip">🟢 Dev<br /><strong style={{ color: '#94a3b8' }}>0 wins</strong></div>
                <div className="rr-score-chip">🔵 Compliance<br /><strong style={{ color: '#2f69d3' }}>1 win</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD */}
      {activeTab === 'dashboard' && (!session ? <div style={{ textAlign: 'center', padding: '4rem' }}><Shield size={48} style={{ color: '#cbd5e1', margin: '0 auto 1rem' }} /><h3>Access Denied</h3><p style={{ color: '#64748b' }}>Please sign in to view the Audit Dashboard.</p></div> :
        <div>
          <div className="dashboard-title-bar">
            <div><h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b' }}>Security Workspaces</h2><p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Monitor pull request validations and inspect agent audit logs.</p></div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="text" placeholder="https://github.com/owner/repo/pull/123" value={prUrl} onChange={e => setPrUrl(e.target.value)} style={{ padding: '0.6rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', width: '300px', outline: 'none' }} />
              <button className="clay-btn clay-btn-primary" onClick={handleTriggerScan} disabled={scanning || !prUrl}><Play size={16} />{scanning ? 'Scanning...' : 'Scan GitHub PR'}</button>
            </div>
          </div>
          <div className="metrics-grid">
            <div className="metric-card clay-card"><span className="metric-title">PRs Scanned</span><span className="metric-value">{totalAudited}</span></div>
            <div className="metric-card clay-card" style={{ borderLeft: '5px solid var(--clay-danger-text)' }}><span className="metric-title">Critical Alerts</span><span className="metric-value" style={{ color: 'var(--clay-danger-text)' }}>{failedAudits}</span></div>
            <div className="metric-card clay-card" style={{ borderLeft: '5px solid var(--clay-success-text)' }}><span className="metric-title">Checks Passed</span><span className="metric-value" style={{ color: 'var(--clay-success-text)' }}>{passedAudits}</span></div>
            <div className="metric-card clay-card"><span className="metric-title">Orchestrators</span><span className="metric-value" style={{ color: 'var(--clay-primary-text)' }}>3 Active</span></div>
          </div>
          <div className="dashboard-workspace">
            <div className="panel-card clay-card">
              <div className="panel-header"><span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><GitPullRequest size={20} />PR Audit Logs</span><button onClick={fetchPrs} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} disabled={loadingPrs}><RefreshCw size={16} className={loadingPrs ? 'animate-spin' : ''} /></button></div>
              {loadingPrs ? (<div className="empty-state"><RefreshCw size={32} style={{ animation: 'spin 1s linear infinite' }} /><p style={{ marginTop: '1rem' }}>Loading...</p></div>)
                : prs.length === 0 ? (<div className="empty-state"><Shield size={48} style={{ color: '#cbd5e1' }} /><p>No PRs yet. Click Trigger Simulation.</p></div>)
                  : (<div className="pr-list">{prs.map(pr => (<div key={pr.id} className={`pr-item ${selectedPr?.id === pr.id ? 'active' : ''}`} onClick={() => setSelectedPr(pr)}><div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}><div className="pr-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pr.title}</div><div className="pr-meta"><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><User size={12} />{pr.author}</span><span>•</span><span>#{pr.pr_number}</span><span>•</span><span>{pr.repo_name}</span></div></div><div>{getStatusBadge(pr.status)}</div></div>))}</div>)}
            </div>
            <div className="panel-card clay-card">
              <div className="panel-header"><span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Terminal size={20} />Agent Execution Audit</span>{selectedPr && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {(selectedPr.id || selectedPr.prId || '').substring(0, 8)}</span>}</div>
              {!selectedPr ? (<div className="empty-state"><FileText size={48} style={{ color: '#cbd5e1' }} /><p>Select a PR to view audits.</p></div>)
                : loadingLogs ? (<div className="empty-state"><RefreshCw size={32} style={{ animation: 'spin 1s linear infinite' }} /><p style={{ marginTop: '1rem' }}>Loading...</p></div>)
                  : (<div><div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '18px', border: '1.5px solid #fff' }}><h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.25rem' }}>{selectedPr.title}</h3><div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}><span>Author: <strong>{selectedPr.author}</strong></span><span>Repo: <strong>{selectedPr.repo_name}</strong></span></div></div><div className="logs-container">{logs.length === 0 ? (<p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No logs.</p>) : logs.map(log => { const sc = log.status === 'Success' ? 'success' : log.status === 'Warning' ? 'warning' : 'failure'; return (<div key={log.id} className={`log-entry ${sc}`}><div className="log-header"><span className="log-agent">{log.agent_name} Report</span><span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 800 }}>{getStatusIcon(log.status)}{log.status.toUpperCase()}</span></div><pre className="log-body">{log.log_message}</pre></div>); })}</div></div>)}
            </div>
          </div>
        </div>
      )}

      {/* API REGISTRY */}
      {activeTab === 'registry' && (!session ? <div style={{ textAlign: 'center', padding: '4rem' }}><Shield size={48} style={{ color: '#cbd5e1', margin: '0 auto 1rem' }} /><h3>Access Denied</h3><p style={{ color: '#64748b' }}>Please sign in to view the API Registry.</p></div> :
        <div>
          <div className="dashboard-title-bar">
            <div><h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b' }}>API Registry</h2><p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>CRM for your API portfolio. Track ownership, compliance scores, and security posture.</p></div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="clay-btn" style={{ background: '#fff', color: '#475569', boxShadow: 'var(--clay-card-shadow)' }} onClick={fetchApis} disabled={loadingApis}><RefreshCw size={16} className={loadingApis ? 'animate-spin' : ''} />Refresh</button>
              <button className="clay-btn clay-btn-primary" onClick={() => setShowRegisterForm(true)}><Plus size={16} />Register API</button>
            </div>
          </div>
          {apiStats && (<div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="metric-card clay-card"><span className="metric-title">Total APIs</span><span className="metric-value">{apiStats.total_apis}</span></div>
            <div className="metric-card clay-card" style={{ borderLeft: '5px solid #c93b3b' }}><span className="metric-title">High Risk</span><span className="metric-value" style={{ color: '#c93b3b' }}>{apiStats.high_risk}</span></div>
            <div className="metric-card clay-card" style={{ borderLeft: '5px solid #c07d17' }}><span className="metric-title">Medium Risk</span><span className="metric-value" style={{ color: '#c07d17' }}>{apiStats.medium_risk}</span></div>
            <div className="metric-card clay-card" style={{ borderLeft: '5px solid #1d885d' }}><span className="metric-title">Avg Score</span><span className="metric-value" style={{ color: '#1d885d' }}>{apiStats.avg_compliance_score}%</span></div>
          </div>)}
          {showRegisterForm && (
            <div className="clay-card" style={{ marginBottom: '1.5rem', padding: '1.75rem', background: 'linear-gradient(145deg,#fff,#f8f0ff)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>Register New API</h3>
                <button onClick={() => setShowRegisterForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.2rem' }}>x</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[{ label: 'API Name', key: 'name', ph: 'User Auth API' }, { label: 'Endpoint URL', key: 'url', ph: 'https://api.myapp.com/v1' }, { label: 'Owner', key: 'owner', ph: 'platform-team' }, { label: 'Team', key: 'team', ph: 'infra' }, { label: 'Rate Limit', key: 'rate_limit', ph: '1000/min' }, { label: 'CORS Origin', key: 'cors_origin', ph: 'https://myapp.com' }].map(f => (
                  <div key={f.key}><label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>{f.label}</label><input value={(newApi as any)[f.key]} onChange={e => setNewApi(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.ph} style={{ width: '100%', padding: '0.6rem 0.9rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', background: '#fff', boxSizing: 'border-box' as const }} /></div>
                ))}
                <div><label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>Auth Type</label><select value={newApi.auth_type} onChange={e => setNewApi(prev => ({ ...prev, auth_type: e.target.value }))} style={{ width: '100%', padding: '0.6rem 0.9rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.85rem', background: '#fff' }}><option value="bearer">Bearer Token</option><option value="api_key">API Key</option><option value="oauth2">OAuth 2.0</option><option value="basic">Basic Auth</option><option value="none">None</option></select></div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
                <button className="clay-btn" style={{ background: '#fff', color: '#475569', boxShadow: 'var(--clay-card-shadow)' }} onClick={() => setShowRegisterForm(false)}>Cancel</button>
                <button className="clay-btn clay-btn-primary" onClick={handleRegisterApi}><CheckCircle2 size={16} />Register and Scan</button>
              </div>
            </div>
          )}
          <div className="dashboard-workspace">
            <div className="panel-card clay-card">
              <div className="panel-header"><span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Globe size={20} />Registered APIs</span><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{apis.length} total</span></div>
              {loadingApis ? (<div className="empty-state"><RefreshCw size={32} style={{ animation: 'spin 1s linear infinite' }} /><p style={{ marginTop: '1rem' }}>Loading API registry...</p></div>)
                : apis.length === 0 ? (<div className="empty-state"><Globe size={48} style={{ color: '#cbd5e1' }} /><p>No APIs registered yet.</p></div>)
                  : (<div className="pr-list">{apis.map(api => (<div key={api.id} className={`pr-item ${selectedApi?.id === api.id ? 'active' : ''}`} onClick={() => setSelectedApi(api)}><div style={{ flex: 1, minWidth: 0, paddingRight: '0.75rem' }}><div className="pr-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{api.name}</div><div className="pr-meta" style={{ marginTop: '0.2rem' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Lock size={11} />{api.auth_type}</span><span>•</span><span>{api.environment}</span>{api.team && <><span>•</span><span>{api.team}</span></>}</div></div><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0 }}><span style={{ padding: '0.2rem 0.6rem', borderRadius: '10px', background: riskBg(api.risk_level), color: riskColor(api.risk_level), fontSize: '0.72rem', fontWeight: 800 }}>{api.risk_level} Risk</span><span style={{ fontSize: '0.75rem', fontWeight: 700, color: riskColor(api.risk_level) }}>{api.compliance_score}%</span></div></div>))}</div>)}
            </div>
            <div className="panel-card clay-card">
              <div className="panel-header"><span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Activity size={20} />API Security Detail</span></div>
              {!selectedApi ? (<div className="empty-state"><Globe size={48} style={{ color: '#cbd5e1' }} /><p>Select an API to view its security posture.</p></div>)
                : (<div>
                  <div style={{ marginBottom: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '18px', border: '1.5px solid #fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div><h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{selectedApi.name}</h3><div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem', wordBreak: 'break-all' as const }}>{selectedApi.url}</div></div>
                      <span style={{ padding: '0.3rem 0.75rem', borderRadius: '12px', background: riskBg(selectedApi.risk_level), color: riskColor(selectedApi.risk_level), fontWeight: 800, fontSize: '0.8rem', flexShrink: 0, marginLeft: '0.75rem' }}>{selectedApi.risk_level} Risk</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {selectedApi.owner && <span>Owner: <strong>{selectedApi.owner}</strong></span>}
                      {selectedApi.team && <span>Team: <strong>{selectedApi.team}</strong></span>}
                      <span>Auth: <strong>{selectedApi.auth_type}</strong></span>
                    </div>
                  </div>
                  <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '14px', background: 'linear-gradient(135deg,#f8f0ff,#fce8f3)', border: '1.5px solid rgba(155,93,229,0.15)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b' }}>Compliance Score</span>
                      <span style={{ fontWeight: 900, fontSize: '1.2rem', color: riskColor(selectedApi.risk_level) }}>{selectedApi.compliance_score}%</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', background: '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${selectedApi.compliance_score}%`, background: selectedApi.compliance_score >= 80 ? 'linear-gradient(90deg,#1d885d,#22c55e)' : selectedApi.compliance_score >= 50 ? 'linear-gradient(90deg,#c07d17,#f59e0b)' : 'linear-gradient(90deg,#c93b3b,#ef4444)', borderRadius: '4px', transition: 'width 1s ease' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div><div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d885d', marginBottom: '0.4rem' }}>Passed ({selectedApi.checks_passed.length})</div>{selectedApi.checks_passed.map(c => <div key={c} style={{ fontSize: '0.78rem', color: '#475569', padding: '0.25rem 0', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle2 size={11} style={{ color: '#1d885d', flexShrink: 0 }} />{c}</div>)}</div>
                    <div><div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#c93b3b', marginBottom: '0.4rem' }}>Failed ({selectedApi.checks_failed.length})</div>{selectedApi.checks_failed.map(c => <div key={c} style={{ fontSize: '0.78rem', color: '#475569', padding: '0.25rem 0', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><XCircle size={11} style={{ color: '#c93b3b', flexShrink: 0 }} />{c}</div>)}</div>
                  </div>
                </div>)}
            </div>
          </div>
        </div>
      )}

      {/* HOW IT WORKS */}
      {activeTab === 'about' && (
        <div>
          <div className="clay-card" style={{ padding: '2.5rem', marginBottom: '2rem', background: 'linear-gradient(135deg,#f8f0ff,#fce8f3 50%,#ecf3fe)', border: '2px solid rgba(155,93,229,0.15)' }}>
            <span style={{ padding: '0.3rem 0.9rem', borderRadius: '20px', background: 'rgba(155,93,229,0.15)', color: '#9b5de5', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>What makes Heimdall AI special</span>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 900, color: '#1e293b', margin: '1rem 0 1.25rem', lineHeight: 1.2 }}>Not just another scanner.<br /><span style={{ background: 'linear-gradient(135deg,#e8468a,#9b5de5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>A thinking security layer.</span></h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
              {[
                { icon: '🧠', title: 'Multimodel Consensus', desc: 'Three AI personas debate every finding. No single model decides eliminating false positives that waste engineer time.' },
                { icon: '🗄️', title: 'Persistent Vector Memory', desc: 'CockroachDB stores embeddings + logs across regions. Agents resume and correlate findings even after crashes.' },
                { icon: '🌐', title: 'API Security CRM', desc: 'First security tool with a built-in API Registry. Track every endpoint, score compliance, catch regressions before they ship.' },
                { icon: '🔷', title: 'Polyglot by Design', desc: 'Python for AI, Go for speed, Java for AST, Shell for git hooks. Each service in the right language for its job.' },
              ].map(item => (
                <div key={item.title} style={{ padding: '1.25rem', borderRadius: '16px', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', border: '1.5px solid rgba(255,255,255,0.8)' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{item.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b', marginBottom: '0.4rem' }}>{item.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="clay-card" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1e293b', marginBottom: '0.5rem' }}>The Heimdall AI Pipeline</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>Every PR travels through a 7-stage autonomous audit in under 30 seconds.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '0.75rem' }}>
              {[
                { step: '01', icon: '📥', label: 'PR Webhook', desc: 'GitHub sends HMAC-signed payload to /api/scan', color: '#ecf3fe', border: '#2f69d3' },
                { step: '02', icon: '🔍', label: 'Secret Scan', desc: 'Regex finds API keys, tokens and connection strings', color: '#fdf2f2', border: '#c93b3b' },
                { step: '03', icon: '🧬', label: 'Vector Embed', desc: 'Python calls Titan Embeddings, cosine query on CockroachDB', color: '#fef8eb', border: '#c07d17' },
                { step: '04', icon: '📋', label: 'Compliance', desc: '5 policy rules checked via pgvector similarity', color: '#f8f0ff', border: '#9b5de5' },
                { step: '05', icon: '⚔️', label: 'Round Robin', desc: '3 AI personas debate: Auditor vs Dev vs Compliance', color: '#fce8f3', border: '#e8468a' },
                { step: '06', icon: '🛠️', label: 'Remediation', desc: 'If True Positive: Claude generates git diff patch', color: '#ebf9f3', border: '#1d885d' },
                { step: '07', icon: '💾', label: 'Persist', desc: 'All results and embeddings stored in CockroachDB', color: '#f0fdf4', border: '#16a34a' },
              ].map(s => (
                <div key={s.step} style={{ padding: '1.1rem 0.85rem', borderRadius: '14px', background: s.color, border: `2px solid ${s.border}33`, boxSizing: 'border-box' as const }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 900, color: s.border, letterSpacing: '0.05em', marginBottom: '0.35rem' }}>STEP {s.step}</div>
                  <div style={{ fontSize: '1.4rem', marginBottom: '0.35rem' }}>{s.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#1e293b', marginBottom: '0.25rem' }}>{s.label}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="clay-card" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1e293b', marginBottom: '0.5rem' }}>The API Security CRM Pipeline</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>A unified inventory and dynamic health monitor for your entire API portfolio.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '1rem' }}>
              {[
                { step: '01', icon: '📝', label: 'Registration', desc: 'Developers register API endpoints and metadata via the CRM interface.', color: '#f8f0ff', border: '#9b5de5' },
                { step: '02', icon: '🧮', label: 'Compliance Scoring', desc: 'Python service calculates an overall security posture score based on Auth, CORS, and limits.', color: '#ecf3fe', border: '#2f69d3' },
                { step: '03', icon: '🎯', label: 'DAST Fuzzing', desc: 'Go monitor proactively tests endpoints every 30s with SQL injection payloads.', color: '#fdf2f2', border: '#c93b3b' },
                { step: '04', icon: '📊', label: 'Live Posture', desc: 'CockroachDB syncs realtime stats back to the dashboard, flagging vulnerable endpoints.', color: '#f0fdf4', border: '#16a34a' },
              ].map(s => (
                <div key={s.step} style={{ padding: '1.25rem', borderRadius: '14px', background: s.color, border: `2px solid ${s.border}33`, boxSizing: 'border-box' as const }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 900, color: s.border, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>STEP {s.step}</div>
                  <div style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>{s.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b', marginBottom: '0.35rem' }}>{s.label}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="clay-card" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1e293b', marginBottom: '0.5rem' }}>Service Architecture 13 Components</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>Each language chosen for what it does best. No single-runtime lock-in.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '1.25rem' }}>
              {[
                { lang: 'TypeScript', color: '#3178c6', bg: '#eff6ff', icon: '🔷', count: 7, services: ['Orchestrator master pipeline', 'SecretScanner regex + entropy', 'ComplianceAgent RAG query runner', 'RemediationAgent Bedrock patcher', 'RoundRobinValidator debate engine', 'Validator AST syntax checker', 'Embeddings client Python IPC'] },
                { lang: 'Python (Flask)', color: '#f59e0b', bg: '#fffbeb', icon: '🐍', count: 2, services: ['Embeddings API :5001 Titan via Bedrock', 'API Registry CRM :5002 CRUD, compliance scoring, ownership tracking, scan history'] },
                { lang: 'Go', color: '#00add8', bg: '#f0fdff', icon: '🦅', count: 2, services: ['DB Queue Worker CockroachDB Pending PRs at high concurrency', 'API Health Monitor :5003 probes endpoints, checks HTTPS/HSTS/XFrame headers every 30s'] },
                { lang: 'Java', color: '#e76f00', bg: '#fff7ed', icon: '☕', count: 1, services: ['ASTParser class-level compliance: raw SQL concat, wildcard CORS, MD5/SHA1 detection'] },
                { lang: 'Shell', color: '#334155', bg: '#f8fafc', icon: '💻', count: 1, services: ['pre-commit.sh git hook that blocks unsafe staged commits before push'] },
              ].map(r => (
                <div key={r.lang} style={{ borderRadius: '20px', border: `2px solid ${r.color}22`, background: r.bg, padding: '1.25rem', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>{r.icon}</span>
                    <span style={{ fontWeight: 900, fontSize: '0.9rem', color: r.color }}>{r.lang}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, color: r.color, background: `${r.color}18`, padding: '0.15rem 0.5rem', borderRadius: '8px' }}>{r.count} svc</span>
                  </div>
                  {r.services.map((s, i) => (<div key={i} style={{ fontSize: '0.78rem', color: '#475569', padding: '0.3rem 0', borderBottom: '1px solid rgba(0,0,0,0.04)', lineHeight: 1.5, display: 'flex', gap: '0.4rem' }}><span style={{ color: r.color, flexShrink: 0 }}>›</span>{s}</div>))}
                </div>
              ))}
            </div>
          </div>

          <div className="clay-card" style={{ padding: '2.5rem', marginBottom: '2rem', background: 'linear-gradient(135deg,#1e293b,#334155)', color: '#fff' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', marginBottom: '0.5rem' }}>Round Robin Debate Engine</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>The first ML-powered false-positive triage system for code security findings.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { p: '🔴 Security Auditor', r: 'Always suspicious. Defaults to flagging.', b: 'rgba(201,59,59,0.2)', bd: 'rgba(201,59,59,0.3)' },
                { p: '🟢 Practical Developer', r: 'Context-aware. Considers code intent.', b: 'rgba(29,136,93,0.2)', bd: 'rgba(29,136,93,0.3)' },
                { p: '🔵 Compliance Officer', r: 'Policy-driven. Checks rules literally.', b: 'rgba(47,105,211,0.2)', bd: 'rgba(47,105,211,0.3)' },
              ].map(item => (<div key={item.p} style={{ padding: '1.1rem', borderRadius: '14px', background: item.b, border: `1.5px solid ${item.bd}` }}><div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff', marginBottom: '0.35rem' }}>{item.p}</div><div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{item.r}</div></div>))}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.8 }}><strong style={{ color: '#fff' }}>How voting works: </strong>3 matchups run in sequence. Each produces a winner by argument scoring. Auditor wins 2+ = <strong style={{ color: '#f87171' }}>True Positive</strong>, remediation dispatched. Developer or Compliance wins majority = <strong style={{ color: '#4ade80' }}>False Positive (Exempted)</strong>, PR auto-approved.</div>
          </div>

          <div className="about-grid">
            <div className="about-card clay-card">
              <h2>CockroachDB Setup</h2>
              <ol style={{ marginLeft: '1.25rem', marginTop: '0.75rem', lineHeight: 2, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <li>Create a free cluster at <strong>cockroachlabs.cloud</strong></li>
                <li>Copy the connection string (postgresql://...)</li>
                <li>Paste into <code style={{ background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>.env</code> as DATABASE_URL</li>
                <li>Run <code style={{ background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>npm run db:setup</code></li>
              </ol>
              <div style={{ marginTop: '1.5rem' }}>
                <div className="about-tech-tag"><Database size={16} />CockroachDB Serverless</div>
                <div className="about-tech-tag"><Terminal size={16} />pgvector native</div>
              </div>
            </div>
            <div className="about-card clay-card">
              <h2>Quick Start</h2>
              <div style={{ marginTop: '0.75rem', background: '#1e293b', borderRadius: '12px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.82rem', color: '#e2e8f0', lineHeight: 1.8 }}>
                <span style={{ color: '#94a3b8' }}># All services</span><br />
                <span style={{ color: '#4ade80' }}>$</span> npm run dev:all<br /><br />
                <span style={{ color: '#94a3b8' }}># Database setup</span><br />
                <span style={{ color: '#4ade80' }}>$</span> npm run db:setup<br /><br />
                <span style={{ color: '#94a3b8' }}># API Registry (port 5002)</span><br />
                <span style={{ color: '#4ade80' }}>$</span> python services/python/api_registry.py<br /><br />
                <span style={{ color: '#94a3b8' }}># Health Monitor (port 5003)</span><br />
                <span style={{ color: '#4ade80' }}>$</span> go run services/go/monitor/main.go
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        .hide-mobile { display: flex; }
        @media (max-width: 768px) { .hide-mobile { display: none !important; } }
        @media (max-width: 900px) { .bento-outer { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
