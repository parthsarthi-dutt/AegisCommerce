package domain

import "context"

// GatewayOrder represents an order created in the external payment gateway (Razorpay).
type GatewayOrder struct {
	ID       string
	Entity   string
	Amount   int64
	Currency string
	Status   string
	Receipt  string
}

// PaymentGateway defines the contract for communicating with Razorpay.
type PaymentGateway interface {
	CreateOrder(ctx context.Context, amountPaise int64, currency string, receiptID string) (*GatewayOrder, error)
}