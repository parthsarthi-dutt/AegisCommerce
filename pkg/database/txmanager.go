package database

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// unexported key type prevents collisions with other context keys
type txKey struct{}

// DB represents the common interface for both pgxpool.Pool and pgx.Tx.
// Repositories use this interface so they don't care if they are in a Tx or not.
type DB interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// TransactionManager handles context-based database transactions.
type TransactionManager struct {
	pool   *pgxpool.Pool
	logger *slog.Logger
}

func NewTransactionManager(pool *pgxpool.Pool, logger *slog.Logger) *TransactionManager {
	return &TransactionManager{
		pool:   pool,
		logger: logger,
	}
}

// GetDB returns the transaction from context if it exists, otherwise returns the pool.
// Repositories must call this at the start of every DB method.
func (tm *TransactionManager) GetDB(ctx context.Context) DB {
	if tx, ok := ctx.Value(txKey{}).(pgx.Tx); ok {
		return tx
	}
	return tm.pool
}

// WithTx executes the given function within a database transaction.
func (tm *TransactionManager) WithTx(ctx context.Context, fn func(ctx context.Context) error) error {
	// If already in a transaction, just execute the function (nested call support)
	if _, ok := ctx.Value(txKey{}).(pgx.Tx); ok {
		return fn(ctx)
	}

	tx, err := tm.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Inject transaction into a derived context
	txCtx := context.WithValue(ctx, txKey{}, tx)

	defer func() {
		// Recover from panics to ensure rollback happens, then re-panic
		if p := recover(); p != nil {
			_ = tx.Rollback(ctx)
			panic(p)
		}
	}()

	if err := fn(txCtx); err != nil {
		if rbErr := tx.Rollback(ctx); rbErr != nil {
			tm.logger.Error("transaction rollback failed", "error", rbErr, "original_error", err)
		}
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
