-- Migration 001: add owner_clerk_id to courses table
-- Safe to run multiple times (checks for column existence first).
-- Run manually against any existing database before deploying the
-- instructor-isolation changes introduced in task #78.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'courses'
          AND column_name = 'owner_clerk_id'
    ) THEN
        ALTER TABLE courses ADD COLUMN owner_clerk_id TEXT;
        RAISE NOTICE 'Added owner_clerk_id column to courses';
    ELSE
        RAISE NOTICE 'owner_clerk_id already exists on courses — skipping';
    END IF;
END;
$$;
