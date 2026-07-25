-- Migration 007: Add phone column to barbers
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS phone text;
