-- Defense in depth for invariants #9 (committed decisions are immutable)
-- and append-only audit events. The application never issues UPDATE or
-- DELETE on these tables; these triggers make an accidental one fail loudly.
--
-- This is NOT tamper-proofing: a database administrator can drop triggers.
-- It protects against application bugs, not against a malicious DBA.

CREATE TRIGGER trg_decisions_no_update BEFORE UPDATE ON decisions FOR EACH ROW
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'decisions are immutable after commit';

CREATE TRIGGER trg_decisions_no_delete BEFORE DELETE ON decisions FOR EACH ROW
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'decisions are immutable after commit';

CREATE TRIGGER trg_audit_events_no_update BEFORE UPDATE ON audit_events FOR EACH ROW
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_events is append-only';

CREATE TRIGGER trg_audit_events_no_delete BEFORE DELETE ON audit_events FOR EACH ROW
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_events is append-only';
