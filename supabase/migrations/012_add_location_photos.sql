-- Migration 012: Add photos array column to locations table for up to 3 barbershop images
alter table locations add column if not exists photos text[];
