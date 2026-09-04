-- Runs once, only on a fresh volume (postgres_data), via Postgres's
-- docker-entrypoint-initdb.d convention. On an existing volume (e.g. this
-- repo's dev DB), the 101ai database was created manually instead — see
-- MILESTONES.md / 101ai notes.
CREATE DATABASE tonberry_101ai;
