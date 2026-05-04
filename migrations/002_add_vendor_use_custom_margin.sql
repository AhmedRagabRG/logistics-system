-- Migration: Add use_custom_margin to vendors table
ALTER TABLE vendors ADD COLUMN use_custom_margin BOOLEAN NOT NULL DEFAULT FALSE AFTER priority_ranking;
