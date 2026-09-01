package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run scripts/simulate_webhook.go <gateway_order_id>")
		os.Exit(1)
	}
	orderID := os.Args[1]

	// Load environment variables from .env file
	_ = godotenv.Load()

	secret := os.Getenv("RAZORPAY_KEY_SECRET")
	if webhookSecret := os.Getenv("RAZORPAY_WEBHOOK_SECRET"); webhookSecret != "" {
		secret = webhookSecret
	}
	if secret == "" {
		fmt.Println("Error: RAZORPAY_KEY_SECRET is not set in .env")
		os.Exit(1)
	}

	payload := fmt.Sprintf(`{
		"event": "payment.captured",
		"payload": {
			"payment": {
				"entity": {
					"order_id": "%s",
					"status": "captured"
				}
			}
		}
	}`, orderID)

	// Razorpay hashes the raw body using HMAC-SHA256
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	signature := hex.EncodeToString(mac.Sum(nil))

	req, err := http.NewRequest("POST", "http://localhost:8080/webhooks/razorpay", bytes.NewBuffer([]byte(payload)))
	if err != nil {
		panic(err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Razorpay-Signature", signature)

	fmt.Printf("Firing Webhook for Order: %s...\n", orderID)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error making request: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	fmt.Printf("Response Status: %s\n", resp.Status)
	fmt.Printf("Response Body: %s\n", string(bodyBytes))
}
