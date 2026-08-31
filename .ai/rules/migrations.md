---
paths:
  - 'database/migrations/**'
---

# Migrations

## WAL replays over the seeded.sqlite copy and empties the database
0001_01_01_000000_initialize_database seeds the question bank by copying database/seeded.sqlite over the file `migrate` just created. Under WAL the -wal left by the connection that made the migrations table is replayed on the next open, restoring the empty database over the copy; every later migration then fails with "no such table: test_results". The migration now issues `PRAGMA journal_mode = DELETE` and unlinks -wal/-shm before copying. Do not remove that. The web build sets DB_JOURNAL_MODE=WAL, so this path is live in production. Covered by tests/Feature/SeededDatabaseInitialisationTest.php, which fails without the fix.
