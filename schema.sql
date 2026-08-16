-- Schema for Heimdall AI with Vector Search support

-- Enable pgvector extension (if available)
CREATE EXTENSION IF NOT EXISTS vector;

-- Table: prs
CREATE TABLE IF NOT EXISTS prs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_number INT,
    repo_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Passed', 'Failed'
    author VARCHAR(100),
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id UUID REFERENCES prs(id) ON DELETE CASCADE,
    agent_name VARCHAR(100) NOT NULL, -- 'SecretScanner', 'ComplianceAuditor', 'RemediationAgent'
    status VARCHAR(50) NOT NULL, -- 'Success', 'Warning', 'Failure'
    log_message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'Info', -- 'Info', 'Low', 'Medium', 'High', 'Critical'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: vector_policies (storing policies + embedding vector)
CREATE TABLE IF NOT EXISTS vector_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    policy_description TEXT NOT NULL,
    keywords VARCHAR(255),
    embedding VECTOR(1536), -- 1536-dimensional vector for Titan Embeddings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: exemptions
CREATE TABLE IF NOT EXISTS exemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id UUID REFERENCES prs(id) ON DELETE CASCADE,
    filepath VARCHAR(255) NOT NULL,
    overridden_by VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Compliance Policies
INSERT INTO vector_policies (rule_name, category, policy_description, keywords) VALUES
('no_secrets', 'Credentials', 'Do not hardcode secrets, API keys, passwords, database URLs, auth tokens, AWS keys, or private SSH keys in the source code. Use environment variables.', 'secret password token key credential connection string')
ON CONFLICT (rule_name) DO UPDATE SET policy_description = EXCLUDED.policy_description;

INSERT INTO vector_policies (rule_name, category, policy_description, keywords) VALUES
('no_sql_injection', 'Database Security', 'Avoid SQL query construction using string concatenation. Always use parameterized queries or query placeholders to prevent SQL injection vulnerabilities.', 'sql database query injection concatenate parameter placeholder pg postgres')
ON CONFLICT (rule_name) DO UPDATE SET policy_description = EXCLUDED.policy_description;

INSERT INTO vector_policies (rule_name, category, policy_description, keywords) VALUES
('secure_cors', 'Network Security', 'Avoid setting Access-Control-Allow-Origin headers to wildcard "*" in production configurations. Restrict origins to trusted domains.', 'cors access control allow origin wildcard network headers')
ON CONFLICT (rule_name) DO UPDATE SET policy_description = EXCLUDED.policy_description;

INSERT INTO vector_policies (rule_name, category, policy_description, keywords) VALUES
('no_deprecated_crypto', 'Cryptography', 'Do not use deprecated or insecure hashing algorithms such as MD5 or SHA1 for passwords, digital signatures, or sensitive cryptography. Use bcrypt, argon2, or SHA256/SHA512.', 'md5 sha1 crypto password hash md5 bcrypt argon2 signature')
ON CONFLICT (rule_name) DO UPDATE SET policy_description = EXCLUDED.policy_description;

INSERT INTO vector_policies (rule_name, category, policy_description, keywords) VALUES
('least_privilege', 'Authorization', 'Do not grant broad DB admin privileges to application connection roles. DB users must only have read/write permissions on specific tables required for their function.', 'rbac postgres admin privileges permission user role db grant')
ON CONFLICT (rule_name) DO UPDATE SET policy_description = EXCLUDED.policy_description;
