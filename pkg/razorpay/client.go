package razorpay

import (
	"context"
	"fmt"

	"agentic-commerce/internal/domain"
	rzp "github.com/razorpay/razorpay-go"
	rzputils "github.com/razorpay/razorpay-go/utils"
)

type Config struct {
	KeyID     string
	KeySecret string
}

type clientImpl struct {
	client *rzp.Client
}

// NewClient initializes the Razorpay API wrapper and returns it as a PaymentGateway interface.
func NewClient(cfg Config) domain.PaymentGateway {
	client := rzp.NewClient(cfg.KeyID, cfg.KeySecret)
	
	return &clientImpl{
		client: client,
	}
}

// CreateOrder calls the Razorpay API to generate an order ID for the checkout.
func (c *clientImpl) CreateOrder(ctx context.Context, amountPaise int64, currency string, receiptID string) (*domain.GatewayOrder, error) {
	// Construct the payload exactly as the Razorpay API expects
	data := map[string]interface{}{
		"amount":   amountPaise,
		"currency": currency,
		"receipt":  receiptID,
	}

	// Call the external network (This is the slowest part of the checkout flow, 
	// which is why we run it outside of our Postgres transactions!)
	body, err := c.client.Order.Create(data, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create razorpay order: %w", err)
	}

	// The SDK returns a generic map[string]interface{}. We parse it defensively.
	orderID, ok := body["id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid razorpay response: missing order id")
	}
	
	entity, _ := body["entity"].(string)
	status, _ := body["status"].(string)
	
	// JSON unmarshals numbers into float64 when mapping to interface{}
	resAmount, _ := body["amount"].(float64)

	// Translate the external vendor data structure back into our pure Domain model
	return &domain.GatewayOrder{
		ID:       orderID,
		Entity:   entity,
		Amount:   int64(resAmount),
		Currency: currency,
		Status:   status,
		Receipt:  receiptID,
	}, nil
}

// VerifySignature is a utility to validate Razorpay Webhooks later.
func VerifySignature(body string, signature string, secret string) bool {
	return rzputils.VerifyWebhookSignature(body, signature, secret)
}
