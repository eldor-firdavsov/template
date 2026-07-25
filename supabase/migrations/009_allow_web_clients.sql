-- Migration 009: Make telegram_user_id optional for web clients
ALTER TABLE clients ALTER COLUMN telegram_user_id DROP NOT NULL;
