-- EE2 (F10): unit specs — finishing, areas, view, orientation.
CREATE TYPE "UnitFinishing" AS ENUM ('CORE_AND_SHELL', 'SEMI_FINISHED', 'FULLY_FINISHED', 'FURNISHED');
CREATE TYPE "UnitView" AS ENUM ('GARDEN', 'POOL', 'LAGOON', 'SEA', 'NILE', 'CLUB', 'LANDSCAPE', 'MAIN_STREET', 'SIDE_STREET');
CREATE TYPE "UnitOrientation" AS ENUM ('NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTH_EAST', 'NORTH_WEST', 'SOUTH_EAST', 'SOUTH_WEST');

ALTER TABLE "Unit"
  ADD COLUMN "netArea" DOUBLE PRECISION,
  ADD COLUMN "gardenArea" DOUBLE PRECISION,
  ADD COLUMN "roofArea" DOUBLE PRECISION,
  ADD COLUMN "terraceArea" DOUBLE PRECISION,
  ADD COLUMN "landArea" DOUBLE PRECISION,
  ADD COLUMN "finishing" "UnitFinishing",
  ADD COLUMN "view" "UnitView",
  ADD COLUMN "orientation" "UnitOrientation";
