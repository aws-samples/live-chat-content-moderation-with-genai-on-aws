#!/bin/bash

# Check if an argument is provided
if [ -z "$1" ]; then
  echo -e "\n${RED}[ERROR] Please provide a model name (titan, haiku, haiku-3.5, llama or nova-micro) as an argument."
  exit 1
fi

# Store the path to the cdk-outputs.json file
CDK_OUTPUTS_FILE="../backend/cdk/cdk-outputs.json"

# Get the stack name from the cdk-outputs.json file
STACK_NAME=$(jq -r 'keys[0]' "$CDK_OUTPUTS_FILE")

# Extract and export the necessary values
PROMPT_STORE_TABLE_NAME=$(jq -r '.'"$STACK_NAME"'.PromptStoreTableName' "$CDK_OUTPUTS_FILE")

# Generate a new UUID
MODEL_UUID=$(uuidgen)

# Color variables
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Set model-specific variables based on the provided argument
case "$1" in
  titan)
    MODEL_ID="amazon.titan-text-premier-v1:0"
    MODEL_NAME="Amazon Titan"
    MODEL_OUTPUT_KEY="TitanModelUUID"
    MAX_TOKENS=256
    TEMPERATURE=0
    TOP_P=0
    ;;
  haiku)
    MODEL_ID="anthropic.claude-3-haiku-20240307-v1:0"
    MODEL_NAME="Anthropic Claude Haiku 3"
    MODEL_OUTPUT_KEY="HaikuModelUUID"
    MAX_TOKENS=256
    TEMPERATURE=0
    TOP_P=0
    ;;
  haiku-3.5)
    MODEL_ID="us.anthropic.claude-3-5-haiku-20241022-v1:0"
    MODEL_NAME="Anthropic Claude Haiku 3.5"
    MODEL_OUTPUT_KEY="Haiku35ModelUUID"
    MAX_TOKENS=256
    TEMPERATURE=0
    TOP_P=0
    ;;
  llama)
    MODEL_ID="meta.llama3-8b-instruct-v1:0"
    MODEL_NAME="Meta Llama"
    MODEL_OUTPUT_KEY="LlamaModelUUID"
    MAX_TOKENS=256
    TEMPERATURE=0
    TOP_P=0
    ;;
  nova-micro)
    MODEL_ID="amazon.nova-micro-v1:0"
    MODEL_NAME="Amazon Nova Micro"
    MODEL_OUTPUT_KEY="NovaMicroModelUUID"
    MAX_TOKENS=256
    TEMPERATURE=0
    TOP_P=0
    ;;
  *)
    echo -e "\n${RED}[ERROR] Invalid model name provided. Please use titan, haiku, haiku-3.5, llama or nova-micro."
    exit 1
    ;;
esac

# Define the prompt content
read -r -d '' PROMPT_CONTENT << EOM
You are a moderation bot tasked with identifying and preventing the spread of harmful, aggressive, racist, or toxic messages in a live stream chat. Analyze the context and intent of the message, not just specific words. Respond only with y for safe messages or n for harmful messages. Do not provide any explanation.
Guidelines:
1. Hate speech or discrimination
2. Explicit threats of violence
3. Severe profanity
4. Bullying or harassment
5. Spam or excessive self-promotion
6. Selling or advertising products
7. Sharing personal information
8. Encouraging self-harm or illegal activities
If a message is ambiguous, err on the side of caution and allow it.
Your entire response MUST be either y or n, nothing else.
EOM

echo -e "\n${BLUE}[INFO] Inserting ${MODEL_NAME} model prompt into DynamoDB...${NC}"

# Insert the item into the DynamoDB table
aws dynamodb put-item \
--table-name "${PROMPT_STORE_TABLE_NAME}" \
--item '{
  "promptId": {"S": "'"$MODEL_UUID"'"},
  "modelId": {"S": "'"$MODEL_ID"'"},
  "config": {"M": {
    "systemPrompt": {"S": "'"$(echo "$PROMPT_CONTENT" | tr '\n' ' ' | sed 's/"/\\"/g')"'"},
    "parameters": {"M": {
      "temperature": {"N": "'"$TEMPERATURE"'"},
      "topP": {"N": "'"$TOP_P"'"},
      "maxTokens": {"N": "'"$MAX_TOKENS"'"}
    }}
  }}
}'

# Update cdk-outputs.json
jq ".[\"$STACK_NAME\"] += {\"$MODEL_OUTPUT_KEY\": \"$MODEL_UUID\"}" "$CDK_OUTPUTS_FILE" > tmp.json && mv tmp.json "$CDK_OUTPUTS_FILE"

# Check if the insertion was successful
if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}[SUCCESS] ${MODEL_NAME} model prompt inserted successfully.${NC}"
  echo -e "\n${BLUE}[INFO] Prompt ID: $MODEL_UUID${NC}"
  echo -e "\n${BLUE}[INFO] Table Name: $PROMPT_STORE_TABLE_NAME${NC}"
else
  echo -e "\n${RED}[ERROR] Failed to insert ${MODEL_NAME} model prompt.${NC}"
  exit 1
fi
