ALTER TABLE admins
    ADD COLUMN mfa_secret_encrypted TEXT NULL AFTER password_hash,
    ADD COLUMN mfa_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER mfa_secret_encrypted,
    ADD COLUMN mfa_recovery_codes_json JSON NULL AFTER mfa_enabled,
    ADD COLUMN password_changed_at DATETIME(3) NULL AFTER last_login_at;

ALTER TABLE admin_sessions
    ADD COLUMN public_id CHAR(36) NULL AFTER id,
    ADD COLUMN ip_hash CHAR(64) NULL AFTER token_hash,
    ADD COLUMN user_agent VARCHAR(240) NULL AFTER ip_hash;

UPDATE admin_sessions SET public_id = UUID() WHERE public_id IS NULL;

ALTER TABLE admin_sessions
    MODIFY COLUMN public_id CHAR(36) NOT NULL,
    ADD UNIQUE KEY uq_admin_sessions_public_id (public_id);

CREATE TABLE IF NOT EXISTS admin_mfa_challenges (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    admin_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    remember_session TINYINT(1) NOT NULL DEFAULT 0,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    expires_at DATETIME(3) NOT NULL,
    consumed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_admin_mfa_challenges_token (token_hash),
    KEY idx_admin_mfa_challenges_admin (admin_id, expires_at),
    CONSTRAINT fk_admin_mfa_challenges_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    admin_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    consumed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_password_reset_tokens_token (token_hash),
    KEY idx_password_reset_tokens_admin (admin_id, expires_at),
    CONSTRAINT fk_password_reset_tokens_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_type VARCHAR(80) NOT NULL,
    outcome ENUM('success', 'failure', 'blocked', 'info') NOT NULL DEFAULT 'info',
    admin_id BIGINT UNSIGNED NULL,
    subject_hash CHAR(64) NULL,
    ip_hash CHAR(64) NULL,
    user_agent_hash CHAR(64) NULL,
    request_id CHAR(36) NULL,
    details_json JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_security_events_type_created (event_type, created_at),
    KEY idx_security_events_admin_created (admin_id, created_at),
    KEY idx_security_events_outcome_created (outcome, created_at),
    CONSTRAINT fk_security_events_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

