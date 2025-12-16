-- Add performance methodology field to structures table
-- This migration adds the methodology used for performance calculation and measurement

-- Add performance methodology field
ALTER TABLE structures
ADD COLUMN IF NOT EXISTS performance_methodology VARCHAR(255);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_structures_performance_methodology ON structures(performance_methodology);

-- Add comment to document the schema
COMMENT ON COLUMN structures.performance_methodology IS 'Methodology used for performance calculation and measurement';
