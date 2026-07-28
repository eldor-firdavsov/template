-- Migration 011: Add location coordinates for Google Maps mapping
alter table locations add column if not exists latitude numeric;
alter table locations add column if not exists longitude numeric;
