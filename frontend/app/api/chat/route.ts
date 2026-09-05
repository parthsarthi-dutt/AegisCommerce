const FULL_AGENT_ID = '22222222-2222-2222-2222-222222222222';
const BACKEND_URL =
  process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8080/mcp/v1';

const searchCatalogTool = {
  type: "function",
  function: {
    name: "search_catalog",
    description:
      "Search the merchant catalog for products matching the customer query.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keywords"
        }
      },
      required: ["query"]
    }
  }
};

const initiatePurchaseTool = {
  type: "function",
  function: {
    name: "initiate_purchase",
    description:
      "Initiate a purchase for one or more product IDs. Use this ONLY when the user explicitly agrees to buy the products.",
    parameters: {
      type: "object",
      properties: {
        product_ids: {
          type: "array",
          items: { type: "string" },
          description: "An array containing the exact IDs of the products to purchase"
        }
      },
      required: ["product_ids"]
    }
  }
};

export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();

    if (!message || typeof message !== "string") {
      return Response.json(
        {
          role: "assistant",
          content: "Please provide a message."
        },
        { status: 400 }
      );
    }

    const systemInstruction = `
You are the AI Revenue Agent for Aegis Commerce.

Your goal is to help customers find products and recommend relevant upsells to increase merchant revenue.

When you recommend an upsell, explain clearly WHY it fits their use case.

Never invent:
- products
- prices
- product IDs
- merchant IDs
- catalog hashes

ALWAYS use the search_catalog tool to find real products.

SEARCH RULE:
When using search_catalog, ALWAYS use one simple keyword.

Examples:
"Developer"
"Compute"
"Vector"

Do NOT use long phrases because the catalog search uses keyword matching.

After presenting products, ask the customer if they would like to proceed with the purchase.

PURCHASE RULE:
When the customer explicitly says yes or confirms that they want to buy a product or a bundle:

1. Use the exact product IDs returned by search_catalog.
2. Call initiate_purchase with an array of those exact product IDs.
3. IMPORTANT: If the user is purchasing a bundle (e.g., Base Plan + Add-ons), you MUST include ALL of their product IDs in the array, not just the most recent one!
4. NEVER invent a product ID.
5. NEVER invent a catalog hash.
5. The backend Trust Layer is responsible for authorization and policy enforcement.
6. If the backend returns HTTP 403, clearly tell the customer that the Trust Layer denied the transaction.
7. Include the actual backend denial reason.
8. If the backend successfully creates an authorized transaction, do NOT describe it as denied.
9. Do NOT claim that payment was completed merely because a transaction was authorized.
10. An AUTHORIZED transaction means the proposal passed the Trust Layer and is ready for the next checkout/payment step.
`;

    const formattedMessages: any[] = [
      {
        role: "system",
        content: systemInstruction
      }
    ];

    /*
     * ============================================================
     * REBUILD CONVERSATION HISTORY
     * ============================================================
     */

    for (const m of history) {
      if (
        !m ||
        !(
          m.role === "user" ||
          m.role === "assistant" ||
          m.role === "model"
        )
      ) {
        continue;
      }

      const role =
        m.role === "model"
          ? "assistant"
          : m.role;

      /*
       * Previous assistant message containing tool calls.
       */
      if (
        role === "assistant" &&
        Array.isArray(m.rawToolCalls) &&
        m.rawToolCalls.length > 0
      ) {
        formattedMessages.push({
          role: "assistant",
          content:
            typeof m.content === "string"
              ? m.content
              : JSON.stringify(m.content ?? ""),
          tool_calls: m.rawToolCalls
        });

        /*
         * Rebuild corresponding tool results.
         */
        m.rawToolCalls.forEach(
          (tc: any, index: number) => {
            const toolCallResult =
              Array.isArray(m.toolCalls) &&
              m.toolCalls[index]
                ? m.toolCalls[index].result
                : {
                    success: true
                  };

            formattedMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              name: tc.function?.name || "unknown",
              content: JSON.stringify(
                toolCallResult
              )
            });
          }
        );
      } else {
        formattedMessages.push({
          role,
          content:
            typeof m.content === "string"
              ? m.content
              : JSON.stringify(m.content ?? "")
        });
      }
    }

    /*
     * Current customer message.
     */
    formattedMessages.push({
      role: "user",
      content: message
    });

    /*
     * ============================================================
     * GROQ REQUEST
     * ============================================================
     */

    const makeGroqRequest = async (
      messages: any[]
    ) => {
      if (!process.env.GROQ_API_KEY) {
        throw new Error(
          "GROQ_API_KEY is not configured"
        );
      }

      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            model: "qwen/qwen3.8-27b",
            messages,
            tools: [
              searchCatalogTool,
              initiatePurchaseTool
            ],
            temperature: 0.2
          })
        }
      );

      if (!res.ok) {
        const errorText =
          await res.text();

        throw new Error(
          `Groq Error ${res.status}: ${errorText}`
        );
      }

      return await res.json();
    };

    /*
     * ============================================================
     * FIRST GROQ REQUEST
     * ============================================================
     */

    const data =
      await makeGroqRequest(
        formattedMessages
      );

    const assistantMessage =
      data?.choices?.[0]?.message;

    if (!assistantMessage) {
      throw new Error(
        "Groq returned an invalid response"
      );
    }

    let responseText =
      assistantMessage.content || "";

    const rawToolCalls =
      Array.isArray(
        assistantMessage.tool_calls
      )
        ? assistantMessage.tool_calls
        : [];

    const toolCalls: any[] = [];

    /*
     * ============================================================
     * NO TOOL CALL
     * ============================================================
     */

    if (rawToolCalls.length === 0) {
      return Response.json({
        role: "assistant",
        content:
          responseText ||
          "What product or setup are you looking for?",
        toolCalls: undefined,
        rawToolCalls: undefined
      });
    }

    /*
     * ============================================================
     * PROCESS TOOL CALLS
     * ============================================================
     */

    for (const tc of rawToolCalls) {
      const toolName =
        tc?.function?.name;

      let args: any = {};

      try {
        args = JSON.parse(
          tc?.function?.arguments || "{}"
        );
      } catch {
        toolCalls.push({
          name: toolName || "unknown",
          result: {
            success: false,
            error:
              "Invalid tool arguments"
          }
        });

        responseText =
          `⚠️ Tool execution failed: invalid arguments for ${toolName || "unknown"}.`;

        break;
      }

      /*
       * ========================================================
       * SEARCH CATALOG
       * ========================================================
       */

      if (
        toolName === "search_catalog"
      ) {
        const query =
          typeof args.query === "string"
            ? args.query.trim()
            : "";

        if (!query) {
          toolCalls.push({
            name: "search_catalog",
            result: {
              success: false,
              error:
                "Search query is required"
            }
          });

          responseText =
            "Please tell me what kind of product or environment you need.";

          break;
        }

        console.log(
          "[Chat Route] search_catalog →",
          query
        );

        const searchRes =
          await fetch(
            `${BACKEND_URL}/products/search?query=${encodeURIComponent(query)}`,
            {
              method: "GET",
              headers: {
                "X-Agent-ID":
                  FULL_AGENT_ID
              }
            }
          );

        const searchText =
          await searchRes.text();

        let searchData: any;

        try {
          searchData =
            JSON.parse(searchText);
        } catch {
          searchData = {
            error: searchText
          };
        }

        console.log(
          "[Chat Route] search_catalog result →",
          searchData
        );

        toolCalls.push({
          name: "search_catalog",
          result: searchData
        });

        /*
         * Give the real catalog response back to Groq.
         */
        formattedMessages.push(
          assistantMessage
        );

        formattedMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: toolName,
          content:
            JSON.stringify(searchData)
        });

        const secondData =
          await makeGroqRequest(
            formattedMessages
          );

        const secondMessage =
          secondData?.choices?.[0]?.message;

        responseText =
          secondMessage?.content ||
          "I found some products that might fit your needs. Would you like to proceed with the purchase?";

        /*
         * Do not process a second tool call from this
         * simplified search flow.
         */
        break;
      }

      /*
       * ========================================================
       * INITIATE PURCHASE
       * ========================================================
       */

      if (
        toolName === "initiate_purchase"
      ) {
        const productIDs =
          Array.isArray(args.product_ids)
            ? args.product_ids
            : [];

        if (productIDs.length === 0) {
          toolCalls.push({
            name: "initiate_purchase",
            result: {
              success: false,
              policy_denied: false,
              error:
                "product_ids array is required and cannot be empty"
            }
          });

          responseText =
            "⚠️ Purchase proposal failed: product IDs are missing.";

          break;
        }

        console.log(
          "[Chat Route] initiate_purchase →",
          productIDs
        );

        const intentResults: any[] = [];
        let hasError = false;

        for (const productID of productIDs) {
          /*
           * ======================================================
           * STEP 1
           * GET AUTHORITATIVE PRODUCT
           * ======================================================
           */

          const productRes =
            await fetch(
              `${BACKEND_URL}/products/${encodeURIComponent(productID)}`,
              {
                method: "GET",
                headers: {
                  "X-Agent-ID":
                    FULL_AGENT_ID
                }
              }
            );

          const productText =
            await productRes.text();

          let productResponse: any;

          try {
            productResponse =
              JSON.parse(productText);
          } catch {
            productResponse = {
              error: productText
            };
          }

          if (
            !productRes.ok ||
            !productResponse?.data
          ) {
            hasError = true;
            intentResults.push({
                success: false,
                error: productResponse?.error || `Product lookup failed with HTTP ${productRes.status}`
            });
            continue;
          }

          const product =
            productResponse.data;

          /*
           * ======================================================
           * STEP 2
           * VALIDATE AUTHORITATIVE CATALOG DATA
           * ======================================================
           */

          if (!product.id || !product.merchant_id || product.price_paise === undefined || product.price_paise === null || !product.currency) {
            hasError = true;
            intentResults.push({ success: false, error: "Missing required product fields" });
            continue;
          }

          const pricePaise =
            Number(
              product.price_paise
            );

          const catalogHash =
            typeof product.content_hash ===
            "string"
              ? product.content_hash.trim()
              : "";

          if (!catalogHash) {
             hasError = true;
             intentResults.push({ success: false, error: "Missing catalog hash" });
             continue;
          }

          /*
           * ======================================================
           * STEP 3
           * BUILD CHECKOUT REQUEST
           * ======================================================
           */

          const merchantID =
            product.merchant_id;

          const authoritativeProductID =
            product.id;

          const currency =
            product.currency;

          const idempotencyKey =
            `ai-${FULL_AGENT_ID}-${authoritativeProductID}-${Date.now()}`;

          const checkoutRequest = {
            merchant_id:
              merchantID,
            product_id:
              authoritativeProductID,
            quantity: 1,
            expected_price:
              pricePaise,
            currency:
              currency,
            catalog_hash:
              catalogHash,
            idempotency_key:
              idempotencyKey
          };

          /*
           * ======================================================
           * STEP 4
           * ENTER TRUST LAYER
           * ======================================================
           */

          const proposalRes =
            await fetch(
              `${BACKEND_URL}/checkout/propose`,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                  "X-Agent-ID":
                    FULL_AGENT_ID
                },
                body:
                  JSON.stringify(
                    checkoutRequest
                  )
              }
            );

          const proposalText =
            await proposalRes.text();

          let proposalData: any;

          try {
            proposalData =
              JSON.parse(
                proposalText
              );
          } catch {
            proposalData = {
              error:
                proposalText
            };
          }

          const backendError =
            proposalData?.error ||
            proposalData?.message ||
            proposalData?.data?.error ||
            proposalData?.data?.message ||
            "Unknown Trust Layer response";

          if (
            proposalRes.status ===
            403
          ) {
             hasError = true;
             intentResults.push({ success: false, policy_denied: true, error: backendError, product, proposal: proposalData });
             continue;
          }

          if (
            !proposalRes.ok ||
            !proposalData?.data
          ) {
             hasError = true;
             intentResults.push({ success: false, policy_denied: false, error: backendError, product, proposal: proposalData });
             continue;
          }

          let gatewayOrderID = null;
          let executeData = null;
          const transactionData = proposalData?.data?.transaction || proposalData?.data || proposalData;
          const transactionId = transactionData?.id || transactionData?.transaction_id;

          try {
            if (transactionId) {
              const executeRes = await fetch(`${BACKEND_URL}/checkout/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Agent-ID": FULL_AGENT_ID },
                body: JSON.stringify({ transaction_id: transactionId, idempotency_key: `${idempotencyKey}_exec` })
              });
              if (executeRes.ok) {
                executeData = await executeRes.json();
                gatewayOrderID = executeData?.data?.gateway_order_id;
              }
            }
          } catch (e) {}

          intentResults.push({
              success: true,
              product_id: productID,
              product: product,
              transaction: { ...transactionData, status: executeData?.data?.status || transactionData?.status || "authorized" },
              order: gatewayOrderID ? { gateway_order_id: gatewayOrderID } : (proposalData.data?.order || undefined),
              proposal: proposalData
          });
        }

        if (hasError) {
          toolCalls.push({
            name: "initiate_purchase",
            result: {
              success: false,
              intents: intentResults,
              error: "One or more purchases failed."
            }
          });
          responseText = "⚠️ Purchase proposal failed for one or more items.";
        } else {
          toolCalls.push({
            name: "initiate_purchase",
            result: {
              success: true,
              intents: intentResults,
              action: "intent_captured",
              message: "Purchase intent successfully captured and verified."
            }
          });
          responseText = "Purchase intents captured successfully.";
        }
        break;
      }
    }

    /*
     * ============================================================
     * FINAL RESPONSE
     * ============================================================
     */

    return Response.json({
      role: "assistant",

      content:
        responseText ||
        "Would you like me to proceed with the purchase?",

      toolCalls:
        toolCalls.length > 0
          ? toolCalls
          : undefined,

      rawToolCalls:
        rawToolCalls.length > 0
          ? rawToolCalls
          : undefined
    });

  } catch (error: any) {
    console.error(
      "[Chat Route] Error:",
      error
    );

    return Response.json(
      {
        role: "assistant",

        content:
          `⚠️ Error: ${
            error?.message ||
            "Unknown error"
          }`
      },
      {
        status: 500
      }
    );
  }
}
