// Command migrate initializes a fresh AegisCommerce database safely.
// It is intentionally dependency-free so Render can run it before the API starts.
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

const migrationVersion = "000001_init_schema"

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		fatal(fmt.Errorf("DATABASE_URL is required"))
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		fatal(fmt.Errorf("connect to database: %w", err))
	}
	defer pool.Close()

	if _, err = pool.Exec(ctx, "SELECT pg_advisory_lock(424242)"); err != nil {
		fatal(fmt.Errorf("acquire migration lock: %w", err))
	}
	defer pool.Exec(ctx, "SELECT pg_advisory_unlock(424242)")

	if _, err = pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		fatal(fmt.Errorf("create migration registry: %w", err))
	}

	var alreadyApplied bool
	if err = pool.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)", migrationVersion).Scan(&alreadyApplied); err != nil {
		fatal(fmt.Errorf("check migration registry: %w", err))
	}

	if !alreadyApplied {
		migration, err := os.ReadFile("migrations/000001_init_schema.up.sql")
		if err != nil {
			fatal(fmt.Errorf("read schema migration: %w", err))
		}
		if _, err = pool.Exec(ctx, string(migration)); err != nil {
			fatal(fmt.Errorf("apply schema migration: %w", err))
		}
		if _, err = pool.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", migrationVersion); err != nil {
			fatal(fmt.Errorf("record schema migration: %w", err))
		}
		fmt.Println("Applied database schema.")
	}

	seed, err := os.ReadFile("scripts/seeds.sql")
	if err != nil {
		fatal(fmt.Errorf("read seed data: %w", err))
	}
	if _, err = pool.Exec(ctx, string(seed)); err != nil {
		fatal(fmt.Errorf("seed database: %w", err))
	}
	fmt.Println("Database is ready.")
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
