-- Enable PostGIS spatial extension.
-- This is required for geometry/geography column types, spatial indexes, and spatial queries.
CREATE EXTENSION IF NOT EXISTS postgis;
