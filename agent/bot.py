import os
import uuid
import requests
import json

# --- Configuration ---
API_BASE = "http://localhost:8080/mcp/v1"
MERCHANT_ID = "11111111-1111-1111-1111-111111111111"
AGENT_ID = "22222222-2222-2222-2222-222222222222"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# --- Define the Tools for the Trust Layer ---

def search_products(query: str) -> dict:
    print(f"\n🔧 Tool Call: search_products(query='{query}')")
    resp = requests.get(
        f"{API_BASE}/products/search",
        params={"merchant_id": MERCHANT_ID, "query": query},
        headers={"X-Agent-ID": AGENT_ID}
    )
    return resp.json()

def propose_transaction(product_id: str, quantity: int, expected_price_paise: int, catalog_hash: str) -> dict:
    idempotency_key = str(uuid.uuid4())
    print(f"\n🔧 Tool Call: propose_transaction(product_id='{product_id}', qty={quantity}, price={expected_price_paise})")
    
    payload = {
        "MerchantID": MERCHANT_ID,
        "ProductID": product_id,
        "Quantity": int(quantity),
        "ExpectedPrice": int(expected_price_paise),
        "Currency": "INR",
        "CatalogHash": catalog_hash,
        "IdempotencyKey": idempotency_key
    }
    
    resp = requests.post(f"{API_BASE}/checkout/propose", json=payload, headers={"X-Agent-ID": AGENT_ID})
    return resp.json()

def execute_payment(transaction_id: str) -> dict:
    idempotency_key = str(uuid.uuid4())
    print(f"\n🔧 Tool Call: execute_payment(transaction_id='{transaction_id}')")
    
    payload = {"transaction_id": transaction_id, "idempotency_key": idempotency_key}
    resp = requests.post(f"{API_BASE}/checkout/execute", json=payload, headers={"X-Agent-ID": AGENT_ID})
    return resp.json()

# Tool Dispatcher
AVAILABLE_TOOLS = {
    "search_products": search_products,
    "propose_transaction": propose_transaction,
    "execute_payment": execute_payment
}

# --- Gemini REST API Integration ---

GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={GEMINI_API_KEY}"

def get_gemini_tool_schema():
    return [{
        "functionDeclarations": [
            {
                "name": "search_products",
                "description": "Searches the merchant catalog for products matching the query.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {"query": {"type": "STRING", "description": "The search term"}},
                    "required": ["query"]
                }
            },
            {
                "name": "propose_transaction",
                "description": "Proposes a purchase. You MUST use the exact price_paise and content_hash returned by search_products.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "product_id": {"type": "STRING"},
                        "quantity": {"type": "INTEGER"},
                        "expected_price_paise": {"type": "INTEGER"},
                        "catalog_hash": {"type": "STRING"}
                    },
                    "required": ["product_id", "quantity", "expected_price_paise", "catalog_hash"]
                }
            },
            {
                "name": "execute_payment",
                "description": "Executes the payment for an authorized transaction proposal.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {"transaction_id": {"type": "STRING"}},
                    "required": ["transaction_id"]
                }
            }
        ]
    }]

def run_agent():
    print("🤖 Agentic Commerce Test Harness Booting Up (REST Mode)...")
    
    system_instruction = """
    You are an autonomous AI assistant tasked with buying a Premium AI Subscription.
    Workflow:
    1. search_products for "Premium AI Subscription"
    2. propose_transaction for quantity 1 using the exact price_paise and content_hash from step 1.
    3. If authorized, execute_payment.
    """
    
    # Initialize conversation history
    history = [
        {"role": "user", "parts": [{"text": "Execute the purchase workflow."}]}
    ]
    
    print("\n📩 Sending Intent to Gemini...")
    
    while True:
        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": history,
            "tools": get_gemini_tool_schema()
        }
        
        response = requests.post(GEMINI_URL, json=payload).json()
        
        if "error" in response:
            print(f"❌ Gemini API Error: {response['error']['message']}")
            break
            
        message = response["candidates"][0]["content"]
        history.append(message) # Append model response to history
        
        # Check if the model wants to call a tool
        if "parts" in message and "functionCall" in message["parts"][0]:
            func_call = message["parts"][0]["functionCall"]
            func_name = func_call["name"]
            func_args = func_call.get("args", {})
            
            # Execute the tool locally
            if func_name in AVAILABLE_TOOLS:
                tool_result = AVAILABLE_TOOLS[func_name](**func_args)
                print(f"   ↳ Result: {tool_result}")
                
                # Feed the result back to Gemini
                history.append({
                    "role": "user",
                    "parts": [{
                        "functionResponse": {
                            "name": func_name,
                            "response": {"name": func_name, "content": tool_result}
                        }
                    }]
                })
            else:
                print(f"❌ Unknown tool requested: {func_name}")
                break
        else:
            # No tool calls, the model is done and giving us a final text answer
            print("\n✅ Final Result:")
            print(message["parts"][0]["text"])
            break

if __name__ == "__main__":
    if not GEMINI_API_KEY:
        print("❌ Error: GEMINI_API_KEY environment variable is not set!")
        exit(1)
        
    run_agent()