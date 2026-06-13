-- Add last_tracked column to loads table for rotation sync tracking
ALTER TABLE loads ADD COLUMN IF NOT EXISTS last_tracked timestamptz;
